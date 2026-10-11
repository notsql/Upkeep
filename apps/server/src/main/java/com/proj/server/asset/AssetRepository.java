package com.proj.server.asset;

import static com.proj.server.db.tables.Asset.ASSET;

import com.proj.server.catalogue.CatalogueRepository;
import com.proj.server.db.tables.records.AssetRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
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
        var modelId = catalogue.modelId(manufacturerId, request.category().name(), request.model());
        return db.insertInto(ASSET)
                .set(ASSET.ID, UUID.randomUUID())
                .set(ASSET.ESTATEID, estateId)
                .set(ASSET.LOCATIONID, request.locationId())
                .set(ASSET.REFERENCE, reference)
                .set(ASSET.NAME, request.name())
                .set(ASSET.CATEGORY, request.category().name())
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
        var modelId = catalogue.modelId(manufacturerId, request.category().name(), request.model());
        return db.update(ASSET)
                .set(ASSET.LOCATIONID, request.locationId())
                .set(ASSET.NAME, request.name())
                .set(ASSET.CATEGORY, request.category().name())
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
            AssetCategory category,
            UUID locationId,
            AssetConditionFilter condition,
            AssetStatus status) {
        String categoryName = category == null ? null : category.name();
        String conditionName = condition == null ? null : condition.name();
        return db.resultQuery(
                        """
            with recursive paths as (
                select id, "parentId", name::text path from "Location" where "estateId"=? and "parentId" is null
                union all
                select l.id, l."parentId", p.path || ' › ' || l.name from "Location" l join paths p on p.id=l."parentId" where l."estateId"=?
            ), descendants as (
                select id from "Location" where "estateId"=? and id=?
                union all
                select l.id from "Location" l join descendants d on l."parentId"=d.id where l."estateId"=?
            )
            select a.*, p.path, c.condition current_condition, mf.name manufacturer_name, am.name model_name
            from "Asset" a join paths p on p.id=a."locationId"
            left join "Manufacturer" mf on mf.id=a."manufacturerId"
            left join "AssetModel" am on am.id=a."modelId"
            left join lateral (
                select condition from "AssetAssessment" where "assetId"=a.id
                order by "assessedOn" desc, "createdAt" desc, id limit 1
            ) c on true
            where a."estateId"=?
            and (?::text is null or strpos(lower(a.name), lower(?))>0 or strpos(lower(a.reference), lower(?))>0)
            and (?::text is null or a.category=?)
            and (?::uuid is null or a."locationId" in (select id from descendants))
            and (?::text is null or c.condition=? or (?='UNASSESSED' and c.condition is null))
            and (?='ALL' or (?='ACTIVE' and a."deactivatedAt" is null) or (?='INACTIVE' and a."deactivatedAt" is not null))
            order by a.reference, a.id
            """,
                        estateId,
                        estateId,
                        estateId,
                        locationId,
                        estateId,
                        estateId,
                        q,
                        q,
                        q,
                        categoryName,
                        categoryName,
                        locationId,
                        conditionName,
                        conditionName,
                        conditionName,
                        status.name(),
                        status.name(),
                        status.name())
                .fetch()
                .map(row -> {
                    String value = row.get("current_condition", String.class);
                    return response(
                            row.into(ASSET),
                            row.get("path", String.class),
                            row.get("manufacturer_name", String.class),
                            row.get("model_name", String.class),
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
                AssetCategory.valueOf(row.getCategory()),
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
