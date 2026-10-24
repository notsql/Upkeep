package com.proj.server.estate;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;

import com.proj.server.access.AccessService;
import com.proj.server.db.tables.records.EstateRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class EstateRepository {
    public boolean isReportResponder(UUID estateId, String user) {
        return db.fetchExists(
                        ESTATEUSER,
                        ESTATEUSER
                                .ESTATEID
                                .eq(estateId)
                                .and(ESTATEUSER.USERID.eq(user))
                                .and(ESTATEUSER.ROLE.in("MANAGER", "CREW")))
                || hasPermission(estateId, user, EstatePermissionCode.VIEW_FAULT_REPORTS);
    }

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
        denyResident(id, user);
        return db.selectFrom(ESTATE)
                .where(ESTATE.ID.eq(id).and(accessibleTo(user)))
                .fetchOptional()
                .map(row -> response(row, user));
    }

    public Optional<EstateResponse> findOwned(UUID id, String owner, boolean lock) {
        denyResident(id, owner);
        if (isCustom(id, owner) && !db.fetchExists(ESTATE, ESTATE.ID.eq(id).and(ESTATE.OWNERUSERID.eq(owner))))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This operation requires estate ownership.");
        var query = db.selectFrom(ESTATE).where(ESTATE.ID.eq(id).and(ESTATE.OWNERUSERID.eq(owner)));
        return (lock ? query.forUpdate().fetchOptional() : query.fetchOptional()).map(row -> response(row, owner));
    }

    @org.springframework.transaction.annotation.Transactional
    public EstateResponse create(String owner, EstateRequest request) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        var row = db.insertInto(ESTATE)
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
                .fetchSingle();
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, row.getId())
                .set(ESTATEUSER.USERID, owner)
                .set(ESTATEUSER.ROLE, "MANAGER")
                .set(ESTATEUSER.CREATEDAT, now)
                .execute();
        return response(row, owner);
    }

    // Membership changes and ownership transfers lock this same row before writing.
    // Check editing authority after acquiring it, using the current membership.
    public void lock(UUID id) {
        db.select(ESTATE.ID)
                .from(ESTATE)
                .where(ESTATE.ID.eq(id))
                .forUpdate()
                .fetchOptional()
                .orElseThrow(() -> new EstateException(HttpStatus.NOT_FOUND, "Estate not found."));
    }

    public Optional<EstateResponse> findAccessibleForUpdate(UUID id, String user) {
        // Lock first, then resolve access from current membership after any wait.
        return db.select(ESTATE.ID)
                .from(ESTATE)
                .where(ESTATE.ID.eq(id))
                .forUpdate()
                .fetchOptional()
                .flatMap(ignored -> findAccessible(id, user));
    }

    public EstateResponse update(UUID id, String user, EstateRequest request) {
        return response(
                db.update(ESTATE)
                        .set(ESTATE.NAME, request.name())
                        .set(ESTATE.CODE, request.code())
                        .set(ESTATE.ADDRESS, request.address())
                        .set(ESTATE.POSTALCODE, request.postalCode())
                        .set(ESTATE.DESCRIPTION, request.description())
                        .set(ESTATE.UPDATEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                        .where(ESTATE.ID
                                .eq(id)
                                .and(AccessService.managerEstates(user)
                                        .or(EstatePermissions.customEstates(user, EstatePermissionCode.EDIT_ESTATE))))
                        .returning()
                        .fetchSingle(),
                user);
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
        return AccessService.managementEstates(user);
    }

    public boolean hasPermission(UUID id, String user, EstatePermissionCode permission) {
        return EstatePermissions.has(db, id, user, permission);
    }

    public boolean isCustom(UUID id, String user) {
        return db.fetchExists(
                ESTATEUSER,
                ESTATEUSER.ESTATEID.eq(id).and(ESTATEUSER.USERID.eq(user)).and(ESTATEUSER.ROLE.eq("CUSTOM")));
    }

    private void denyResident(UUID id, String user) {
        if (isCustom(id, user) && !hasPermission(id, user, EstatePermissionCode.VIEW_ESTATE))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Viewing estate details requires VIEW_ESTATE.");
        if (db.fetchExists(ESTATE, ESTATE.ID.eq(id).and(AccessService.residentEstate(user)))) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN, "Resident membership does not grant management access.");
        }
    }

    private EstateResponse response(EstateRecord row, String user) {
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
                row.getOwneruserid().equals(user),
                row.getDeactivatedat() == null
                        && (isManager(row.getId(), user)
                                || hasPermission(row.getId(), user, EstatePermissionCode.INVITE_MEMBERS)),
                isManager(row.getId(), user));
    }

    public boolean isManager(UUID estateId, String user) {
        return db.fetchExists(ESTATE, ESTATE.ID.eq(estateId).and(AccessService.managerEstates(user)));
    }
}
