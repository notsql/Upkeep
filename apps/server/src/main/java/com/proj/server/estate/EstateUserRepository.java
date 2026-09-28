package com.proj.server.estate;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class EstateUserRepository {
    private final DSLContext db;

    public EstateUserRepository(DSLContext db) {
        this.db = db;
    }

    public List<EstateUserResponse> listForUser(String userId) {
        return db.select(
                        ESTATE.ID,
                        ESTATE.NAME,
                        ESTATE.CODE,
                        ESTATE.DEACTIVATEDAT,
                        ESTATE.OWNERUSERID,
                        ESTATEUSER.USERID)
                .from(ESTATE)
                .leftJoin(ESTATEUSER)
                .on(ESTATEUSER.ESTATEID.eq(ESTATE.ID).and(ESTATEUSER.USERID.eq(userId)))
                .orderBy(ESTATE.NAME, ESTATE.ID)
                .fetch(row -> new EstateUserResponse(
                        row.get(ESTATE.ID),
                        row.get(ESTATE.NAME),
                        row.get(ESTATE.CODE),
                        row.get(ESTATE.DEACTIVATEDAT) == null,
                        userId.equals(row.get(ESTATE.OWNERUSERID)),
                        row.get(ESTATEUSER.USERID) != null));
    }

    public boolean estateExists(UUID estateId) {
        return db.fetchExists(ESTATE, ESTATE.ID.eq(estateId));
    }

    public void add(UUID estateId, String userId) {
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estateId)
                .set(ESTATEUSER.USERID, userId)
                .set(ESTATEUSER.CREATEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .onConflictDoNothing()
                .execute();
    }

    public void remove(UUID estateId, String userId) {
        db.deleteFrom(ESTATEUSER)
                .where(ESTATEUSER.ESTATEID.eq(estateId).and(ESTATEUSER.USERID.eq(userId)))
                .execute();
    }
}
