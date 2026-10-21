package com.proj.server.asset;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Assetassessment.ASSETASSESSMENT;
import static com.proj.server.db.tables.Assetmodel.ASSETMODEL;
import static com.proj.server.db.tables.Location.LOCATION;
import static com.proj.server.db.tables.Manufacturer.MANUFACTURER;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.lateral;
import static org.jooq.impl.DSL.lower;
import static org.jooq.impl.DSL.name;
import static org.jooq.impl.DSL.noCondition;
import static org.jooq.impl.DSL.position;
import static org.jooq.impl.DSL.table;
import static org.jooq.impl.DSL.trueCondition;

import com.proj.server.catalogue.CatalogueRepository;
import com.proj.server.db.tables.records.AssetRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.impl.SQLDataType;
import org.springframework.stereotype.Repository;

/** Persists asset lifecycle state and projects the register in one bulk query. */
@Repository
public class AssetRepository {
    private final DSLContext db;
    private final CatalogueRepository catalogue;

    public AssetRepository(DSLContext db, CatalogueRepository catalogue) {
        this.db = db;
        this.catalogue = catalogue;
    }

    /** Includes deactivated assets, so callers can tell "missing" from "deactivated". */
    public Optional<AssetRecord> find(UUID id, UUID estateId, boolean lock) {
        var query = db.selectFrom(ASSET).where(ASSET.ID.eq(id).and(ASSET.ESTATEID.eq(estateId)));
        return lock ? query.forUpdate().fetchOptional() : query.fetchOptional();
    }

    /** Every asset the estate has ever had. Rows are never deleted, so this only grows. */
    public int count(UUID estateId) {
        return db.fetchCount(ASSET, ASSET.ESTATEID.eq(estateId));
    }

    public AssetRecord create(UUID estateId, String reference, CreateAssetRequest request) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        var manufacturerId = catalogue.manufacturerId(request.manufacturer());
        var modelId = catalogue.modelId(manufacturerId, request.category(), request.model());
        return db.insertInto(ASSET)
                .set(ASSET.ID, UUID.randomUUID())
                .set(ASSET.ESTATEID, estateId)
                .set(ASSET.LOCATIONID, request.locationId())
                .set(ASSET.REFERENCE, reference)
                .set(ASSET.NAME, request.name())
                .set(ASSET.CATEGORY, request.category())
                .set(ASSET.INSTALLEDON, request.installedOn())
                .set(ASSET.MANUFACTURERID, manufacturerId)
                .set(ASSET.MODELID, modelId)
                .set(ASSET.SERIALNUMBER, request.serialNumber())
                .set(ASSET.CREATEDAT, now)
                .set(ASSET.UPDATEDAT, now)
                .returning()
                .fetchSingle();
    }

    public AssetRecord update(UUID id, UpdateAssetRequest request) {
        var manufacturerId = catalogue.manufacturerId(request.manufacturer());
        var modelId = catalogue.modelId(manufacturerId, request.category(), request.model());
        return db.update(ASSET)
                .set(ASSET.LOCATIONID, request.locationId())
                .set(ASSET.NAME, request.name())
                .set(ASSET.CATEGORY, request.category())
                .set(ASSET.INSTALLEDON, request.installedOn())
                .set(ASSET.MANUFACTURERID, manufacturerId)
                .set(ASSET.MODELID, modelId)
                .set(ASSET.SERIALNUMBER, request.serialNumber())
                .set(ASSET.UPDATEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .where(ASSET.ID.eq(id))
                .returning()
                .fetchSingle();
    }

    public AssetCondition currentCondition(UUID id) {
        var a = com.proj.server.db.tables.Assetassessment.ASSETASSESSMENT;
        String value = db.select(a.CONDITION)
                .from(a)
                .where(a.ASSETID.eq(id))
                .orderBy(a.ASSESSEDON.desc(), a.CREATEDAT.desc(), a.ID)
                .limit(1)
                .fetchOne(0, String.class);
        return value == null ? null : AssetCondition.valueOf(value);
    }

    public java.util.List<AssetResponse> list(
            UUID estateId,
            String q,
            String category,
            UUID locationId,
            AssetConditionFilter condition,
            AssetStatus status) {
        var child = LOCATION.as("child");
        var pathId = field(name("paths", "id"), LOCATION.ID.getDataType());
        var path = field(name("paths", "path"), SQLDataType.CLOB);
        var paths = name("paths")
                .fields("id", "parentId", "path")
                .as(db.select(LOCATION.ID, LOCATION.PARENTID, LOCATION.NAME.cast(SQLDataType.CLOB))
                        .from(LOCATION)
                        .where(LOCATION.ESTATEID.eq(estateId).and(LOCATION.PARENTID.isNull()))
                        .unionAll(db.select(
                                        child.ID,
                                        child.PARENTID,
                                        path.concat(" › ").concat(child.NAME))
                                .from(child)
                                .join(table(name("paths")))
                                .on(pathId.eq(child.PARENTID))
                                .where(child.ESTATEID.eq(estateId))));
        var descendantId = field(name("descendants", "id"), LOCATION.ID.getDataType());
        var descendants = name("descendants")
                .fields("id")
                .as(db.select(LOCATION.ID)
                        .from(LOCATION)
                        .where(LOCATION.ESTATEID.eq(estateId).and(LOCATION.ID.eq(locationId)))
                        .unionAll(db.select(child.ID)
                                .from(child)
                                .join(table(name("descendants")))
                                .on(child.PARENTID.eq(descendantId))
                                .where(child.ESTATEID.eq(estateId))));
        var latestAssessment = lateral(db.select(ASSETASSESSMENT.CONDITION)
                        .from(ASSETASSESSMENT)
                        .where(ASSETASSESSMENT.ASSETID.eq(ASSET.ID))
                        .orderBy(
                                ASSETASSESSMENT.ASSESSEDON.desc(), ASSETASSESSMENT.CREATEDAT.desc(), ASSETASSESSMENT.ID)
                        .limit(1))
                .as("latest_assessment");
        var currentCondition = latestAssessment.field(ASSETASSESSMENT.CONDITION);
        var filters = ASSET.ESTATEID.eq(estateId);
        if (q != null) {
            filters = filters.and(position(lower(ASSET.NAME), lower(q))
                    .gt(0)
                    .or(position(lower(ASSET.REFERENCE), lower(q)).gt(0)));
        }
        if (category != null) filters = filters.and(ASSET.CATEGORY.eq(category));
        if (locationId != null) {
            filters = filters.and(ASSET.LOCATIONID.in(db.select(descendantId).from(descendants)));
        }
        if (condition != null) {
            filters = filters.and(
                    condition == AssetConditionFilter.UNASSESSED
                            ? currentCondition.isNull()
                            : currentCondition.eq(condition.name()));
        }
        filters = filters.and(
                switch (status) {
                    case ACTIVE -> ASSET.DEACTIVATEDAT.isNull();
                    case INACTIVE -> ASSET.DEACTIVATEDAT.isNotNull();
                    case ALL -> noCondition();
                });
        return db.withRecursive(paths, descendants)
                .select(ASSET.fields())
                .select(path, currentCondition, MANUFACTURER.NAME, ASSETMODEL.NAME)
                .from(ASSET)
                .join(paths)
                .on(pathId.eq(ASSET.LOCATIONID))
                .leftJoin(MANUFACTURER)
                .on(MANUFACTURER.ID.eq(ASSET.MANUFACTURERID))
                .leftJoin(ASSETMODEL)
                .on(ASSETMODEL.ID.eq(ASSET.MODELID))
                .leftJoin(latestAssessment)
                .on(trueCondition())
                .where(filters)
                .orderBy(ASSET.REFERENCE, ASSET.ID)
                .fetch()
                .map(row -> {
                    String value = row.get(currentCondition);
                    return response(
                            row.into(ASSET),
                            row.get(path),
                            row.get(MANUFACTURER.NAME),
                            row.get(ASSETMODEL.NAME),
                            value == null ? null : AssetCondition.valueOf(value));
                });
    }

    static AssetResponse response(
            AssetRecord row, String path, String manufacturer, String model, AssetCondition condition) {
        return new AssetResponse(
                row.getId(),
                row.getEstateid(),
                row.getReference(),
                row.getName(),
                row.getCategory(),
                row.getLocationid(),
                path,
                row.getInstalledon(),
                manufacturer,
                model,
                row.getSerialnumber(),
                row.getCreatedat(),
                row.getUpdatedat(),
                row.getDeactivatedat(),
                row.getRetiredon(),
                row.getRetirementreason(),
                row.getLifecycleversion(),
                condition);
    }

    public java.util.List<AssetLifecycleEventResponse> events(UUID id) {
        var e = com.proj.server.db.tables.Assetlifecycleevent.ASSETLIFECYCLEEVENT;
        return db.selectFrom(e)
                .where(e.ASSETID.eq(id))
                .orderBy(e.LIFECYCLEVERSION.desc())
                .fetch(row -> new AssetLifecycleEventResponse(
                        row.getId(),
                        row.getAction(),
                        row.getOccurredat(),
                        row.getActoruserid(),
                        row.getPreviousdeactivatedat(),
                        row.getPreviousretiredon(),
                        row.getPreviousretirementreason(),
                        row.getDeactivatedat(),
                        row.getRetiredon(),
                        row.getRetirementreason(),
                        row.getLifecycleversion()));
    }

    public AssetRecord transition(
            AssetRecord before, String action, String actor, java.time.LocalDate date, String reason) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        var at = action.equals("RESTORED") ? null : before.getDeactivatedat() == null ? now : before.getDeactivatedat();
        int version = before.getLifecycleversion() + 1;
        var result = db.update(ASSET)
                .set(ASSET.DEACTIVATEDAT, at)
                .set(ASSET.RETIREDON, date)
                .set(ASSET.RETIREMENTREASON, reason)
                .set(ASSET.LIFECYCLEVERSION, version)
                .set(ASSET.UPDATEDAT, now)
                .where(ASSET.ID.eq(before.getId()))
                .returning()
                .fetchSingle();
        var e = com.proj.server.db.tables.Assetlifecycleevent.ASSETLIFECYCLEEVENT;
        db.insertInto(e)
                .set(e.ID, UUID.randomUUID())
                .set(e.ESTATEID, before.getEstateid())
                .set(e.ASSETID, before.getId())
                .set(e.ACTION, action)
                .set(e.OCCURREDAT, now)
                .set(e.ACTORUSERID, actor)
                .set(e.PREVIOUSDEACTIVATEDAT, before.getDeactivatedat())
                .set(e.PREVIOUSRETIREDON, before.getRetiredon())
                .set(e.PREVIOUSRETIREMENTREASON, before.getRetirementreason())
                .set(e.DEACTIVATEDAT, at)
                .set(e.RETIREDON, date)
                .set(e.RETIREMENTREASON, reason)
                .set(e.LIFECYCLEVERSION, version)
                .execute();
        return result;
    }
}
