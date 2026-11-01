package com.proj.server.category;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Assetcategoryintervalchange.ASSETCATEGORYINTERVALCHANGE;
import static com.proj.server.db.tables.Assetintervalchange.ASSETINTERVALCHANGE;

import com.proj.server.db.tables.records.AssetcategoryintervalchangeRecord;
import com.proj.server.db.tables.records.AssetintervalchangeRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/** Interval changes are append-only: inserted and read, never updated or deleted. */
@Repository
public class ServiceIntervalRepository {
    private final DSLContext db;

    public ServiceIntervalRepository(DSLContext db) {
        this.db = db;
    }

    /** The latest interval change of each category in the estate, by category code. */
    public Map<String, AssetcategoryintervalchangeRecord> latestCategoryChanges(UUID estateId) {
        return db.select(ASSETCATEGORYINTERVALCHANGE.fields())
                .distinctOn(ASSETCATEGORYINTERVALCHANGE.CATEGORY)
                .from(ASSETCATEGORYINTERVALCHANGE)
                .where(ASSETCATEGORYINTERVALCHANGE.ESTATEID.eq(estateId))
                .orderBy(
                        ASSETCATEGORYINTERVALCHANGE.CATEGORY,
                        ASSETCATEGORYINTERVALCHANGE.CHANGEDAT.desc(),
                        ASSETCATEGORYINTERVALCHANGE.ID.desc())
                .fetchMap(ASSETCATEGORYINTERVALCHANGE.CATEGORY, AssetcategoryintervalchangeRecord.class);
    }

    public Optional<AssetcategoryintervalchangeRecord> latestCategoryChange(UUID estateId, String category) {
        return db.selectFrom(ASSETCATEGORYINTERVALCHANGE)
                .where(ASSETCATEGORYINTERVALCHANGE
                        .ESTATEID
                        .eq(estateId)
                        .and(ASSETCATEGORYINTERVALCHANGE.CATEGORY.eq(category)))
                .orderBy(ASSETCATEGORYINTERVALCHANGE.CHANGEDAT.desc(), ASSETCATEGORYINTERVALCHANGE.ID.desc())
                .limit(1)
                .fetchOptional();
    }

    /** The latest override change of each of the estate's assets, by asset ID. */
    public Map<UUID, AssetintervalchangeRecord> latestAssetChanges(UUID estateId) {
        return db.select(ASSETINTERVALCHANGE.fields())
                .distinctOn(ASSETINTERVALCHANGE.ASSETID)
                .from(ASSETINTERVALCHANGE)
                .join(ASSET)
                .on(ASSET.ID.eq(ASSETINTERVALCHANGE.ASSETID))
                .where(ASSET.ESTATEID.eq(estateId))
                .orderBy(
                        ASSETINTERVALCHANGE.ASSETID,
                        ASSETINTERVALCHANGE.CHANGEDAT.desc(),
                        ASSETINTERVALCHANGE.ID.desc())
                .fetchMap(ASSETINTERVALCHANGE.ASSETID, AssetintervalchangeRecord.class);
    }

    public Optional<AssetintervalchangeRecord> latestAssetChange(UUID assetId) {
        return db.selectFrom(ASSETINTERVALCHANGE)
                .where(ASSETINTERVALCHANGE.ASSETID.eq(assetId))
                .orderBy(ASSETINTERVALCHANGE.CHANGEDAT.desc(), ASSETINTERVALCHANGE.ID.desc())
                .limit(1)
                .fetchOptional();
    }

    public AssetcategoryintervalchangeRecord recordCategory(
            UUID estateId, String category, ServiceInterval interval, String userId, String name) {
        return db.insertInto(ASSETCATEGORYINTERVALCHANGE)
                .set(ASSETCATEGORYINTERVALCHANGE.ID, UUID.randomUUID())
                .set(ASSETCATEGORYINTERVALCHANGE.ESTATEID, estateId)
                .set(ASSETCATEGORYINTERVALCHANGE.CATEGORY, category)
                .set(ASSETCATEGORYINTERVALCHANGE.INTERVALVALUE, interval == null ? null : interval.value())
                .set(
                        ASSETCATEGORYINTERVALCHANGE.INTERVALUNIT,
                        interval == null ? null : interval.unit().name())
                .set(ASSETCATEGORYINTERVALCHANGE.CHANGEDBYUSERID, userId)
                .set(ASSETCATEGORYINTERVALCHANGE.CHANGEDBYNAME, name)
                .set(ASSETCATEGORYINTERVALCHANGE.CHANGEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .returning()
                .fetchSingle();
    }

    public AssetintervalchangeRecord recordAsset(UUID assetId, ServiceInterval interval, String userId, String name) {
        return db.insertInto(ASSETINTERVALCHANGE)
                .set(ASSETINTERVALCHANGE.ID, UUID.randomUUID())
                .set(ASSETINTERVALCHANGE.ASSETID, assetId)
                .set(ASSETINTERVALCHANGE.INTERVALVALUE, interval == null ? null : interval.value())
                .set(
                        ASSETINTERVALCHANGE.INTERVALUNIT,
                        interval == null ? null : interval.unit().name())
                .set(ASSETINTERVALCHANGE.CHANGEDBYUSERID, userId)
                .set(ASSETINTERVALCHANGE.CHANGEDBYNAME, name)
                .set(ASSETINTERVALCHANGE.CHANGEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .returning()
                .fetchSingle();
    }
}
