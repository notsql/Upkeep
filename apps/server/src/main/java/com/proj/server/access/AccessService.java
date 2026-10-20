package com.proj.server.access;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;

import com.proj.server.resident.ResidentContextResponse;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Service;

/** Estate membership is checked against current database rows, never a JWT resident claim. */
@Service
public class AccessService {
    private final DSLContext db;

    public AccessService(DSLContext db) {
        this.db = db;
    }

    public static Condition managementMembership() {
        return ESTATEUSER.ROLE.in("MEMBER", "COUNCIL", "MANAGER");
    }

    public static Condition managerEstates(String user) {
        return residentEstate(user)
                .not()
                .and(ESTATE.OWNERUSERID
                        .eq(user)
                        .or(ESTATE.ID.in(DSL.select(ESTATEUSER.ESTATEID)
                                .from(ESTATEUSER)
                                .where(ESTATEUSER.USERID.eq(user).and(ESTATEUSER.ROLE.eq("MANAGER"))))));
    }

    public static Condition residentEstate(String user) {
        return ESTATE.ID.in(DSL.select(ESTATEUSER.ESTATEID)
                .from(ESTATEUSER)
                .where(ESTATEUSER.USERID.eq(user).and(ESTATEUSER.ROLE.eq("RESIDENT"))));
    }

    public static Condition managementEstates(String user) {
        return residentEstate(user)
                .not()
                .and(ESTATE.OWNERUSERID
                        .eq(user)
                        .or(ESTATE.ID.in(DSL.select(ESTATEUSER.ESTATEID)
                                .from(ESTATEUSER)
                                .where(ESTATEUSER.USERID.eq(user).and(managementMembership())))));
    }

    public AppAccessResponse context(String user, boolean admin) {
        var rows = db.select(
                        ESTATE.ID,
                        ESTATE.NAME,
                        ESTATE.OWNERUSERID,
                        ESTATE.DEACTIVATEDAT,
                        ESTATEUSER.ROLE,
                        ESTATEUSER.CANINVITEMEMBERS)
                .from(ESTATE)
                .leftJoin(ESTATEUSER)
                .on(ESTATEUSER.ESTATEID.eq(ESTATE.ID).and(ESTATEUSER.USERID.eq(user)))
                .where(ESTATE.OWNERUSERID
                        .eq(user)
                        .or(ESTATEUSER.ROLE.in("MEMBER", "COUNCIL", "RESIDENT", "MANAGER", "CREW")))
                .orderBy(ESTATE.ID)
                .fetch();
        var capabilities = rows.map(row -> {
            boolean resident = "RESIDENT".equals(row.get(ESTATEUSER.ROLE));
            boolean owner = !resident && user.equals(row.get(ESTATE.OWNERUSERID));
            boolean manager = !resident && (owner || "MANAGER".equals(row.get(ESTATEUSER.ROLE)));
            boolean management = !resident
                    && (owner
                            || manager
                            || "MEMBER".equals(row.get(ESTATEUSER.ROLE))
                            || "COUNCIL".equals(row.get(ESTATEUSER.ROLE)));
            boolean active = row.get(ESTATE.DEACTIVATEDAT) == null;
            boolean responder = "MANAGER".equals(row.get(ESTATEUSER.ROLE)) || "CREW".equals(row.get(ESTATEUSER.ROLE));
            return new AppAccessResponse.EstateAccessResponse(
                    row.get(ESTATE.ID),
                    row.get(ESTATE.NAME),
                    resident ? "RESIDENT" : manager ? "MANAGER" : row.get(ESTATEUSER.ROLE),
                    management,
                    manager,
                    owner,
                    active && manager,
                    manager,
                    responder,
                    responder && active);
        });
        var assigned = rows.stream()
                .filter(row -> "RESIDENT".equals(row.get(ESTATEUSER.ROLE)) && row.get(ESTATE.DEACTIVATEDAT) == null)
                .map(row -> new ResidentContextResponse.EstateLabel(row.get(ESTATE.ID), row.get(ESTATE.NAME)))
                .toList();
        boolean manager = capabilities.stream().anyMatch(AppAccessResponse.EstateAccessResponse::canManageEstate);
        boolean workspace = manager
                || capabilities.stream().anyMatch(estate -> estate.canViewManagement() || estate.canViewFaultReports());
        return new AppAccessResponse(
                workspace,
                true,
                false,
                capabilities.stream().anyMatch(estate -> "RESIDENT".equals(estate.role())),
                !assigned.isEmpty(),
                assigned,
                capabilities);
    }

    public boolean hasResidentMembership(String user) {
        return db.fetchExists(ESTATEUSER, ESTATEUSER.USERID.eq(user).and(ESTATEUSER.ROLE.eq("RESIDENT")));
    }
}
