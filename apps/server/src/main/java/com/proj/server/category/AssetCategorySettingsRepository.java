package com.proj.server.category;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Assetcategory.ASSETCATEGORY;
import static com.proj.server.db.tables.Assetcategoryflagchange.ASSETCATEGORYFLAGCHANGE;

import com.proj.server.db.tables.records.AssetcategoryRecord;
import com.proj.server.db.tables.records.AssetcategoryflagchangeRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

/** Flag changes are append-only: inserted and read, never updated or deleted. */
@Repository
public class AssetCategorySettingsRepository {
    private final DSLContext db;

    public AssetCategorySettingsRepository(DSLContext db) {
        this.db = db;
    }

    public List<AssetcategoryRecord> categories() {
        return db.selectFrom(ASSETCATEGORY)
                .orderBy(ASSETCATEGORY.LABEL, ASSETCATEGORY.CODE)
                .fetch();
    }

    public Optional<AssetcategoryRecord> category(String code) {
        return db.selectFrom(ASSETCATEGORY).where(ASSETCATEGORY.CODE.eq(code)).fetchOptional();
    }

    /** The latest change of each category in the estate, by category code. */
    public Map<String, AssetcategoryflagchangeRecord> latestChanges(UUID estateId) {
        return db.select(ASSETCATEGORYFLAGCHANGE.fields())
                .distinctOn(ASSETCATEGORYFLAGCHANGE.CATEGORY)
                .from(ASSETCATEGORYFLAGCHANGE)
                .where(ASSETCATEGORYFLAGCHANGE.ESTATEID.eq(estateId))
                .orderBy(
                        ASSETCATEGORYFLAGCHANGE.CATEGORY,
                        ASSETCATEGORYFLAGCHANGE.CHANGEDAT.desc(),
                        ASSETCATEGORYFLAGCHANGE.ID.desc())
                .fetchMap(ASSETCATEGORYFLAGCHANGE.CATEGORY, AssetcategoryflagchangeRecord.class);
    }

    public Optional<AssetcategoryflagchangeRecord> latestChange(UUID estateId, String category) {
        return db.selectFrom(ASSETCATEGORYFLAGCHANGE)
                .where(ASSETCATEGORYFLAGCHANGE.ESTATEID.eq(estateId).and(ASSETCATEGORYFLAGCHANGE.CATEGORY.eq(category)))
                .orderBy(ASSETCATEGORYFLAGCHANGE.CHANGEDAT.desc(), ASSETCATEGORYFLAGCHANGE.ID.desc())
                .limit(1)
                .fetchOptional();
    }

    /** Active (not retired) assets per category code; categories with none are absent. */
    public Map<String, Integer> activeAssetCounts(UUID estateId) {
        return db.select(ASSET.CATEGORY, DSL.count())
                .from(ASSET)
                .where(ASSET.ESTATEID.eq(estateId).and(ASSET.DEACTIVATEDAT.isNull()))
                .groupBy(ASSET.CATEGORY)
                .fetchMap(ASSET.CATEGORY, DSL.count());
    }

    public AssetcategoryflagchangeRecord record(
            UUID estateId, String category, boolean failsSilently, String userId, String name) {
        return db.insertInto(ASSETCATEGORYFLAGCHANGE)
                .set(ASSETCATEGORYFLAGCHANGE.ID, UUID.randomUUID())
                .set(ASSETCATEGORYFLAGCHANGE.ESTATEID, estateId)
                .set(ASSETCATEGORYFLAGCHANGE.CATEGORY, category)
                .set(ASSETCATEGORYFLAGCHANGE.FAILSSILENTLY, failsSilently)
                .set(ASSETCATEGORYFLAGCHANGE.CHANGEDBYUSERID, userId)
                .set(ASSETCATEGORYFLAGCHANGE.CHANGEDBYNAME, name)
                .set(ASSETCATEGORYFLAGCHANGE.CHANGEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .returning()
                .fetchSingle();
    }
}
