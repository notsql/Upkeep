package com.proj.server.estate;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;

import com.proj.server.db.tables.records.EstateRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

@Repository
public class EstateRepository {
    private final DSLContext db;

    public EstateRepository(DSLContext db) {
        this.db = db;
    }

    public List<EstateResponse> listAccessible(String user, EstateStatus status) {
        var condition = accessibleTo(user);
        if (status == EstateStatus.ACTIVE) {
            condition = condition.and(ESTATE.DEACTIVATEDAT.isNull());
        }
        if (status == EstateStatus.INACTIVE) {
            condition = condition.and(ESTATE.DEACTIVATEDAT.isNotNull());
        }
        return db.selectFrom(ESTATE)
                .where(condition)
                .orderBy(ESTATE.CREATEDAT.desc(), ESTATE.ID)
                .fetch(row -> response(row, user));
    }

    public Optional<EstateResponse> findAccessible(UUID id, String user) {
        return db.selectFrom(ESTATE)
                .where(ESTATE.ID.eq(id).and(accessibleTo(user)))
                .fetchOptional()
                .map(row -> response(row, user));
    }

    public Optional<EstateResponse> findOwned(UUID id, String owner, boolean lock) {
        var query = db.selectFrom(ESTATE).where(ESTATE.ID.eq(id).and(ESTATE.OWNERUSERID.eq(owner)));
        return (lock ? query.forUpdate().fetchOptional() : query.fetchOptional()).map(row -> response(row, owner));
    }

    public EstateResponse create(String owner, EstateRequest request) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        return response(
                db.insertInto(ESTATE)
                        .set(ESTATE.ID, UUID.randomUUID())
                        .set(ESTATE.OWNERUSERID, owner)
                        .set(ESTATE.NAME, request.name())
                        .set(ESTATE.CODE, request.code())
                        .set(ESTATE.ADDRESS, request.address())
                        .set(ESTATE.POSTALCODE, request.postalCode())
                        .set(ESTATE.DESCRIPTION, request.description())
                        .set(ESTATE.CREATEDAT, now)
                        .set(ESTATE.UPDATEDAT, now)
                        .returning()
                        .fetchSingle(),
                owner);
    }

    public EstateResponse update(UUID id, String owner, EstateRequest request) {
        return response(
                db.update(ESTATE)
                        .set(ESTATE.NAME, request.name())
                        .set(ESTATE.CODE, request.code())
                        .set(ESTATE.ADDRESS, request.address())
                        .set(ESTATE.POSTALCODE, request.postalCode())
                        .set(ESTATE.DESCRIPTION, request.description())
                        .set(ESTATE.UPDATEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                        .where(ESTATE.ID.eq(id).and(ESTATE.OWNERUSERID.eq(owner)))
                        .returning()
                        .fetchSingle(),
                owner);
    }

    public EstateResponse deactivate(UUID id, String owner) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        return response(
                db.update(ESTATE)
                        .set(ESTATE.DEACTIVATEDAT, now)
                        .set(ESTATE.UPDATEDAT, now)
                        .where(ESTATE.ID.eq(id).and(ESTATE.OWNERUSERID.eq(owner)))
                        .returning()
                        .fetchSingle(),
                owner);
    }

    // Estates the user owns, or has been granted by an admin (decision 0012).
    private static Condition accessibleTo(String user) {
        return ESTATE.OWNERUSERID
                .eq(user)
                .or(ESTATE.ID.in(
                        DSL.select(ESTATEUSER.ESTATEID).from(ESTATEUSER).where(ESTATEUSER.USERID.eq(user))));
    }

    private static EstateResponse response(EstateRecord row, String user) {
        return new EstateResponse(
                row.getId(),
                row.getName(),
                row.getCode(),
                row.getAddress(),
                row.getPostalcode(),
                row.getDescription(),
                row.getCreatedat(),
                row.getUpdatedat(),
                row.getDeactivatedat(),
                row.getOwneruserid().equals(user));
    }
}
