package com.proj.server;

import com.proj.server.anomaly.AnomalyCheckRequest;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Seeds pump readings and reads back stored anomaly scores for the scoring tests. */
final class AnomalyTestData {
    static final List<String> METRICS =
            List.of("VIBRATION_ACCELERATION", "PRESSURE", "TEMPERATURE", "FLOW_RATE", "POWER");

    private final DSLContext db;

    AnomalyTestData(DSLContext db) {
        this.db = db;
    }

    /** One device reading, inserted directly (bypassing the device API's clock checks). */
    void reading(UUID estateId, UUID assetId, UUID deviceId, String metric, double value, Instant measuredAt) {
        db.execute(
                "insert into \"DeviceReading\" (id, \"deviceId\", \"estateId\", \"assetId\", metric, value, \"measuredAt\", \"receivedAt\") values (?, ?, ?, ?, ?, ?, ?::timestamptz, now())",
                UUID.randomUUID(),
                deviceId,
                estateId,
                assetId,
                metric,
                BigDecimal.valueOf(value),
                OffsetDateTime.ofInstant(measuredAt, ZoneOffset.UTC));
    }

    /** All five metrics of one reading at its timestamp. */
    void sample(UUID estateId, UUID assetId, UUID deviceId, AnomalyCheckRequest.Reading r) {
        reading(estateId, assetId, deviceId, "VIBRATION_ACCELERATION", r.vibrationAcceleration(), r.timestamp());
        reading(estateId, assetId, deviceId, "PRESSURE", r.pressure(), r.timestamp());
        reading(estateId, assetId, deviceId, "TEMPERATURE", r.temperature(), r.timestamp());
        reading(estateId, assetId, deviceId, "FLOW_RATE", r.flowRate(), r.timestamp());
        reading(estateId, assetId, deviceId, "POWER", r.power(), r.timestamp());
    }

    /** A sample whose five values are all {@code value}. */
    static AnomalyCheckRequest.Reading uniform(Instant at, double value) {
        return new AnomalyCheckRequest.Reading(at, value, value, value, value, value);
    }

    void manualReading(UUID estateId, UUID assetId, String metric, double value, Instant measuredAt) {
        db.execute(
                "insert into \"ManualReading\" (id, \"estateId\", \"assetId\", metric, value, \"measuredAt\", \"recordedAt\", \"recordedByUserId\", \"submissionId\") values (?, ?, ?, ?, ?, ?::timestamptz, now(), 'owner', ?)",
                UUID.randomUUID(),
                estateId,
                assetId,
                metric,
                BigDecimal.valueOf(value),
                OffsetDateTime.ofInstant(measuredAt, ZoneOffset.UTC),
                UUID.randomUUID());
    }

    /** Lets a device send every pump metric. */
    void allPumpMetrics(UUID deviceId) {
        db.execute(
                "update \"Device\" set metrics = '{VIBRATION_ACCELERATION,PRESSURE,TEMPERATURE,FLOW_RATE,POWER}' where id = ?",
                deviceId);
    }

    record Score(Instant measuredAt, double score) {}

    List<Score> scores(UUID assetId) {
        return db.fetch(
                        "select \"measuredAt\", score from \"AnomalyScore\" where \"assetId\" = ? order by \"measuredAt\"",
                        assetId)
                .map(r -> new Score(r.get(0, OffsetDateTime.class).toInstant(), r.get(1, Double.class)));
    }

    long assessments(UUID assetId) {
        return ((Number) db.fetchValue("select count(*) from \"AssetAssessment\" where \"assetId\" = ?", assetId))
                .longValue();
    }

    /** The parity fixture's readings, with values rounded to the 6 decimal places DeviceReading stores. */
    static List<AnomalyCheckRequest.Reading> fixtureReadings() throws IOException {
        try (InputStream in = AnomalyTestData.class.getResourceAsStream("/anomaly/parity-fixture.json")) {
            if (in == null) {
                throw new IllegalStateException("Missing test resource /anomaly/parity-fixture.json");
            }
            JsonNode rows = JsonMapper.builder().build().readTree(in).get("rows");
            var readings = new ArrayList<AnomalyCheckRequest.Reading>();
            for (JsonNode row : rows) {
                JsonNode r = row.get("reading");
                readings.add(new AnomalyCheckRequest.Reading(
                        Instant.parse(r.get("timestamp").asString()),
                        stored(r.get("vibrationAcceleration").asDouble()),
                        stored(r.get("pressure").asDouble()),
                        stored(r.get("temperature").asDouble()),
                        stored(r.get("flowRate").asDouble()),
                        stored(r.get("power").asDouble())));
            }
            return readings;
        }
    }

    private static double stored(double value) {
        return BigDecimal.valueOf(value).setScale(6, RoundingMode.HALF_UP).doubleValue();
    }
}
