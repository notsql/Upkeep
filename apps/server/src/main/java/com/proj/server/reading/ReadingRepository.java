package com.proj.server.reading;

import static com.proj.server.db.tables.Device.DEVICE;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Estate.ESTATE;

import com.proj.server.db.tables.records.DevicereadingRecord;
import com.proj.server.device.DeviceMetric;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

@Repository
public class ReadingRepository {
    private final DSLContext db;

    public ReadingRepository(DSLContext db) {
        this.db = db;
    }

    /** What a submission needs to know about the device sending it. */
    record SubmittingDevice(UUID id, UUID estateId, UUID assetId, Set<DeviceMetric> metrics, boolean estateInactive) {}

    /** No row lock: readings do not queue behind each other or behind a deactivation. */
    public Optional<SubmittingDevice> findDevice(UUID deviceId) {
        return db.select(DEVICE.ID, DEVICE.ESTATEID, DEVICE.ASSETID, DEVICE.METRICS, ESTATE.DEACTIVATEDAT)
                .from(DEVICE)
                .join(ESTATE)
                .on(ESTATE.ID.eq(DEVICE.ESTATEID))
                .where(DEVICE.ID.eq(deviceId))
                .fetchOptional(row -> new SubmittingDevice(
                        row.get(DEVICE.ID),
                        row.get(DEVICE.ESTATEID),
                        row.get(DEVICE.ASSETID),
                        Arrays.stream(row.get(DEVICE.METRICS))
                                .map(DeviceMetric::valueOf)
                                .collect(Collectors.toCollection(() -> EnumSet.noneOf(DeviceMetric.class))),
                        row.get(ESTATE.DEACTIVATEDAT) != null));
    }

    /**
     * Inserts unless the device already has a reading for this metric and time
     * (decision 0028). Empty means one exists; a concurrent identical insert
     * lands here too rather than failing.
     */
    public Optional<DevicereadingRecord> insert(
            SubmittingDevice device, CreateReadingRequest reading, OffsetDateTime receivedAt) {
        return db.insertInto(DEVICEREADING)
                .set(DEVICEREADING.ID, UUID.randomUUID())
                .set(DEVICEREADING.DEVICEID, device.id())
                .set(DEVICEREADING.ESTATEID, device.estateId())
                .set(DEVICEREADING.ASSETID, device.assetId())
                .set(DEVICEREADING.METRIC, reading.metric().name())
                .set(DEVICEREADING.VALUE, reading.value())
                .set(DEVICEREADING.MEASUREDAT, reading.measuredAt())
                .set(DEVICEREADING.RECEIVEDAT, receivedAt)
                .onConflict(DEVICEREADING.DEVICEID, DEVICEREADING.METRIC, DEVICEREADING.MEASUREDAT)
                .doNothing()
                .returning()
                .fetchOptional();
    }

    public DevicereadingRecord find(UUID deviceId, DeviceMetric metric, OffsetDateTime measuredAt) {
        return db.selectFrom(DEVICEREADING)
                .where(
                        DEVICEREADING.DEVICEID.eq(deviceId),
                        DEVICEREADING.METRIC.eq(metric.name()),
                        DEVICEREADING.MEASUREDAT.eq(measuredAt))
                .fetchSingle();
    }

    /**
     * Never moves last-seen backwards. Postgres's GREATEST ignores nulls, so the
     * first reading sets it. {@code updatedAt} is left alone: a reading is not an
     * edit to the device.
     */
    public void markSeen(UUID deviceId, OffsetDateTime receivedAt) {
        db.update(DEVICE)
                .set(DEVICE.LASTSEENAT, DSL.greatest(DEVICE.LASTSEENAT, DSL.val(receivedAt)))
                .where(DEVICE.ID.eq(deviceId))
                .execute();
    }
}
