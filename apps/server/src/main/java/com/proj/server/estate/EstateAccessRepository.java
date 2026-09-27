package com.proj.server.estate;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateaccess.ESTATEACCESS;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class EstateAccessRepository {
    private final DSLContext db;

    public EstateAccessRepository(DSLContext db) {
        this.db = db;
    }

    public List<EstateAccessResponse> listForUser(String userId) {
        return db.select(
                        ESTATE.ID,
                        ESTATE.NAME,
                        ESTATE.CODE,
                        ESTATE.DEACTIVATEDAT,
                        ESTATE.OWNERUSERID,
                        ESTATEACCESS.USERID)
                .from(ESTATE)
                .leftJoin(ESTATEACCESS)
                .on(ESTATEACCESS.ESTATEID.eq(ESTATE.ID).and(ESTATEACCESS.USERID.eq(userId)))
                .orderBy(ESTATE.NAME, ESTATE.ID)
                .fetch(row -> new EstateAccessResponse(
                        row.get(ESTATE.ID),
                        row.get(ESTATE.NAME),
                        row.get(ESTATE.CODE),
                        row.get(ESTATE.DEACTIVATEDAT) == null,
                        userId.equals(row.get(ESTATE.OWNERUSERID)),
                        row.get(ESTATEACCESS.USERID) != null));
    }

    public boolean estateExists(UUID estateId) {
        return db.fetchExists(ESTATE, ESTATE.ID.eq(estateId));
    }

    public void grant(UUID estateId, String userId) {
        db.insertInto(ESTATEACCESS)
                .set(ESTATEACCESS.ESTATEID, estateId)
                .set(ESTATEACCESS.USERID, userId)
                .set(ESTATEACCESS.CREATEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .onConflictDoNothing()
                .execute();
    }

    public void revoke(UUID estateId, String userId) {
        db.deleteFrom(ESTATEACCESS)
                .where(ESTATEACCESS.ESTATEID.eq(estateId).and(ESTATEACCESS.USERID.eq(userId)))
                .execute();
    }
}
