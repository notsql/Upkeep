package com.proj.server.asset;

import static com.proj.server.db.tables.Asset.ASSET;

import com.proj.server.db.tables.records.AssetRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/** Returns rows, not responses: the service adds each asset's location path. */
@Repository
public class AssetRepository {
    private final DSLContext db;

    public AssetRepository(DSLContext db) {
        this.db = db;
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
        return db.insertInto(ASSET)
                .set(ASSET.ID, UUID.randomUUID())
                .set(ASSET.ESTATEID, estateId)
                .set(ASSET.LOCATIONID, request.locationId())
                .set(ASSET.REFERENCE, reference)
                .set(ASSET.NAME, request.name())
                .set(ASSET.CATEGORY, request.category().name())
                .set(ASSET.INSTALLEDON, request.installedOn())
                .set(ASSET.MANUFACTURER, request.manufacturer())
                .set(ASSET.MODEL, request.model())
                .set(ASSET.SERIALNUMBER, request.serialNumber())
                .set(ASSET.CREATEDAT, now)
                .set(ASSET.UPDATEDAT, now)
                .returning()
                .fetchSingle();
    }

    public AssetRecord update(UUID id, UpdateAssetRequest request) {
        return db.update(ASSET)
                .set(ASSET.LOCATIONID, request.locationId())
                .set(ASSET.NAME, request.name())
                .set(ASSET.CATEGORY, request.category().name())
                .set(ASSET.INSTALLEDON, request.installedOn())
                .set(ASSET.MANUFACTURER, request.manufacturer())
                .set(ASSET.MODEL, request.model())
                .set(ASSET.SERIALNUMBER, request.serialNumber())
                .set(ASSET.UPDATEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .where(ASSET.ID.eq(id))
                .returning()
                .fetchSingle();
    }

    public AssetRecord deactivate(UUID id) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        return db.update(ASSET)
                .set(ASSET.DEACTIVATEDAT, now)
                .set(ASSET.UPDATEDAT, now)
                .where(ASSET.ID.eq(id))
                .returning()
                .fetchSingle();
    }
}
