package com.proj.server.estate;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateroledefinition.ESTATEROLEDEFINITION;
import static com.proj.server.db.tables.Estaterolepermission.ESTATEROLEPERMISSION;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Permission.PERMISSION;
import static org.jooq.impl.DSL.*;

import com.proj.server.db.tables.records.EstateRecord;
import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Shared typed predicates keep collection projections and individual guards aligned. */
public final class EstatePermissions {
    private EstatePermissions() {}

    public static Condition customEstates(String user, EstatePermissionCode permission) {
        var membership = ESTATEUSER.as("permission_member");
        var definition = ESTATEROLEDEFINITION.as("permission_role");
        var grant = ESTATEROLEPERMISSION.as("permission_grant");
        var catalogue = PERMISSION.as("permission_code");
        var supported =
                Arrays.stream(EstatePermissionCode.values()).map(Enum::name).toList();
        var invalid = ESTATEROLEPERMISSION.as("invalid_grant");
        Condition valid = notExists(selectOne()
                .from(invalid)
                .where(invalid.ROLEID.eq(definition.ID).and(invalid.PERMISSION.notIn(supported))));
        for (var code : EstatePermissionCode.values()) {
            for (var prerequisite : code.requires()) {
                var selected = ESTATEROLEPERMISSION.as("selected_" + code.name());
                var required = ESTATEROLEPERMISSION.as("required_" + code.name());
                valid = valid.and(notExists(selectOne()
                                .from(selected)
                                .where(selected.ROLEID.eq(definition.ID).and(selected.PERMISSION.eq(code.name()))))
                        .orExists(selectOne()
                                .from(required)
                                .where(required.ROLEID
                                        .eq(definition.ID)
                                        .and(required.PERMISSION.eq(prerequisite.name())))));
            }
        }
        return ESTATE.ID.in(select(membership.ESTATEID)
                .from(membership)
                .join(definition)
                .on(definition.ID.eq(membership.CUSTOMROLEID).and(definition.ESTATEID.eq(membership.ESTATEID)))
                .join(grant)
                .on(grant.ROLEID.eq(definition.ID))
                .join(catalogue)
                .on(catalogue.CODE.eq(grant.PERMISSION))
                .where(membership
                        .USERID
                        .eq(user)
                        .and(membership.ROLE.eq("CUSTOM"))
                        .and(grant.PERMISSION.eq(permission.name()))
                        .and(valid)));
    }

    public static boolean has(DSLContext db, UUID estate, String user, EstatePermissionCode permission) {
        return db.fetchExists(ESTATE, ESTATE.ID.eq(estate).and(customEstates(user, permission)));
    }

    public static Set<EstatePermissionCode> grants(DSLContext db, UUID role, UUID estate) {
        if (role == null
                || !db.fetchExists(
                        ESTATEROLEDEFINITION,
                        ESTATEROLEDEFINITION.ID.eq(role).and(ESTATEROLEDEFINITION.ESTATEID.eq(estate))))
            return Set.of();
        var rows = db.select(ESTATEROLEPERMISSION.PERMISSION, PERMISSION.CODE)
                .from(ESTATEROLEPERMISSION)
                .leftJoin(PERMISSION)
                .on(PERMISSION.CODE.eq(ESTATEROLEPERMISSION.PERMISSION))
                .where(ESTATEROLEPERMISSION.ROLEID.eq(role))
                .fetch();
        return validatedGrants(rows.getValues(PERMISSION.CODE));
    }

    static Set<EstatePermissionCode> validatedGrants(Collection<String> codes) {
        var result = EnumSet.noneOf(EstatePermissionCode.class);
        for (var code : codes) {
            if (code == null) return Set.of();
            try {
                result.add(EstatePermissionCode.valueOf(code));
            } catch (IllegalArgumentException unsupported) {
                return Set.of();
            }
        }
        if (result.stream().anyMatch(code -> !result.containsAll(code.requires()))) return Set.of();
        return Set.copyOf(result);
    }

    public static Authority authority(DSLContext db, UUID estateId, String user, boolean lock) {
        var query = db.selectFrom(ESTATE).where(ESTATE.ID.eq(estateId));
        EstateRecord estate = lock ? query.forUpdate().fetchOne() : query.fetchOne();
        if (estate == null) throw error(HttpStatus.NOT_FOUND, "Estate not found.");
        var member = db.selectFrom(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(user)))
                .fetchOne();
        String role = member == null ? null : member.getRole();
        boolean manager = !"RESIDENT".equals(role) && (user.equals(estate.getOwneruserid()) || "MANAGER".equals(role));
        if (!manager && member == null) throw error(HttpStatus.NOT_FOUND, "Estate not found.");
        var customId = member == null ? null : member.getCustomroleid();
        var grants = "CUSTOM".equals(role) ? grants(db, customId, estateId) : Set.<EstatePermissionCode>of();
        return new Authority(estate, role, customId, manager, grants);
    }

    public record Authority(
            EstateRecord estate,
            String role,
            UUID customRoleId,
            boolean manager,
            Set<EstatePermissionCode> permissions) {
        public boolean has(EstatePermissionCode permission) {
            boolean presetDocuments = (permission == EstatePermissionCode.VIEW_DOCUMENTS
                            || permission == EstatePermissionCode.EDIT_DOCUMENTS)
                    && ("COUNCIL".equals(role) || "CREW".equals(role));
            return manager || presetDocuments || permissions.contains(permission);
        }

        public boolean active() {
            return estate.getDeactivatedat() == null;
        }

        public void require(EstatePermissionCode permission) {
            if (!has(permission))
                throw error(HttpStatus.FORBIDDEN, "This estate permission is required: " + permission.name());
        }

        public void requireManager() {
            if (!manager) throw error(HttpStatus.FORBIDDEN, "Manager access to this estate is required.");
        }

        public void requireActive() {
            if (!active()) throw error(HttpStatus.CONFLICT, "This estate is inactive.");
        }
    }

    static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
}
