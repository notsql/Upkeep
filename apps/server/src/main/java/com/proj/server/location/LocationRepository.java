package com.proj.server.location;

import static com.proj.server.db.tables.Location.LOCATION;

import com.proj.server.db.tables.records.LocationRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

@Repository
public class LocationRepository {
    private final DSLContext db;

    public LocationRepository(DSLContext db) {
        this.db = db;
    }

    /** Active locations, siblings in display order: levels by position, everything else by name. */
    public List<LocationResponse> listActive(UUID estateId) {
        return db.selectFrom(LOCATION)
                .where(LOCATION.ESTATEID.eq(estateId).and(LOCATION.DEACTIVATEDAT.isNull()))
                .orderBy(LOCATION.SORTORDER.asc().nullsLast(), DSL.lower(LOCATION.NAME), LOCATION.ID)
                .fetch(LocationRepository::response);
    }

    /** Includes deactivated locations, so callers can tell "missing" from "deactivated". */
    public Optional<LocationResponse> find(UUID id, UUID estateId) {
        return db.selectFrom(LOCATION)
                .where(LOCATION.ID.eq(id).and(LOCATION.ESTATEID.eq(estateId)))
                .fetchOptional()
                .map(LocationRepository::response);
    }

    /** Case-insensitive, among active siblings. A null parentId means the estate's blocks. */
    public boolean nameTaken(UUID estateId, UUID parentId, String name, UUID excludeId) {
        var parent = parentId == null ? LOCATION.PARENTID.isNull() : LOCATION.PARENTID.eq(parentId);
        return db.fetchExists(
                LOCATION,
                active(excludeId)
                        .and(LOCATION.ESTATEID.eq(estateId))
                        .and(parent)
                        .and(DSL.lower(LOCATION.NAME).eq(name.toLowerCase(Locale.ROOT))));
    }

    public boolean sortOrderTaken(UUID blockId, int sortOrder, UUID excludeId) {
        return db.fetchExists(
                LOCATION, active(excludeId).and(LOCATION.PARENTID.eq(blockId)).and(LOCATION.SORTORDER.eq(sortOrder)));
    }

    public boolean hasActiveChildren(UUID id) {
        return db.fetchExists(LOCATION, active(null).and(LOCATION.PARENTID.eq(id)));
    }

    public LocationResponse create(UUID estateId, CreateLocationRequest request, LocationType parentType) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        return response(db.insertInto(LOCATION)
                .set(LOCATION.ID, UUID.randomUUID())
                .set(LOCATION.ESTATEID, estateId)
                .set(LOCATION.TYPE, request.type().name())
                .set(LOCATION.PARENTID, request.parentId())
                .set(LOCATION.PARENTTYPE, parentType == null ? null : parentType.name())
                .set(LOCATION.NAME, request.name())
                .set(LOCATION.SORTORDER, request.sortOrder())
                .set(LOCATION.CREATEDAT, now)
                .set(LOCATION.UPDATEDAT, now)
                .returning()
                .fetchSingle());
    }

    public LocationResponse update(UUID id, UpdateLocationRequest request, LocationType parentType) {
        return response(db.update(LOCATION)
                .set(LOCATION.PARENTID, request.parentId())
                .set(LOCATION.PARENTTYPE, parentType == null ? null : parentType.name())
                .set(LOCATION.NAME, request.name())
                .set(LOCATION.SORTORDER, request.sortOrder())
                .set(LOCATION.UPDATEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .where(LOCATION.ID.eq(id))
                .returning()
                .fetchSingle());
    }

    public LocationResponse deactivate(UUID id) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        return response(db.update(LOCATION)
                .set(LOCATION.DEACTIVATEDAT, now)
                .set(LOCATION.UPDATEDAT, now)
                .where(LOCATION.ID.eq(id))
                .returning()
                .fetchSingle());
    }

    private static Condition active(UUID excludeId) {
        var condition = LOCATION.DEACTIVATEDAT.isNull();
        return excludeId == null ? condition : condition.and(LOCATION.ID.ne(excludeId));
    }

    private static LocationResponse response(LocationRecord row) {
        return new LocationResponse(
                row.getId(),
                LocationType.valueOf(row.getType()),
                row.getParentid(),
                row.getName(),
                row.getSortorder(),
                row.getCreatedat(),
                row.getUpdatedat(),
                row.getDeactivatedat());
    }
}
