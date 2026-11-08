package com.proj.server.reading;

import static com.proj.server.db.tables.Anomalyscore.ANOMALYSCORE;
import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Device.DEVICE;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Importedreading.IMPORTEDREADING;
import static com.proj.server.db.tables.Manualreading.MANUALREADING;
import static com.proj.server.db.tables.Readingimportbatch.READINGIMPORTBATCH;
import static org.jooq.impl.DSL.falseCondition;
import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.name;
import static org.jooq.impl.DSL.or;
import static org.jooq.impl.DSL.partitionBy;
import static org.jooq.impl.DSL.select;

import com.proj.server.anomaly.AnomalyModel;
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
    private static final Field<UUID> BATCH_ID = field(name("importBatchId"), SQLDataType.UUID);
    private static final Field<String> SOURCE_LABEL = field(name("sourceLabel"), SQLDataType.VARCHAR);
    private static final Field<Integer> INTERVAL = field(name("interval"), SQLDataType.INTEGER);
    private static final Field<OffsetDateTime> PREVIOUS_AT =
            field(name("previousAt"), SQLDataType.TIMESTAMPWITHTIMEZONE(6));
    /** The asset's stored anomaly score at this instant; null for manual readings and unscored samples. */
    private static final Field<Double> ANOMALY_SCORE = field(name("anomalyScore"), SQLDataType.DOUBLE);

    private static final Field<Integer> SAME_INSTANT = field(name("sameInstant"), SQLDataType.INTEGER);

    /** Seconds, to the microsecond, since the latest strictly earlier reading; null for the earliest. */
    private static final Field<BigDecimal> GAP_SECONDS =
            field("extract(epoch from ({0} - {1}))", SQLDataType.NUMERIC, MEASURED_AT, PREVIOUS_AT);

    private static final Condition IS_GAP =
            GAP_SECONDS.gt(INTERVAL.cast(SQLDataType.NUMERIC).mul(BigDecimal.valueOf(1.5)));
    private static final Condition IS_DUPLICATE = SAME_INSTANT.gt(1);
    private static final Condition IS_OUT_OF_RANGE = outOfRange();
    private static final Condition IS_ANOMALY = ANOMALY_SCORE.ge(AnomalyModel.DECISION_THRESHOLD);

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
                        ANOMALY_SCORE,
                        SOURCE,
                        RECORDED_BY,
                        RECORDED_NAME,
                        RECORDED_AT,
                        BATCH_ID,
                        SOURCE_LABEL)
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
                ANOMALY_SCORE,
                SOURCE,
                RECORDED_BY,
                RECORDED_NAME,
                RECORDED_AT,
                BATCH_ID,
                SOURCE_LABEL);
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
                reading.recordedAt(),
                reading.importBatchId(),
                reading.sourceLabel());
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

    private static final OffsetDateTime EPOCH = OffsetDateTime.of(1970, 1, 1, 0, 0, 0, 0, ZoneOffset.UTC);

    /** Epoch-aligned bucket start of {@code at}, so an instant falls in the same bucket on every request. */
    private static Field<OffsetDateTime> bucket(Field<OffsetDateTime> at, int seconds) {
        return field(
                "date_bin({0} * interval '1 second', {1}, {2})",
                SQLDataType.TIMESTAMPWITHTIMEZONE(6), DSL.inline(seconds), at, DSL.inline(EPOCH));
    }

    /**
     * Device readings in [from, to) per metric and bucket; one range scan of the (assetId, metric, measuredAt) index
     * per metric. Metrics without readings are left out; the rest come in catalogue order.
     */
    public List<MetricSeries> series(
            UUID assetId, Set<DeviceMetric> metrics, OffsetDateTime from, OffsetDateTime to, int bucketSeconds) {
        var start = bucket(DEVICEREADING.MEASUREDAT, bucketSeconds).as("start");
        var rows = db.select(
                        DEVICEREADING.METRIC,
                        start,
                        DSL.min(DEVICEREADING.VALUE).cast(SQLDataType.DOUBLE),
                        DSL.max(DEVICEREADING.VALUE).cast(SQLDataType.DOUBLE),
                        DSL.avg(DEVICEREADING.VALUE).cast(SQLDataType.DOUBLE),
                        DSL.count())
                .from(DEVICEREADING)
                .where(
                        DEVICEREADING.ASSETID.eq(assetId),
                        DEVICEREADING.METRIC.in(metrics.stream().map(Enum::name).toList()),
                        DEVICEREADING.MEASUREDAT.ge(from),
                        DEVICEREADING.MEASUREDAT.lt(to))
                .groupBy(DEVICEREADING.METRIC, start)
                .orderBy(start)
                .fetch();
        var points = new java.util.EnumMap<DeviceMetric, List<SeriesPoint>>(DeviceMetric.class);
        for (var row : rows) {
            points.computeIfAbsent(DeviceMetric.valueOf(row.value1()), m -> new ArrayList<>())
                    .add(new SeriesPoint(
                            row.value2().withOffsetSameInstant(ZoneOffset.UTC),
                            row.value3(),
                            row.value4(),
                            row.value5(),
                            row.value6()));
        }
        return points.entrySet().stream()
                .map(e -> new MetricSeries(e.getKey(), e.getKey().unit(), e.getValue()))
                .toList();
    }

    /** The asset's anomaly scores in [from, to), bucketed like {@link #series}; served by (assetId, measuredAt). */
    public List<AnomalyBucket> anomalyBuckets(UUID assetId, OffsetDateTime from, OffsetDateTime to, int bucketSeconds) {
        var start = bucket(ANOMALYSCORE.MEASUREDAT, bucketSeconds).as("start");
        return db.select(
                        start,
                        DSL.max(ANOMALYSCORE.SCORE),
                        DSL.count().filterWhere(ANOMALYSCORE.SCORE.ge(AnomalyModel.DECISION_THRESHOLD)))
                .from(ANOMALYSCORE)
                .where(
                        ANOMALYSCORE.ASSETID.eq(assetId),
                        ANOMALYSCORE.MEASUREDAT.ge(from),
                        ANOMALYSCORE.MEASUREDAT.lt(to))
                .groupBy(start)
                .orderBy(start)
                .fetch(row -> new AnomalyBucket(
                        row.value1().withOffsetSameInstant(ZoneOffset.UTC), row.value2(), row.value3()));
    }

    private static final List<String> CATALOGUE =
            java.util.Arrays.stream(DeviceMetric.values()).map(Enum::name).toList();

    /**
     * The latest {@code count} distinct measuredAt values of the asset's device and manual readings of {@code metrics}
     * in [from, before) (either bound optional), newest first. Without flags, each side walks the (assetId, metric,
     * measuredAt) index backwards once per metric, reading at most {@code count} distinct instants each. With flags,
     * the instants come from the flagged readings, since a flag needs the predecessor and the score.
     */
    public List<OffsetDateTime> groupInstants(
            UUID assetId,
            Set<DeviceMetric> metrics,
            OffsetDateTime from,
            OffsetDateTime before,
            Set<ReadingFlagType> flags,
            int count) {
        var names = names(metrics);
        if (flags.equals(Set.of(ReadingFlagType.ANOMALY))) {
            // An anomaly is a stored score at or over the threshold on a device reading at that instant, so walk the
            // (assetId, measuredAt) score index backwards instead of deriving every reading's flags.
            var conditions = new ArrayList<Condition>(
                    List.of(ANOMALYSCORE.ASSETID.eq(assetId), ANOMALYSCORE.SCORE.ge(AnomalyModel.DECISION_THRESHOLD)));
            if (from != null) conditions.add(ANOMALYSCORE.MEASUREDAT.ge(from));
            if (before != null) conditions.add(ANOMALYSCORE.MEASUREDAT.lt(before));
            conditions.add(DSL.exists(DSL.selectOne()
                    .from(DEVICEREADING)
                    .where(
                            DEVICEREADING.ASSETID.eq(assetId),
                            DEVICEREADING.METRIC.in(names),
                            DEVICEREADING.MEASUREDAT.eq(ANOMALYSCORE.MEASUREDAT))));
            return db.select(ANOMALYSCORE.MEASUREDAT)
                    .from(ANOMALYSCORE)
                    .where(conditions)
                    .orderBy(ANOMALYSCORE.MEASUREDAT.desc())
                    .limit(count)
                    .fetch(org.jooq.Record1::value1);
        }
        if (!flags.isEmpty()) {
            return db.selectDistinct(MEASURED_AT)
                    .from(flagged(assetId, null))
                    .where(DSL.and(matching(from, before, flags)).and(METRIC.in(names)))
                    .orderBy(MEASURED_AT.desc())
                    .limit(count)
                    .fetch(org.jooq.Record1::value1);
        }
        org.jooq.Select<org.jooq.Record1<OffsetDateTime>> union = null;
        for (var metric : names) {
            for (var side : List.of(
                    latest(DEVICEREADING, DEVICEREADING.ASSETID, DEVICEREADING.METRIC, DEVICEREADING.MEASUREDAT),
                    latest(MANUALREADING, MANUALREADING.ASSETID, MANUALREADING.METRIC, MANUALREADING.MEASUREDAT))) {
                var walk = side.walk(assetId, metric, from, before, count);
                union = union == null ? walk : union.unionAll(walk);
            }
        }
        var instants = union.asTable("instant");
        var at = instants.field(0, OffsetDateTime.class);
        return db.selectDistinct(at)
                .from(instants)
                .orderBy(at.desc())
                .limit(count)
                .fetch(org.jooq.Record1::value1);
    }

    /** Catalogue order, so the walk and the SQL are stable whatever order the request listed metrics in. */
    private static List<String> names(Set<DeviceMetric> metrics) {
        return CATALOGUE.stream()
                .filter(m -> metrics.contains(DeviceMetric.valueOf(m)))
                .toList();
    }

    private record Walk(Table<?> table, Field<UUID> asset, Field<String> metric, Field<OffsetDateTime> at) {
        org.jooq.Select<org.jooq.Record1<OffsetDateTime>> walk(
                UUID assetId, String metricName, OffsetDateTime from, OffsetDateTime before, int count) {
            var conditions = new ArrayList<Condition>(List.of(asset.eq(assetId), metric.eq(metricName)));
            if (from != null) conditions.add(at.ge(from));
            if (before != null) conditions.add(at.lt(before));
            return DSL.selectDistinct(at.as(MEASURED_AT))
                    .from(table)
                    .where(conditions)
                    .orderBy(at.desc())
                    .limit(count);
        }
    }

    private static Walk latest(Table<?> table, Field<UUID> asset, Field<String> metric, Field<OffsetDateTime> at) {
        return new Walk(table, asset, metric, at);
    }

    /**
     * Every reading of the asset at the given instants, with the same flags as {@link #list}, grouped per instant and
     * source: newest first, device groups before manual ones, then by device identifier or recorder. Only readings of
     * {@code metrics} are kept; with {@code flags}, only groups where one of those readings carries one of them.
     */
    public List<ReadingGroup> groupsAt(
            UUID assetId, Set<DeviceMetric> metrics, Set<ReadingFlagType> flags, List<OffsetDateTime> instants) {
        if (instants.isEmpty()) return List.of();
        var rows = db.select(
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
                        ANOMALY_SCORE,
                        SOURCE,
                        RECORDED_BY,
                        RECORDED_NAME)
                .from(flagged(assetId, null))
                .where(METRIC.in(names(metrics)), MEASURED_AT.in(instants))
                .fetch();
        record Key(OffsetDateTime at, String source, String by) {}
        var grouped = new java.util.LinkedHashMap<Key, List<Record>>();
        for (var row : rows) {
            var source = row.get(SOURCE);
            var by = "SENSOR".equals(source) ? String.valueOf(row.get(DEVICE_ID)) : row.get(RECORDED_BY);
            grouped.computeIfAbsent(
                            new Key(row.get(MEASURED_AT).withOffsetSameInstant(ZoneOffset.UTC), source, by),
                            k -> new ArrayList<>())
                    .add(row);
        }
        return grouped.values().stream()
                .map(AssetReadingRepository::toGroup)
                .filter(g -> flags.isEmpty()
                        || g.metrics().stream()
                                .flatMap(m -> m.flags().stream())
                                .anyMatch(f -> flags.contains(f.type())))
                .sorted(java.util.Comparator.comparing(ReadingGroup::measuredAt)
                        .reversed()
                        .thenComparing(ReadingGroup::source)
                        .thenComparing(
                                g -> g.source() == ReadingSource.SENSOR ? g.deviceIdentifier() : g.recordedByName(),
                                java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
                        .thenComparing(g -> g.metrics().getFirst().readingId()))
                .toList();
    }

    private static ReadingGroup toGroup(List<Record> rows) {
        var first = rows.getFirst();
        var source = ReadingSource.valueOf(first.get(SOURCE));
        boolean sensor = source == ReadingSource.SENSOR;
        var metrics = rows.stream()
                .sorted(java.util.Comparator.comparing((Record r) -> DeviceMetric.valueOf(r.get(METRIC)))
                        .thenComparing(r -> r.get(ID)))
                .map(row -> {
                    var metric = DeviceMetric.valueOf(row.get(METRIC));
                    var value = row.get(VALUE);
                    return new GroupedMetricReading(
                            row.get(ID),
                            metric,
                            value.doubleValue(),
                            sensor ? null : value.stripTrailingZeros().toPlainString(),
                            metric.unit(),
                            flags(row, metric));
                })
                .toList();
        return new ReadingGroup(
                first.get(MEASURED_AT).withOffsetSameInstant(ZoneOffset.UTC),
                source,
                first.get(DEVICE_ID),
                first.get(IDENTIFIER),
                sensor ? null : first.get(RECORDED_NAME),
                sensor ? first.get(ANOMALY_SCORE) : null,
                metrics);
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
                        ANOMALYSCORE.SCORE.as(ANOMALY_SCORE),
                        DSL.inline("SENSOR").as(SOURCE),
                        DSL.val((String) null).as(RECORDED_BY),
                        DSL.val((String) null).as(RECORDED_NAME),
                        DEVICEREADING.RECEIVEDAT.as(RECORDED_AT),
                        DSL.val((UUID) null, SQLDataType.UUID).as(BATCH_ID),
                        DSL.val((String) null).as(SOURCE_LABEL))
                .from(DEVICEREADING)
                .join(DEVICE)
                .on(DEVICE.ID.eq(DEVICEREADING.DEVICEID))
                .join(ASSET)
                .on(ASSET.ID.eq(DEVICEREADING.ASSETID).and(ASSET.ESTATEID.eq(DEVICEREADING.ESTATEID)))
                // Uses the unique (assetId, measuredAt) index; every metric of a scored sample shares its score.
                .leftJoin(ANOMALYSCORE)
                .on(ANOMALYSCORE
                        .ASSETID
                        .eq(DEVICEREADING.ASSETID)
                        .and(ANOMALYSCORE.MEASUREDAT.eq(DEVICEREADING.MEASUREDAT)))
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
                        DSL.val((Double) null, SQLDataType.DOUBLE),
                        DSL.inline("MANUAL"),
                        MANUALREADING.RECORDEDBYUSERID,
                        MANUALREADING.RECORDEDBYNAME,
                        MANUALREADING.RECORDEDAT,
                        DSL.val((UUID) null, SQLDataType.UUID),
                        DSL.val((String) null))
                .from(MANUALREADING)
                .join(ASSET)
                .on(ASSET.ID.eq(MANUALREADING.ASSETID).and(ASSET.ESTATEID.eq(MANUALREADING.ESTATEID)))
                .where(manualConditions);
        var importedConditions = new ArrayList<Condition>();
        if (estateId != null) importedConditions.add(IMPORTEDREADING.ESTATEID.eq(estateId));
        if (assetId != null) importedConditions.add(IMPORTEDREADING.ASSETID.eq(assetId));
        if (metric != null) importedConditions.add(IMPORTEDREADING.METRIC.eq(metric.name()));
        var imported = select(
                        IMPORTEDREADING.ID,
                        IMPORTEDREADING.ASSETID,
                        ASSET.NAME,
                        ASSET.REFERENCE,
                        IMPORTEDREADING.MEASUREDAT,
                        IMPORTEDREADING.METRIC,
                        IMPORTEDREADING.VALUE,
                        DSL.val((UUID) null, SQLDataType.UUID),
                        DSL.val((String) null),
                        DSL.val((Integer) null),
                        DSL.val((OffsetDateTime) null, SQLDataType.TIMESTAMPWITHTIMEZONE(6)),
                        DSL.val((Double) null, SQLDataType.DOUBLE),
                        DSL.inline("IMPORT"),
                        DSL.val((String) null),
                        DSL.val((String) null),
                        IMPORTEDREADING.RECORDEDAT,
                        IMPORTEDREADING.BATCHID,
                        READINGIMPORTBATCH.SOURCELABEL)
                .from(IMPORTEDREADING)
                .join(ASSET)
                .on(ASSET.ID.eq(IMPORTEDREADING.ASSETID).and(ASSET.ESTATEID.eq(IMPORTEDREADING.ESTATEID)))
                .join(READINGIMPORTBATCH)
                .on(READINGIMPORTBATCH
                        .ID
                        .eq(IMPORTEDREADING.BATCHID)
                        .and(READINGIMPORTBATCH.ESTATEID.eq(IMPORTEDREADING.ESTATEID)))
                .where(importedConditions);
        var sources = sensor.unionAll(manual).unionAll(imported).asTable("source_reading");
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
            case ANOMALY -> IS_ANOMALY;
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
        return new AssetReadingResponse(
                row.get(ID),
                // The driver returns the session's zone; the contract promises UTC.
                row.get(MEASURED_AT).withOffsetSameInstant(ZoneOffset.UTC),
                metric,
                metric.unit(),
                row.get(VALUE),
                row.get(DEVICE_ID),
                row.get(IDENTIFIER),
                flags(row, metric),
                ReadingSource.valueOf(row.get(SOURCE)),
                row.get(RECORDED_BY),
                row.get(RECORDED_NAME),
                row.get(RECORDED_AT).withOffsetSameInstant(ZoneOffset.UTC),
                row.get(BATCH_ID),
                row.get(SOURCE_LABEL));
    }

    private static List<ReadingFlagResponse> flags(Record row, DeviceMetric metric) {
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
        var score = row.get(ANOMALY_SCORE);
        if (score != null && score >= AnomalyModel.DECISION_THRESHOLD) {
            flags.add(ReadingFlagResponse.anomaly(score));
        }
        return flags;
    }
}
