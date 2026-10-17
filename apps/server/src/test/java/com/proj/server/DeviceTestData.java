package com.proj.server;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import org.jooq.DSLContext;

/** Seeds an owned estate, location, asset and devices for context tests. */
final class DeviceTestData {
    private final DSLContext db;

    DeviceTestData(DSLContext db) {
        this.db = db;
    }

    /** An estate owned by {@code owner}, with one location and one asset. Returns {estateId, locationId, assetId}. */
    UUID[] estateWithAsset(String owner) {
        var estateId = UUID.randomUUID();
        var locationId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, ?, 'Estate', ?, 'Road', '123456', now())",
                estateId,
                owner,
                estateId.toString());
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                locationId,
                estateId);
        return new UUID[] {estateId, locationId, asset(estateId, locationId)};
    }

    UUID asset(UUID estateId, UUID locationId) {
        var assetId = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"installedOn\", \"updatedAt\") values (?, ?, ?, ?, 'Water Pump', 'PUMP', '2020-01-01', now())",
                assetId,
                estateId,
                locationId,
                "A-" + assetId);
        return assetId;
    }

    /** A device on the asset; {@code credentialHash} may be null. */
    UUID device(UUID estateId, UUID locationId, UUID assetId, String credentialHash) {
        var deviceId = UUID.randomUUID();
        db.execute(
                "insert into \"Device\" (id, \"estateId\", \"assetId\", \"locationId\", identifier, model, metrics, \"reportingIntervalSeconds\", \"updatedAt\", \"credentialHash\", \"credentialIssuedAt\") values (?, ?, ?, ?, ?, 'PT-100', '{TEMPERATURE}', 60, now(), ?, case when ?::text is null then null else now() end)",
                deviceId,
                estateId,
                assetId,
                locationId,
                "DEV-" + deviceId,
                credentialHash,
                credentialHash);
        return deviceId;
    }

    /** Computed independently of the server's own hashing, so the tests check it. */
    static String sha256Hex(String key) {
        try {
            var digest = MessageDigest.getInstance("SHA-256").digest(key.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
