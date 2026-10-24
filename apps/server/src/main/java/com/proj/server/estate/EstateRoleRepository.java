package com.proj.server.estate;

import static com.proj.server.db.tables.Estateinvitation.ESTATEINVITATION;
import static com.proj.server.db.tables.Estateroledefinition.ESTATEROLEDEFINITION;
import static com.proj.server.db.tables.Estaterolepermission.ESTATEROLEPERMISSION;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Permission.PERMISSION;
import static com.proj.server.estate.EstatePermissions.error;

import com.proj.server.db.tables.records.EstateroledefinitionRecord;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;

@Repository
public class EstateRoleRepository {
    private final DSLContext db;

    public EstateRoleRepository(DSLContext db) {
        this.db = db;
    }

    public EstatePermissions.Authority authority(UUID estate, String user, boolean lock) {
        return EstatePermissions.authority(db, estate, user, lock);
    }

    public List<EstatePermissionResponse> catalogue() {
        var entries = db.selectFrom(PERMISSION).fetchMap(PERMISSION.CODE);
        return Arrays.stream(EstatePermissionCode.values())
                .map(code -> {
                    var row = entries.get(code.name());
                    if (row == null)
                        throw error(HttpStatus.SERVICE_UNAVAILABLE, "Permission catalogue is temporarily unavailable.");
                    return new EstatePermissionResponse(code, row.getLabel(), row.getDescription(), code.requires());
                })
                .toList();
    }

    public Set<EstatePermissionCode> permissions(UUID estate, UUID role) {
        return EstatePermissions.grants(db, role, estate);
    }

    public Map<UUID, Set<EstatePermissionCode>> permissions(UUID estate, Collection<UUID> roles) {
        if (roles.isEmpty()) return Map.of();
        var rows = db.select(ESTATEROLEDEFINITION.ID, PERMISSION.CODE)
                .from(ESTATEROLEDEFINITION)
                .leftJoin(ESTATEROLEPERMISSION)
                .on(ESTATEROLEPERMISSION.ROLEID.eq(ESTATEROLEDEFINITION.ID))
                .leftJoin(PERMISSION)
                .on(PERMISSION.CODE.eq(ESTATEROLEPERMISSION.PERMISSION))
                .where(ESTATEROLEDEFINITION.ESTATEID.eq(estate).and(ESTATEROLEDEFINITION.ID.in(roles)))
                .fetchGroups(ESTATEROLEDEFINITION.ID, PERMISSION.CODE);
        var result = new HashMap<UUID, Set<EstatePermissionCode>>();
        for (var entry : rows.entrySet())
            result.put(entry.getKey(), EstatePermissions.validatedGrants(entry.getValue()));
        return Map.copyOf(result);
    }

    public Set<UUID> assignedRoles(UUID estate, Collection<UUID> roles) {
        if (roles.isEmpty()) return Set.of();
        return db.selectDistinct(ESTATEUSER.CUSTOMROLEID)
                .from(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estate).and(ESTATEUSER.CUSTOMROLEID.in(roles)))
                .fetchSet(ESTATEUSER.CUSTOMROLEID);
    }

    public List<EstateroledefinitionRecord> definitions(UUID estate) {
        return db.selectFrom(ESTATEROLEDEFINITION)
                .where(ESTATEROLEDEFINITION.ESTATEID.eq(estate))
                .orderBy(ESTATEROLEDEFINITION.NORMALIZEDNAME, ESTATEROLEDEFINITION.ID)
                .fetch();
    }

    public EstateroledefinitionRecord definition(UUID estate, UUID id, boolean lock) {
        var query = db.selectFrom(ESTATEROLEDEFINITION)
                .where(ESTATEROLEDEFINITION.ID.eq(id).and(ESTATEROLEDEFINITION.ESTATEID.eq(estate)));
        var result = lock ? query.forUpdate().fetchOne() : query.fetchOne();
        if (result == null) throw error(HttpStatus.NOT_FOUND, "Custom role not found.");
        return result;
    }

    public EstateRoleDefinitionResponse response(
            EstateroledefinitionRecord row,
            EstatePermissions.Authority authority,
            Set<EstatePermissionCode> selected,
            boolean assigned) {
        boolean edit = authority.has(EstatePermissionCode.EDIT_ROLES)
                && authority.active()
                && (authority.manager()
                        || (!row.getId().equals(authority.customRoleId())
                                && authority.permissions().containsAll(selected)));
        boolean delete = authority.manager() && authority.active() && !assigned;
        return new EstateRoleDefinitionResponse(
                row.getId(),
                row.getEstateid(),
                row.getName(),
                row.getDescription(),
                Arrays.stream(EstatePermissionCode.values())
                        .filter(selected::contains)
                        .toList(),
                row.getCreatedat(),
                row.getUpdatedat(),
                row.getVersion(),
                edit,
                delete);
    }

    public boolean nameTaken(UUID estate, String normalizedName, UUID exclude) {
        var condition =
                ESTATEROLEDEFINITION.ESTATEID.eq(estate).and(ESTATEROLEDEFINITION.NORMALIZEDNAME.eq(normalizedName));
        if (exclude != null) condition = condition.and(ESTATEROLEDEFINITION.ID.ne(exclude));
        return db.fetchExists(ESTATEROLEDEFINITION, condition);
    }

    public EstateroledefinitionRecord create(
            UUID estate, String user, String name, String key, String description, Set<EstatePermissionCode> selected) {
        var now = OffsetDateTime.now();
        var row = db.insertInto(ESTATEROLEDEFINITION)
                .set(ESTATEROLEDEFINITION.ID, UUID.randomUUID())
                .set(ESTATEROLEDEFINITION.ESTATEID, estate)
                .set(ESTATEROLEDEFINITION.NAME, name)
                .set(ESTATEROLEDEFINITION.NORMALIZEDNAME, key)
                .set(ESTATEROLEDEFINITION.DESCRIPTION, description)
                .set(ESTATEROLEDEFINITION.CREATEDBYUSERID, user)
                .set(ESTATEROLEDEFINITION.CREATEDAT, now)
                .set(ESTATEROLEDEFINITION.UPDATEDAT, now)
                .set(ESTATEROLEDEFINITION.VERSION, 1)
                .returning()
                .fetchSingle();
        savePermissions(row.getId(), selected);
        return row;
    }

    public EstateroledefinitionRecord update(
            EstateroledefinitionRecord row,
            String name,
            String key,
            String description,
            Set<EstatePermissionCode> selected) {
        db.deleteFrom(ESTATEROLEPERMISSION)
                .where(ESTATEROLEPERMISSION.ROLEID.eq(row.getId()))
                .execute();
        savePermissions(row.getId(), selected);
        return db.update(ESTATEROLEDEFINITION)
                .set(ESTATEROLEDEFINITION.NAME, name)
                .set(ESTATEROLEDEFINITION.NORMALIZEDNAME, key)
                .set(ESTATEROLEDEFINITION.DESCRIPTION, description)
                .set(ESTATEROLEDEFINITION.VERSION, row.getVersion() + 1)
                .set(ESTATEROLEDEFINITION.UPDATEDAT, OffsetDateTime.now())
                .where(ESTATEROLEDEFINITION.ID.eq(row.getId()))
                .returning()
                .fetchSingle();
    }

    private void savePermissions(UUID role, Set<EstatePermissionCode> selected) {
        for (var permission : selected)
            db.insertInto(ESTATEROLEPERMISSION)
                    .set(ESTATEROLEPERMISSION.ROLEID, role)
                    .set(ESTATEROLEPERMISSION.PERMISSION, permission.name())
                    .execute();
    }

    public boolean assigned(UUID role) {
        return db.fetchExists(ESTATEUSER, ESTATEUSER.CUSTOMROLEID.eq(role));
    }

    public Set<UUID> invitationIds(UUID estate, UUID role, boolean lock) {
        var query = db.select(ESTATEINVITATION.ID)
                .from(ESTATEINVITATION)
                .where(ESTATEINVITATION.ESTATEID.eq(estate).and(ESTATEINVITATION.CUSTOMROLEID.eq(role)))
                .orderBy(ESTATEINVITATION.ID);
        return lock ? query.forUpdate().fetchSet(ESTATEINVITATION.ID) : query.fetchSet(ESTATEINVITATION.ID);
    }

    public void delete(UUID estate, UUID role) {
        db.deleteFrom(ESTATEINVITATION)
                .where(ESTATEINVITATION.ESTATEID.eq(estate).and(ESTATEINVITATION.CUSTOMROLEID.eq(role)))
                .execute();
        db.deleteFrom(ESTATEROLEPERMISSION)
                .where(ESTATEROLEPERMISSION.ROLEID.eq(role))
                .execute();
        db.deleteFrom(ESTATEROLEDEFINITION)
                .where(ESTATEROLEDEFINITION.ESTATEID.eq(estate).and(ESTATEROLEDEFINITION.ID.eq(role)))
                .execute();
    }
}
