package com.proj.server.reading;

import static com.proj.server.db.tables.Device.DEVICE;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;

import com.proj.server.device.DeviceMetric;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class AssetReadingRepository {
    private final DSLContext db;

    public AssetReadingRepository(DSLContext db) {
        this.db = db;
    }

    /** Newest first; the ID breaks ties so pages never overlap. */
    public List<AssetReadingResponse> list(
            UUID assetId, DeviceMetric metric, OffsetDateTime from, OffsetDateTime to, int page, int size) {
        return db.select(
                        DEVICEREADING.ID,
                        DEVICEREADING.MEASUREDAT,
                        DEVICEREADING.METRIC,
                        DEVICEREADING.VALUE,
                        DEVICEREADING.DEVICEID,
                        DEVICE.IDENTIFIER)
                .from(DEVICEREADING)
                .join(DEVICE)
                .on(DEVICE.ID.eq(DEVICEREADING.DEVICEID))
                .where(matching(assetId, metric, from, to))
                .orderBy(DEVICEREADING.MEASUREDAT.desc(), DEVICEREADING.ID.desc())
                .limit(size)
                .offset((long) page * size)
                .fetch(row -> {
                    var readingMetric = DeviceMetric.valueOf(row.get(DEVICEREADING.METRIC));
                    return new AssetReadingResponse(
                            row.get(DEVICEREADING.ID),
                            // The driver returns the session's zone; the contract promises UTC.
                            row.get(DEVICEREADING.MEASUREDAT).withOffsetSameInstant(ZoneOffset.UTC),
                            readingMetric,
                            readingMetric.unit(),
                            row.get(DEVICEREADING.VALUE),
                            row.get(DEVICEREADING.DEVICEID),
                            row.get(DEVICE.IDENTIFIER));
                });
    }

    public long count(UUID assetId, DeviceMetric metric, OffsetDateTime from, OffsetDateTime to) {
        return db.fetchCount(DEVICEREADING, matching(assetId, metric, from, to));
    }

    private static List<Condition> matching(UUID assetId, DeviceMetric metric, OffsetDateTime from, OffsetDateTime to) {
        var conditions = new ArrayList<Condition>();
        conditions.add(DEVICEREADING.ASSETID.eq(assetId));
        if (metric != null) {
            conditions.add(DEVICEREADING.METRIC.eq(metric.name()));
        }
        if (from != null) {
            conditions.add(DEVICEREADING.MEASUREDAT.ge(from));
        }
        if (to != null) {
            conditions.add(DEVICEREADING.MEASUREDAT.lt(to));
        }
        return conditions;
    }
}
