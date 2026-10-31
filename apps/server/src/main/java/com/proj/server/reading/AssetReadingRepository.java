package com.proj.server.reading;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Device.DEVICE;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Manualreading.MANUALREADING;
import static org.jooq.impl.DSL.falseCondition;
import static org.jooq.impl.DSL.field;
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
    private static final Field<UUID> ASSET_ID = field(name("assetId"), SQLDataType.UUID);
    private static final Field<String> ASSET_NAME = field(name("assetName"), SQLDataType.VARCHAR);
    private static final Field<String> ASSET_REFERENCE = field(name("assetReference"), SQLDataType.VARCHAR);
    private static final Field<OffsetDateTime> MEASURED_AT =
            field(name("measuredAt"), SQLDataType.TIMESTAMPWITHTIMEZONE(6));
    private static final Field<String> METRIC = field(name("metric"), SQLDataType.VARCHAR);
    private static final Field<BigDecimal> VALUE = field(name("value"), SQLDataType.NUMERIC);
    private static final Field<UUID> DEVICE_ID = field(name("deviceId"), SQLDataType.UUID);
    private static final Field<String> IDENTIFIER = field(name("identifier"), SQLDataType.VARCHAR);
    private static final Field<String> SOURCE = field(name("source"), SQLDataType.VARCHAR);
    private static final Field<String> RECORDED_BY = field(name("recordedByUserId"), SQLDataType.VARCHAR);
    private static final Field<String> RECORDED_NAME = field(name("recordedByName"), SQLDataType.VARCHAR);
    private static final Field<OffsetDateTime> RECORDED_AT =
            field(name("recordedAt"), SQLDataType.TIMESTAMPWITHTIMEZONE(6));
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
                        ID,
                        MEASURED_AT,
                        METRIC,
                        VALUE,
                        DEVICE_ID,
                        IDENTIFIER,
                        GAP,
                        DUPLICATE,
                        OUT_OF_RANGE,
                        GAP_LENGTH,
                        SOURCE,
                        RECORDED_BY,
                        RECORDED_NAME,
                        RECORDED_AT)
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

    public List<EstateReadingResponse> listEstate(
            UUID estateId,
            UUID assetId,
            DeviceMetric metric,
            OffsetDateTime from,
            OffsetDateTime to,
            Set<ReadingFlagType> flags,
            int page,
            int size) {
        var query = estateQuery(estateId, assetId, metric, from, to, flags);
        query.addLimit(size);
        query.addOffset((long) page * size);
        return query.fetch(AssetReadingRepository::toEstateResponse);
    }

    static final Field<Long> EXPORT_ROWS =
            DSL.count().over().cast(SQLDataType.BIGINT).as("exportRows");

    org.jooq.Cursor<Record> exportEstate(
            UUID estate,
            UUID asset,
            DeviceMetric metric,
            OffsetDateTime from,
            OffsetDateTime to,
            Set<ReadingFlagType> flags) {
        var query = estateQuery(estate, asset, metric, from, to, flags);
        query.addSelect(EXPORT_ROWS);
        // Per-record DEBUG result logging would duplicate an entire large export into logs.
        query.attach(db.configuration()
                .derive(org.jooq.conf.SettingsTools.clone(db.settings()).withExecuteLogging(false)));
        query.fetchSize(512);
        return query.fetchLazy();
    }

    private org.jooq.SelectQuery<Record> estateQuery(
            UUID estate,
            UUID asset,
            DeviceMetric metric,
            OffsetDateTime from,
            OffsetDateTime to,
            Set<ReadingFlagType> flags) {
        var query = db.selectQuery();
        query.addSelect(
                ID,
                ASSET_ID,
                ASSET_NAME,
                ASSET_REFERENCE,
                MEASURED_AT,
                METRIC,
                VALUE,
                DEVICE_ID,
                IDENTIFIER,
                GAP,
                DUPLICATE,
                OUT_OF_RANGE,
                GAP_LENGTH,
                SOURCE,
                RECORDED_BY,
                RECORDED_NAME,
                RECORDED_AT);
        query.addFrom(flagged(estate, asset, metric));
        query.addConditions(matching(from, to, flags));
        query.addOrderBy(MEASURED_AT.desc(), ID.desc());
        return query;
    }

    static EstateReadingResponse toEstateResponse(Record row) {
        var reading = toResponse(row);
        return new EstateReadingResponse(
                reading.id(),
                row.get(ASSET_ID),
                row.get(ASSET_REFERENCE),
                row.get(ASSET_NAME),
                reading.measuredAt(),
                reading.metric(),
                reading.unit(),
                reading.value(),
                reading.deviceId(),
                reading.deviceIdentifier(),
                reading.flags(),
                reading.source(),
                reading.recordedByUserId(),
                reading.recordedByName(),
                reading.recordedAt());
    }

    public long countEstate(
            UUID estateId,
            UUID assetId,
            DeviceMetric metric,
            OffsetDateTime from,
            OffsetDateTime to,
            Set<ReadingFlagType> flags) {
        return db.fetchCount(select(ID).from(flagged(estateId, assetId, metric)).where(matching(from, to, flags)));
    }

    public ReadingAssetOptionPage assetOptions(UUID estateId, String search, int page, int size) {
        var condition = ASSET.ESTATEID.eq(estateId);
        if (!search.isBlank())
            condition =
                    condition.and(ASSET.NAME.containsIgnoreCase(search).or(ASSET.REFERENCE.containsIgnoreCase(search)));
        var items = db.select(ASSET.ID, ASSET.REFERENCE, ASSET.NAME, ASSET.DEACTIVATEDAT)
                .from(ASSET)
                .where(condition)
                .orderBy(ASSET.NAME.asc(), ASSET.REFERENCE.asc(), ASSET.ID.asc())
                .limit(size)
                .offset((long) page * size)
                .fetch(row -> new ReadingAssetOption(
                        row.get(ASSET.ID),
                        row.get(ASSET.REFERENCE),
                        row.get(ASSET.NAME),
                        row.get(ASSET.DEACTIVATEDAT) != null));
        return new ReadingAssetOptionPage(items, page, size, db.fetchCount(ASSET, condition));
    }

    /**
     * Every stored reading of the asset (and metric, if given) with what its flags need. The predecessor is the
     * latest reading of the same metric with a strictly earlier measuredAt, from any device: readings sharing an
     * instant never precede each other, so duplicates ending a gap all carry it.
     */
    private Table<?> flagged(UUID assetId, DeviceMetric metric) {
        return flagged(null, assetId, metric);
    }

    private Table<?> flagged(UUID estateId, UUID assetId, DeviceMetric metric) {
        var previous = DEVICEREADING.as("previous_reading");
        // An indexed predecessor lookup avoids the quadratic unbounded EXCLUDE GROUP frame.
        // Strict < retains the rule that readings sharing an instant do not precede each other.
        var predecessor = select(previous.MEASUREDAT)
                .from(previous)
                .where(
                        previous.ASSETID.eq(DEVICEREADING.ASSETID),
                        previous.METRIC.eq(DEVICEREADING.METRIC),
                        previous.MEASUREDAT.lt(DEVICEREADING.MEASUREDAT))
                .orderBy(previous.MEASUREDAT.desc())
                .limit(1)
                .<OffsetDateTime>asField();
        var conditions = new ArrayList<Condition>();
        if (estateId != null) conditions.add(DEVICEREADING.ESTATEID.eq(estateId));
        if (assetId != null) conditions.add(DEVICEREADING.ASSETID.eq(assetId));
        if (metric != null) {
            conditions.add(DEVICEREADING.METRIC.eq(metric.name()));
        }
        var sensor = select(
                        DEVICEREADING.ID.as(ID),
                        DEVICEREADING.ASSETID.as(ASSET_ID),
                        ASSET.NAME.as(ASSET_NAME),
                        ASSET.REFERENCE.as(ASSET_REFERENCE),
                        DEVICEREADING.MEASUREDAT.as(MEASURED_AT),
                        DEVICEREADING.METRIC.as(METRIC),
                        DEVICEREADING.VALUE.as(VALUE),
                        DEVICEREADING.DEVICEID.as(DEVICE_ID),
                        DEVICE.IDENTIFIER.as(IDENTIFIER),
                        DEVICE.REPORTINGINTERVALSECONDS.as(INTERVAL),
                        predecessor.as(PREVIOUS_AT),
                        DSL.inline("SENSOR").as(SOURCE),
                        DSL.val((String) null).as(RECORDED_BY),
                        DSL.val((String) null).as(RECORDED_NAME),
                        DEVICEREADING.RECEIVEDAT.as(RECORDED_AT))
                .from(DEVICEREADING)
                .join(DEVICE)
                .on(DEVICE.ID.eq(DEVICEREADING.DEVICEID))
                .join(ASSET)
                .on(ASSET.ID.eq(DEVICEREADING.ASSETID).and(ASSET.ESTATEID.eq(DEVICEREADING.ESTATEID)))
                .where(conditions);
        var manualConditions = new ArrayList<Condition>();
        if (estateId != null) manualConditions.add(MANUALREADING.ESTATEID.eq(estateId));
        if (assetId != null) manualConditions.add(MANUALREADING.ASSETID.eq(assetId));
        if (metric != null) manualConditions.add(MANUALREADING.METRIC.eq(metric.name()));
        var manual = select(
                        MANUALREADING.ID,
                        MANUALREADING.ASSETID,
                        ASSET.NAME,
                        ASSET.REFERENCE,
                        MANUALREADING.MEASUREDAT,
                        MANUALREADING.METRIC,
                        MANUALREADING.VALUE,
                        DSL.val((UUID) null, SQLDataType.UUID),
                        DSL.val((String) null),
                        DSL.val((Integer) null),
                        DSL.val((OffsetDateTime) null, SQLDataType.TIMESTAMPWITHTIMEZONE(6)),
                        DSL.inline("MANUAL"),
                        MANUALREADING.RECORDEDBYUSERID,
                        MANUALREADING.RECORDEDBYNAME,
                        MANUALREADING.RECORDEDAT)
                .from(MANUALREADING)
                .join(ASSET)
                .on(ASSET.ID.eq(MANUALREADING.ASSETID).and(ASSET.ESTATEID.eq(MANUALREADING.ESTATEID)))
                .where(manualConditions);
        var sources = sensor.unionAll(manual).asTable("source_reading");
        return select(sources.fields())
                .select(DSL.count()
                        .over(partitionBy(sources.field(ASSET_ID), sources.field(METRIC), sources.field(MEASURED_AT)))
                        .as(SAME_INSTANT))
                .from(sources)
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
                flags,
                ReadingSource.valueOf(row.get(SOURCE)),
                row.get(RECORDED_BY),
                row.get(RECORDED_NAME),
                row.get(RECORDED_AT).withOffsetSameInstant(ZoneOffset.UTC));
    }
}
