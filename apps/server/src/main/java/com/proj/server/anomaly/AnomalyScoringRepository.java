package com.proj.server.anomaly;

import static com.proj.server.db.tables.Anomalyscore.ANOMALYSCORE;
import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Assetassessment.ASSETASSESSMENT;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Estate.ESTATE;
import static org.jooq.impl.DSL.count;
import static org.jooq.impl.DSL.countDistinct;
import static org.jooq.impl.DSL.max;
import static org.jooq.impl.DSL.min;
import static org.jooq.impl.DSL.noCondition;
import static org.jooq.impl.DSL.selectOne;

import com.proj.server.catalogue.AssetCategoryCodes;
import com.proj.server.device.DeviceMetric;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

/** Samples from stored device readings, and the stored anomaly scores. */
@Repository
public class AnomalyScoringRepository {
    /** In {@link AnomalyFeatureBuilder}'s input order. */
    private static final List<String> METRICS = List.of(
            DeviceMetric.VIBRATION_ACCELERATION.name(),
            DeviceMetric.PRESSURE.name(),
            DeviceMetric.TEMPERATURE.name(),
            DeviceMetric.FLOW_RATE.name(),
            DeviceMetric.POWER.name());

    private final DSLContext db;

    public AnomalyScoringRepository(DSLContext db) {
        this.db = db;
    }

    /** Held until the transaction ends, so passes for one asset run one at a time, on every instance. */
    void lock(UUID assetId) {
        db.fetch("select pg_advisory_xact_lock(hashtextextended(?, 0))", assetId.toString());
    }

    /** The asset's estate if it is an active pump in an active estate. */
    Optional<UUID> scorableEstate(UUID assetId) {
        return db.select(ASSET.ESTATEID)
                .from(ASSET)
                .join(ESTATE)
                .on(ESTATE.ID.eq(ASSET.ESTATEID))
                .where(ASSET.ID.eq(assetId))
                .and(ASSET.CATEGORY.eq(AssetCategoryCodes.PUMP))
                .and(ASSET.DEACTIVATEDAT.isNull())
                .and(ESTATE.DEACTIVATEDAT.isNull())
                .fetchOptional(ASSET.ESTATEID);
    }

    /** The oldest samples without a stored score, at most {@code limit}. */
    List<AnomalyCheckRequest.Reading> unscored(UUID assetId, int limit) {
        var scored = selectOne()
                .from(ANOMALYSCORE)
                .where(ANOMALYSCORE.ASSETID.eq(assetId))
                .and(ANOMALYSCORE.MEASUREDAT.eq(DEVICEREADING.MEASUREDAT));
        return samples(assetId, org.jooq.impl.DSL.notExists(scored), limit);
    }

    /** Every sample measured from {@code from} to {@code to}, inclusive. */
    List<AnomalyCheckRequest.Reading> samples(UUID assetId, Instant from, Instant to) {
        return samples(assetId, DEVICEREADING.MEASUREDAT.between(utc(from), utc(to)), Integer.MAX_VALUE);
    }

    /** Timestamps with exactly one device reading for each of the five pump metrics. */
    private List<AnomalyCheckRequest.Reading> samples(UUID assetId, Condition condition, int limit) {
        List<Field<BigDecimal>> values = METRICS.stream()
                .map(m -> (Field<BigDecimal>) max(DEVICEREADING.VALUE).filterWhere(DEVICEREADING.METRIC.eq(m)))
                .toList();
        return db.select(DEVICEREADING.MEASUREDAT)
                .select(values)
                .from(DEVICEREADING)
                .where(DEVICEREADING.ASSETID.eq(assetId))
                .and(DEVICEREADING.METRIC.in(METRICS))
                .and(condition)
                .groupBy(DEVICEREADING.MEASUREDAT)
                .having(count().eq(METRICS.size()))
                .and(countDistinct(DEVICEREADING.METRIC).eq(METRICS.size()))
                .orderBy(DEVICEREADING.MEASUREDAT)
                .limit(limit)
                .fetch(r -> new AnomalyCheckRequest.Reading(
                        r.get(DEVICEREADING.MEASUREDAT).toInstant(),
                        value(r, values.get(0)),
                        value(r, values.get(1)),
                        value(r, values.get(2)),
                        value(r, values.get(3)),
                        value(r, values.get(4))));
    }

    void insert(UUID estateId, UUID assetId, List<Instant> measuredAt, double[] scores) {
        var scoredAt = OffsetDateTime.now(ZoneOffset.UTC);
        var insert = db.insertInto(
                ANOMALYSCORE,
                ANOMALYSCORE.ID,
                ANOMALYSCORE.ESTATEID,
                ANOMALYSCORE.ASSETID,
                ANOMALYSCORE.MEASUREDAT,
                ANOMALYSCORE.SCORE,
                ANOMALYSCORE.SCOREDAT);
        for (int i = 0; i < scores.length; i++) {
            insert = insert.values(UUID.randomUUID(), estateId, assetId, utc(measuredAt.get(i)), scores[i], scoredAt);
        }
        // The unique index is the backstop if two passes ever race.
        insert.onConflict(ANOMALYSCORE.ASSETID, ANOMALYSCORE.MEASUREDAT)
                .doNothing()
                .execute();
    }

    /** When a person (not a {@code system:} recorder) last recorded an assessment for the asset. */
    Optional<Instant> lastPersonAssessment(UUID assetId) {
        return Optional.ofNullable(db.select(max(ASSETASSESSMENT.CREATEDAT))
                        .from(ASSETASSESSMENT)
                        .where(ASSETASSESSMENT.ASSETID.eq(assetId))
                        .and(ASSETASSESSMENT.RECORDEDBYUSERID.notLike("system:%"))
                        .fetchOne(0, OffsetDateTime.class))
                .map(OffsetDateTime::toInstant);
    }

    /**
     * Stored scores after {@code after} that could share an abnormal run with a sample from {@code from} to {@code to}:
     * bounded by the nearest normal score on each side.
     */
    List<AbnormalRuns.Scored> scoresAround(UUID assetId, Optional<Instant> after, Instant from, Instant to) {
        var normal = ANOMALYSCORE.ASSETID.eq(assetId).and(ANOMALYSCORE.SCORE.lt(AnomalyModel.DECISION_THRESHOLD));
        var lower = db.select(max(ANOMALYSCORE.MEASUREDAT))
                .from(ANOMALYSCORE)
                .where(normal.and(ANOMALYSCORE.MEASUREDAT.lt(utc(from))))
                .fetchOne(0, OffsetDateTime.class);
        var upper = db.select(min(ANOMALYSCORE.MEASUREDAT))
                .from(ANOMALYSCORE)
                .where(normal.and(ANOMALYSCORE.MEASUREDAT.gt(utc(to))))
                .fetchOne(0, OffsetDateTime.class);
        Condition range = noCondition();
        if (after.isPresent()) range = range.and(ANOMALYSCORE.MEASUREDAT.gt(utc(after.get())));
        if (lower != null) range = range.and(ANOMALYSCORE.MEASUREDAT.ge(lower));
        if (upper != null) range = range.and(ANOMALYSCORE.MEASUREDAT.le(upper));
        return db.select(ANOMALYSCORE.MEASUREDAT, ANOMALYSCORE.SCORE)
                .from(ANOMALYSCORE)
                .where(ANOMALYSCORE.ASSETID.eq(assetId))
                .and(range)
                .orderBy(ANOMALYSCORE.MEASUREDAT)
                .fetch(r -> new AbnormalRuns.Scored(r.value1().toInstant(), r.value2()));
    }

    private static Double value(Record r, Field<BigDecimal> field) {
        return r.get(field).doubleValue();
    }

    private static OffsetDateTime utc(Instant instant) {
        return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
