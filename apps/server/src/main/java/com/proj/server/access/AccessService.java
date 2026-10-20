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
        return ESTATEUSER.ROLE.in("MEMBER", "COUNCIL");
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
                .where(ESTATE.OWNERUSERID.eq(user).or(ESTATEUSER.ROLE.in("MEMBER", "COUNCIL", "RESIDENT")))
                .orderBy(ESTATE.ID)
                .fetch();
        var capabilities = rows.map(row -> {
            boolean resident = "RESIDENT".equals(row.get(ESTATEUSER.ROLE));
            boolean owner = !resident && user.equals(row.get(ESTATE.OWNERUSERID));
            boolean management = !resident
                    && (owner
                            || "MEMBER".equals(row.get(ESTATEUSER.ROLE))
                            || "COUNCIL".equals(row.get(ESTATEUSER.ROLE)));
            boolean active = row.get(ESTATE.DEACTIVATEDAT) == null;
            return new AppAccessResponse.EstateAccessResponse(
                    row.get(ESTATE.ID),
                    resident ? "RESIDENT" : owner ? "OWNER" : row.get(ESTATEUSER.ROLE),
                    management,
                    owner,
                    owner,
                    active && management && (owner || Boolean.TRUE.equals(row.get(ESTATEUSER.CANINVITEMEMBERS))),
                    owner);
        });
        var assigned = rows.stream()
                .filter(row -> "RESIDENT".equals(row.get(ESTATEUSER.ROLE)) && row.get(ESTATE.DEACTIVATEDAT) == null)
                .findFirst()
                .map(row -> new ResidentContextResponse.EstateLabel(row.get(ESTATE.ID), row.get(ESTATE.NAME)))
                .orElse(null);
        boolean workspace =
                admin || capabilities.stream().anyMatch(AppAccessResponse.EstateAccessResponse::canViewManagement);
        return new AppAccessResponse(
                workspace,
                workspace,
                admin,
                capabilities.stream().anyMatch(estate -> "RESIDENT".equals(estate.role())),
                assigned != null,
                assigned,
                capabilities);
    }

    public boolean hasResidentMembership(String user) {
        return db.fetchExists(ESTATEUSER, ESTATEUSER.USERID.eq(user).and(ESTATEUSER.ROLE.eq("RESIDENT")));
    }
}
