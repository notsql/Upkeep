package com.proj.server.device;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Device.DEVICE;

import com.proj.server.db.tables.records.DeviceRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class DeviceRepository {
    private final DSLContext db;

    public DeviceRepository(DSLContext db) {
        this.db = db;
    }

    public List<DeviceRecord> listForAsset(UUID assetId) {
        return db.selectFrom(DEVICE)
                .where(DEVICE.ASSETID.eq(assetId))
                // Active devices first, then deactivated ones; each newest first.
                .orderBy(DEVICE.DEACTIVATEDAT.isNotNull(), DEVICE.CREATEDAT.desc(), DEVICE.ID)
                .fetch();
    }

    /** Scoped by asset and estate, so a device elsewhere is simply not found. */
    public Optional<DeviceRecord> find(UUID deviceId, UUID assetId, UUID estateId, boolean lock) {
        var query = db.selectFrom(DEVICE)
                .where(DEVICE.ID.eq(deviceId), DEVICE.ASSETID.eq(assetId), DEVICE.ESTATEID.eq(estateId));
        return lock ? query.forUpdate().fetchOptional() : query.fetchOptional();
    }

    /** The device that replaced this one, if any. */
    public Optional<UUID> replacementOf(UUID deviceId) {
        return db.select(DEVICE.ID)
                .from(DEVICE)
                .where(DEVICE.REPLACESDEVICEID.eq(deviceId))
                .fetchOptional(DEVICE.ID);
    }

    /** Permanent. Removes the key, so it stops authenticating; readings are untouched. */
    public DeviceRecord deactivate(UUID deviceId) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        return db.update(DEVICE)
                .set(DEVICE.DEACTIVATEDAT, now)
                .set(DEVICE.CREDENTIALHASH, (String) null)
                .set(DEVICE.CREDENTIALISSUEDAT, (OffsetDateTime) null)
                .set(DEVICE.UPDATEDAT, now)
                .where(DEVICE.ID.eq(deviceId))
                .returning()
                .fetchSingle();
    }

    /** A device with the asset it reports for. */
    public record WithAsset(DeviceRecord device, String assetReference, String assetName, boolean assetRetired) {}

    /** Every device in the estate, retired assets included. Unordered: the caller sorts by status. */
    public List<WithAsset> listForEstate(UUID estateId) {
        return db.select(DEVICE.fields())
                .select(ASSET.REFERENCE, ASSET.NAME, ASSET.DEACTIVATEDAT)
                .from(DEVICE)
                .join(ASSET)
                .on(ASSET.ID.eq(DEVICE.ASSETID))
                .where(DEVICE.ESTATEID.eq(estateId))
                .fetch(row -> new WithAsset(
                        row.into(DEVICE),
                        row.get(ASSET.REFERENCE),
                        row.get(ASSET.NAME),
                        row.get(ASSET.DEACTIVATEDAT) != null));
    }

    /** Across every estate: identifiers are globally unique (decision 0016). */
    public boolean identifierTaken(String identifier) {
        return db.fetchExists(DEVICE, DEVICE.IDENTIFIER.eq(identifier));
    }

    public DeviceRecord create(UUID estateId, UUID assetId, CreateDeviceRequest request) {
        return insert(estateId, assetId, request, null);
    }

    /** A new device recording the deactivated one it replaced (ID-45). */
    public DeviceRecord createReplacing(
            UUID estateId, UUID assetId, CreateDeviceRequest request, UUID replacesDeviceId) {
        return insert(estateId, assetId, request, replacesDeviceId);
    }

    private DeviceRecord insert(UUID estateId, UUID assetId, CreateDeviceRequest request, UUID replacesDeviceId) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        return db.insertInto(DEVICE)
                .set(DEVICE.ID, UUID.randomUUID())
                .set(DEVICE.ESTATEID, estateId)
                .set(DEVICE.ASSETID, assetId)
                .set(DEVICE.LOCATIONID, request.locationId())
                .set(DEVICE.IDENTIFIER, request.identifier())
                .set(DEVICE.MODEL, request.model())
                .set(DEVICE.METRICS, request.metrics().stream().map(Enum::name).toArray(String[]::new))
                .set(DEVICE.REPORTINGINTERVALSECONDS, request.reportingIntervalSeconds())
                .set(DEVICE.REPLACESDEVICEID, replacesDeviceId)
                .set(DEVICE.CREATEDAT, now)
                .set(DEVICE.UPDATEDAT, now)
                .returning()
                .fetchSingle();
    }

    /** Through the unique index on the hash (decision 0025). */
    public Optional<UUID> findIdByCredentialHash(String credentialHash) {
        return db.select(DEVICE.ID)
                .from(DEVICE)
                // Deactivation removes the hash; this also refuses a deactivated device should one remain.
                .where(DEVICE.CREDENTIALHASH.eq(credentialHash), DEVICE.DEACTIVATEDAT.isNull())
                .fetchOptional(DEVICE.ID);
    }

    /**
     * Overwrites the device's key hash, which revokes any earlier key. Scoped by
     * asset and estate, so a device elsewhere is simply not found. Returns the
     * issue time, or empty when no such device.
     */
    public Optional<OffsetDateTime> replaceCredential(
            UUID deviceId, UUID assetId, UUID estateId, String credentialHash) {
        var now = OffsetDateTime.now(ZoneOffset.UTC);
        return db.update(DEVICE)
                .set(DEVICE.CREDENTIALHASH, credentialHash)
                .set(DEVICE.CREDENTIALISSUEDAT, now)
                .set(DEVICE.UPDATEDAT, now)
                .where(DEVICE.ID.eq(deviceId), DEVICE.ASSETID.eq(assetId), DEVICE.ESTATEID.eq(estateId))
                .returning(DEVICE.CREDENTIALISSUEDAT)
                .fetchOptional(DEVICE.CREDENTIALISSUEDAT);
    }
}
