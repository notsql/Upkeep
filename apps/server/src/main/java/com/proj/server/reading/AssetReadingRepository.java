package com.proj.server.reading;

import static com.proj.server.db.tables.Device.DEVICE;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static org.jooq.impl.DSL.falseCondition;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.max;
import static org.jooq.impl.DSL.name;
import static org.jooq.impl.DSL.or;
import static org.jooq.impl.DSL.partitionBy;
import static org.jooq.impl.DSL.select;

import com.proj.server.device.DeviceMetric;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.jooq.impl.DSL;
import org.jooq.impl.SQLDataType;
import org.springframework.stereotype.Repository;

/**
 * Lists an asset's readings with their flags. Flags are computed in one query over every stored reading of the asset
 * (narrowed only by metric, which never changes a flag), and the time window, flag filter and paging are applied on
 * top, so a page and the total always agree and a window never hides a reading's predecessor.
 */
@Repository
public class AssetReadingRepository {
    private static final Field<UUID> ID = field(name("id"), SQLDataType.UUID);
    private static final Field<OffsetDateTime> MEASURED_AT =
            field(name("measuredAt"), SQLDataType.TIMESTAMPWITHTIMEZONE(6));
    private static final Field<String> METRIC = field(name("metric"), SQLDataType.VARCHAR);
    private static final Field<BigDecimal> VALUE = field(name("value"), SQLDataType.NUMERIC);
    private static final Field<UUID> DEVICE_ID = field(name("deviceId"), SQLDataType.UUID);
    private static final Field<String> IDENTIFIER = field(name("identifier"), SQLDataType.VARCHAR);
    private static final Field<Integer> INTERVAL = field(name("interval"), SQLDataType.INTEGER);
    private static final Field<OffsetDateTime> PREVIOUS_AT =
            field(name("previousAt"), SQLDataType.TIMESTAMPWITHTIMEZONE(6));
    private static final Field<Integer> SAME_INSTANT = field(name("sameInstant"), SQLDataType.INTEGER);

    /** Seconds, to the microsecond, since the latest strictly earlier reading; null for the earliest. */
    private static final Field<BigDecimal> GAP_SECONDS =
            field("extract(epoch from ({0} - {1}))", SQLDataType.NUMERIC, MEASURED_AT, PREVIOUS_AT);

    private static final Condition IS_GAP =
            GAP_SECONDS.gt(INTERVAL.cast(SQLDataType.NUMERIC).mul(BigDecimal.valueOf(1.5)));
    private static final Condition IS_DUPLICATE = SAME_INSTANT.gt(1);
    private static final Condition IS_OUT_OF_RANGE = outOfRange();

    private static final Field<Boolean> GAP = field(IS_GAP).as("isGap");
    private static final Field<Boolean> DUPLICATE = field(IS_DUPLICATE).as("isDuplicate");
    private static final Field<Boolean> OUT_OF_RANGE = field(IS_OUT_OF_RANGE).as("isOutOfRange");
    private static final Field<BigDecimal> GAP_LENGTH = GAP_SECONDS.as("gapSeconds");

    private final DSLContext db;

    public AssetReadingRepository(DSLContext db) {
        this.db = db;
    }

    /** Newest first; the ID breaks ties so pages never overlap. */
    public List<AssetReadingResponse> list(
            UUID assetId,
            DeviceMetric metric,
            OffsetDateTime from,
            OffsetDateTime to,
            Set<ReadingFlagType> flags,
            int page,
            int size) {
        var readings = flagged(assetId, metric);
        return db.select(
                        ID, MEASURED_AT, METRIC, VALUE, DEVICE_ID, IDENTIFIER, GAP, DUPLICATE, OUT_OF_RANGE, GAP_LENGTH)
                .from(readings)
                .where(matching(from, to, flags))
                .orderBy(MEASURED_AT.desc(), ID.desc())
                .limit(size)
                .offset((long) page * size)
                .fetch(AssetReadingRepository::toResponse);
    }

    public long count(
            UUID assetId, DeviceMetric metric, OffsetDateTime from, OffsetDateTime to, Set<ReadingFlagType> flags) {
        return db.fetchCount(select(ID).from(flagged(assetId, metric)).where(matching(from, to, flags)));
    }

    /**
     * Every stored reading of the asset (and metric, if given) with what its flags need. The predecessor is the
     * latest reading of the same metric with a strictly earlier measuredAt, from any device: readings sharing an
     * instant never precede each other, so duplicates ending a gap all carry it.
     */
    private Table<?> flagged(UUID assetId, DeviceMetric metric) {
        var byMetric = partitionBy(DEVICEREADING.METRIC);
        var conditions = new ArrayList<Condition>();
        conditions.add(DEVICEREADING.ASSETID.eq(assetId));
        if (metric != null) {
            conditions.add(DEVICEREADING.METRIC.eq(metric.name()));
        }
        return select(
                        DEVICEREADING.ID.as(ID),
                        DEVICEREADING.MEASUREDAT.as(MEASURED_AT),
                        DEVICEREADING.METRIC.as(METRIC),
                        DEVICEREADING.VALUE.as(VALUE),
                        DEVICEREADING.DEVICEID.as(DEVICE_ID),
                        DEVICE.IDENTIFIER.as(IDENTIFIER),
                        DEVICE.REPORTINGINTERVALSECONDS.as(INTERVAL),
                        max(DEVICEREADING.MEASUREDAT)
                                .over(byMetric.orderBy(DEVICEREADING.MEASUREDAT)
                                        .rangeBetweenUnboundedPreceding()
                                        .andCurrentRow()
                                        .excludeGroup())
                                .as(PREVIOUS_AT),
                        DSL.count()
                                .over(partitionBy(DEVICEREADING.METRIC, DEVICEREADING.MEASUREDAT))
                                .as(SAME_INSTANT))
                .from(DEVICEREADING)
                .join(DEVICE)
                .on(DEVICE.ID.eq(DEVICEREADING.DEVICEID))
                .where(conditions)
                .asTable("reading");
    }

    private static List<Condition> matching(OffsetDateTime from, OffsetDateTime to, Set<ReadingFlagType> flags) {
        var conditions = new ArrayList<Condition>();
        if (from != null) {
            conditions.add(MEASURED_AT.ge(from));
        }
        if (to != null) {
            conditions.add(MEASURED_AT.lt(to));
        }
        if (!flags.isEmpty()) {
            conditions.add(
                    or(flags.stream().map(AssetReadingRepository::carries).toList()));
        }
        return conditions;
    }

    private static Condition carries(ReadingFlagType flag) {
        return switch (flag) {
            case GAP -> IS_GAP;
            case DUPLICATE_TIMESTAMP -> IS_DUPLICATE;
            case OUT_OF_RANGE -> IS_OUT_OF_RANGE;
        };
    }

    /** Compared as stored decimals, so a bound is exact and inclusive. */
    private static Condition outOfRange() {
        Condition any = falseCondition();
        for (var metric : DeviceMetric.values()) {
            var min = BigDecimal.valueOf(metric.validMin());
            var max = BigDecimal.valueOf(metric.validMax());
            any = any.or(METRIC.eq(metric.name()).and(VALUE.lt(min).or(VALUE.gt(max))));
        }
        return any;
    }

    private static AssetReadingResponse toResponse(Record row) {
        var metric = DeviceMetric.valueOf(row.get(METRIC));
        var flags = new ArrayList<ReadingFlagResponse>();
        if (Boolean.TRUE.equals(row.get(GAP))) {
            flags.add(ReadingFlagResponse.gap(
                    row.get(GAP_LENGTH).setScale(0, RoundingMode.FLOOR).longValueExact()));
        }
        if (Boolean.TRUE.equals(row.get(DUPLICATE))) {
            flags.add(ReadingFlagResponse.duplicate());
        }
        if (Boolean.TRUE.equals(row.get(OUT_OF_RANGE))) {
            flags.add(ReadingFlagResponse.outOfRange(metric.validMin(), metric.validMax()));
        }
        return new AssetReadingResponse(
                row.get(ID),
                // The driver returns the session's zone; the contract promises UTC.
                row.get(MEASURED_AT).withOffsetSameInstant(ZoneOffset.UTC),
                metric,
                metric.unit(),
                row.get(VALUE),
                row.get(DEVICE_ID),
                row.get(IDENTIFIER),
                flags);
    }
}
