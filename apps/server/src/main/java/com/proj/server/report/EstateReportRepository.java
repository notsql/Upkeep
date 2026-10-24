package com.proj.server.report;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Issuereport.ISSUEREPORT;
import static com.proj.server.db.tables.Location.LOCATION;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.function;
import static org.jooq.impl.DSL.name;

import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

@Repository
public class EstateReportRepository {
    private final DSLContext db;

    public EstateReportRepository(DSLContext db) {
        this.db = db;
    }

    public Record estate(UUID estateId, boolean lock) {
        var query =
                db.select(ESTATE.OWNERUSERID, ESTATE.DEACTIVATEDAT).from(ESTATE).where(ESTATE.ID.eq(estateId));
        return lock ? query.forUpdate().fetchOne() : query.fetchOne();
    }

    public String role(UUID estateId, String user, boolean lock) {
        var query = db.select(ESTATEUSER.ROLE)
                .from(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(user)));
        return lock ? query.forUpdate().fetchOne(ESTATEUSER.ROLE) : query.fetchOne(ESTATEUSER.ROLE);
    }

    public boolean hasPermission(UUID estateId, String user, com.proj.server.estate.EstatePermissionCode permission) {
        return com.proj.server.estate.EstatePermissions.has(db, estateId, user, permission);
    }

    public Record location(UUID estateId, UUID locationId) {
        var parent = LOCATION.as("parent");
        var grandparent = LOCATION.as("grandparent");
        var active = field(LOCATION.DEACTIVATEDAT
                        .isNull()
                        .and(parent.DEACTIVATEDAT.isNull())
                        .and(grandparent.DEACTIVATEDAT.isNull()))
                .as("active");
        return db.select(LOCATION.TYPE, active)
                .from(LOCATION)
                .leftJoin(parent)
                .on(parent.ID.eq(LOCATION.PARENTID).and(parent.ESTATEID.eq(LOCATION.ESTATEID)))
                .leftJoin(grandparent)
                .on(grandparent.ID.eq(parent.PARENTID).and(grandparent.ESTATEID.eq(LOCATION.ESTATEID)))
                .where(LOCATION.ID.eq(locationId).and(LOCATION.ESTATEID.eq(estateId)))
                .fetchOne();
    }

    public void relocate(UUID estateId, UUID reportId, UUID locationId) {
        db.update(ISSUEREPORT)
                .set(ISSUEREPORT.LOCATIONID, locationId)
                .set(ISSUEREPORT.UPDATEDAT, function(name("clock_timestamp"), ISSUEREPORT.UPDATEDAT.getDataType()))
                .where(ISSUEREPORT.ID.eq(reportId).and(ISSUEREPORT.ESTATEID.eq(estateId)))
                .execute();
    }
}
