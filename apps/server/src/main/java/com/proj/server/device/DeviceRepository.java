package com.proj.server.device;

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
                .orderBy(DEVICE.CREATEDAT.desc(), DEVICE.ID)
                .fetch();
    }

    /** Across every estate: identifiers are globally unique (decision 0016). */
    public boolean identifierTaken(String identifier) {
        return db.fetchExists(DEVICE, DEVICE.IDENTIFIER.eq(identifier));
    }

    public DeviceRecord create(UUID estateId, UUID assetId, CreateDeviceRequest request) {
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
                .set(DEVICE.CREATEDAT, now)
                .set(DEVICE.UPDATEDAT, now)
                .returning()
                .fetchSingle();
    }

    /** Through the unique index on the hash (decision 0025). */
    public Optional<UUID> findIdByCredentialHash(String credentialHash) {
        return db.select(DEVICE.ID)
                .from(DEVICE)
                .where(DEVICE.CREDENTIALHASH.eq(credentialHash))
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
