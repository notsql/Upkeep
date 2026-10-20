package com.proj.server.report;

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
        return db.fetchOne(
                "select \"ownerUserId\", \"deactivatedAt\" from \"Estate\" where id=?" + (lock ? " for update" : ""),
                estateId);
    }

    public String role(UUID estateId, String user, boolean lock) {
        var row = db.fetchOne(
                "select role from \"EstateUser\" where \"estateId\"=? and \"userId\"=?" + (lock ? " for update" : ""),
                estateId,
                user);
        return row == null ? null : row.get("role", String.class);
    }

    public Record location(UUID estateId, UUID locationId) {
        return db.fetchOne("""
                select location.type,
                    (location."deactivatedAt" is null and parent."deactivatedAt" is null
                     and grandparent."deactivatedAt" is null) as active
                from "Location" location
                left join "Location" parent on parent.id=location."parentId" and parent."estateId"=location."estateId"
                left join "Location" grandparent on grandparent.id=parent."parentId" and grandparent."estateId"=location."estateId"
                where location.id=? and location."estateId"=?
                """, locationId, estateId);
    }

    public void relocate(UUID estateId, UUID reportId, UUID locationId) {
        db.execute("""
                update "IssueReport" set "locationId"=?, "updatedAt"=clock_timestamp()
                where id=? and "estateId"=?
                """, locationId, reportId, estateId);
    }
}
