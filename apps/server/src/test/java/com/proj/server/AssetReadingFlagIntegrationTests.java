package com.proj.server;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/** Flags on GET /estates/{estateId}/assets/{assetId}/readings (spec suspect-readings, "Flags"). */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AssetReadingFlagIntegrationTests {
    static final OffsetDateTime T0 = OffsetDateTime.parse("2026-10-01T00:00:00Z");

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    DeviceTestData data;
    UUID estateId, locationId, assetId, deviceId;

    @BeforeEach
    void setup() {
        data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        estateId = ids[0];
        locationId = ids[1];
        assetId = ids[2];
        deviceId = device(60);
    }

    UUID device(int intervalSeconds) {
        var id = data.device(estateId, locationId, assetId, null);
        db.execute("update \"Device\" set \"reportingIntervalSeconds\" = ? where id = ?", intervalSeconds, id);
        return id;
    }

    UUID reading(UUID device, String metric, String value, OffsetDateTime measuredAt) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"DeviceReading\" (id, \"deviceId\", \"estateId\", \"assetId\", metric, value, \"measuredAt\", \"receivedAt\") values (?, ?, ?, ?, ?, ?, ?::timestamptz, now())",
                id,
                device,
                estateId,
                assetId,
                metric,
                new BigDecimal(value),
                measuredAt);
        return id;
    }

    UUID reading(String value, OffsetDateTime measuredAt) {
        return reading(deviceId, "TEMPERATURE", value, measuredAt);
    }

    ResultActions list(String query) throws Exception {
        return mvc.perform(get("/estates/" + estateId + "/assets/" + assetId + "/readings" + query)
                .with(jwt().jwt(j -> j.subject("owner"))));
    }

    static String flagsOf(UUID id) {
        return "$.items[?(@.id == '" + id + "')].flags";
    }

    ResultActions expectFlags(UUID id, String... types) throws Exception {
        var actions = list("?size=200").andExpect(status().isOk());
        actions.andExpect(jsonPath(flagsOf(id) + "[*]", org.hamcrest.Matchers.hasSize(types.length)));
        for (var type : types) {
            actions.andExpect(jsonPath(flagsOf(id) + "[*].type", org.hamcrest.Matchers.hasItem(type)));
        }
        return actions;
    }

    // Out of range

    @Test
    void aCleanReadingHasAnEmptyFlagsArray() throws Exception {
        reading("21", T0);
        list("").andExpect(jsonPath("$.items[0].flags.length()").value(0));
    }

    @Test
    void aValueBelowTheMinimumIsOutOfRangeAndCarriesTheRange() throws Exception {
        var low = reading("-40.000001", T0);
        expectFlags(low, "OUT_OF_RANGE")
                .andExpect(jsonPath(flagsOf(low) + "[0].validMin").value(-40.0))
                .andExpect(jsonPath(flagsOf(low) + "[0].validMax").value(150.0))
                .andExpect(jsonPath(flagsOf(low) + "[0].gapSeconds").isEmpty());
    }

    @Test
    void aValueAboveTheMaximumIsOutOfRange() throws Exception {
        var high = reading("150.000001", T0);
        expectFlags(high, "OUT_OF_RANGE");
    }

    @Test
    void aValueAtEitherBoundIsNotFlagged() throws Exception {
        var min = reading("-40", T0);
        var max = reading("150.000000", T0.plusMinutes(1));
        expectFlags(min);
        expectFlags(max);
    }

    @Test
    void boundsComeFromTheReadingsMetric() throws Exception {
        db.execute("update \"Device\" set metrics = '{TEMPERATURE,HUMIDITY}' where id = ?", deviceId);
        var humidity = reading(deviceId, "HUMIDITY", "101", T0);
        expectFlags(humidity, "OUT_OF_RANGE")
                .andExpect(jsonPath(flagsOf(humidity) + "[0].validMin").value(0.0))
                .andExpect(jsonPath(flagsOf(humidity) + "[0].validMax").value(100.0));
    }

    // Duplicate timestamps

    @Test
    void twoDevicesReportingTheSameInstantAreBothFlagged() throws Exception {
        var other = device(60);
        var a = reading(deviceId, "TEMPERATURE", "21", T0);
        var b = reading(other, "TEMPERATURE", "21", T0);
        expectFlags(a, "DUPLICATE_TIMESTAMP");
        expectFlags(b, "DUPLICATE_TIMESTAMP");
    }

    @Test
    void duplicatesWithDifferentValuesAreFlagged() throws Exception {
        var other = device(60);
        var a = reading(deviceId, "TEMPERATURE", "21", T0);
        var b = reading(other, "TEMPERATURE", "35", T0);
        expectFlags(a, "DUPLICATE_TIMESTAMP");
        expectFlags(b, "DUPLICATE_TIMESTAMP");
    }

    @Test
    void readingsOneMillisecondApartAreNotDuplicates() throws Exception {
        var other = device(60);
        var a = reading(deviceId, "TEMPERATURE", "21", T0);
        var b = reading(other, "TEMPERATURE", "21", T0.plusNanos(1_000_000));
        expectFlags(a);
        expectFlags(b);
    }

    @Test
    void theSameInstantOnDifferentMetricsIsNotADuplicate() throws Exception {
        var other = device(60);
        db.execute("update \"Device\" set metrics = '{HUMIDITY}' where id = ?", other);
        var a = reading(deviceId, "TEMPERATURE", "21", T0);
        var b = reading(other, "HUMIDITY", "50", T0);
        expectFlags(a);
        expectFlags(b);
    }

    @Test
    void duplicatesSplitAcrossPagesAreBothFlagged() throws Exception {
        var other = device(60);
        reading(deviceId, "TEMPERATURE", "21", T0);
        reading(other, "TEMPERATURE", "21", T0);
        list("?size=1&page=0").andExpect(jsonPath("$.items[0].flags[0].type").value("DUPLICATE_TIMESTAMP"));
        list("?size=1&page=1").andExpect(jsonPath("$.items[0].flags[0].type").value("DUPLICATE_TIMESTAMP"));
    }

    // Gaps

    @Test
    void aReadingMoreThanOneAndAHalfIntervalsAfterThePreviousIsAGap() throws Exception {
        reading("21", T0);
        var late = reading("21", T0.plusSeconds(91));
        expectFlags(late, "GAP")
                .andExpect(jsonPath(flagsOf(late) + "[0].gapSeconds").value(91))
                .andExpect(jsonPath(flagsOf(late) + "[0].validMin").isEmpty());
    }

    @Test
    void exactlyOneAndAHalfIntervalsIsNotAGap() throws Exception {
        reading("21", T0);
        var onTime = reading("21", T0.plusSeconds(90));
        expectFlags(onTime);
    }

    @Test
    void clockJitterIsNotAGap() throws Exception {
        reading("21", T0);
        var jitter = reading("21", T0.plusSeconds(61));
        expectFlags(jitter);
    }

    @Test
    void theEarliestReadingIsNeverAGap() throws Exception {
        var first = reading("21", T0);
        expectFlags(first);
    }

    @Test
    void theIntervalIsTheReadingsOwnDevices() throws Exception {
        var slow = device(600);
        reading(deviceId, "TEMPERATURE", "21", T0);
        // 300 s is a gap for a 60 s device but not for a 600 s one; the predecessor is from another device.
        var fromSlow = reading(slow, "TEMPERATURE", "21", T0.plusSeconds(300));
        var fromFast = reading(deviceId, "TEMPERATURE", "21", T0.plusSeconds(600));
        expectFlags(fromSlow);
        expectFlags(fromFast, "GAP")
                .andExpect(jsonPath(flagsOf(fromFast) + "[0].gapSeconds").value(300));
    }

    @Test
    void aPredecessorFromAnotherDeviceCounts() throws Exception {
        var other = device(60);
        reading(other, "TEMPERATURE", "21", T0);
        var next = reading(deviceId, "TEMPERATURE", "21", T0.plusSeconds(60));
        expectFlags(next);
    }

    @Test
    void gapsAreMeasuredPerMetric() throws Exception {
        db.execute("update \"Device\" set metrics = '{TEMPERATURE,HUMIDITY}' where id = ?", deviceId);
        reading(deviceId, "TEMPERATURE", "21", T0);
        reading(deviceId, "HUMIDITY", "50", T0.plusSeconds(60));
        var temperature = reading(deviceId, "TEMPERATURE", "21", T0.plusSeconds(120));
        expectFlags(temperature, "GAP");
    }

    @Test
    void aLateReadingInsideTheGapClearsIt() throws Exception {
        reading("21", T0);
        var end = reading("21", T0.plusSeconds(120));
        expectFlags(end, "GAP");
        reading("21", T0.plusSeconds(60));
        expectFlags(end);
    }

    @Test
    void thePredecessorIsTheLatestStrictlyEarlierReadingEvenWhenItIsDuplicated() throws Exception {
        var other = device(60);
        reading(deviceId, "TEMPERATURE", "21", T0);
        var a = reading(deviceId, "TEMPERATURE", "21", T0.plusSeconds(120));
        var b = reading(other, "TEMPERATURE", "21", T0.plusSeconds(120));
        var after = reading(deviceId, "TEMPERATURE", "21", T0.plusSeconds(180));
        // Both duplicates end the same gap; neither is the other's predecessor.
        expectFlags(a, "GAP", "DUPLICATE_TIMESTAMP");
        expectFlags(b, "GAP", "DUPLICATE_TIMESTAMP");
        expectFlags(after);
    }

    @Test
    void theFirstReadingInATimeWindowIsFlaggedByAPredecessorOutsideIt() throws Exception {
        reading("21", T0);
        var first = reading("21", T0.plusMinutes(10));
        list("?from=2026-10-01T00:05:00Z")
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(first.toString()))
                .andExpect(jsonPath("$.items[0].flags[0].type").value("GAP"))
                .andExpect(jsonPath("$.items[0].flags[0].gapSeconds").value(600));
        list("?from=2026-10-01T00:05:00Z&flag=GAP")
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test
    void aReadingCanCarryEveryFlag() throws Exception {
        var other = device(60);
        reading(deviceId, "TEMPERATURE", "21", T0);
        var a = reading(deviceId, "TEMPERATURE", "200", T0.plusMinutes(5));
        reading(other, "TEMPERATURE", "21", T0.plusMinutes(5));
        expectFlags(a, "GAP", "DUPLICATE_TIMESTAMP", "OUT_OF_RANGE");
    }

    // Flag filter

    UUID[] mixed() {
        var other = device(60);
        var clean = reading(deviceId, "TEMPERATURE", "21", T0);
        var gap = reading(deviceId, "TEMPERATURE", "21", T0.plusMinutes(5));
        var outOfRange = reading(deviceId, "TEMPERATURE", "999", T0.plusMinutes(6));
        var dupA = reading(deviceId, "TEMPERATURE", "21", T0.plusMinutes(7));
        var dupB = reading(other, "TEMPERATURE", "21", T0.plusMinutes(7));
        return new UUID[] {clean, gap, outOfRange, dupA, dupB};
    }

    @Test
    void filtersToOneFlag() throws Exception {
        var ids = mixed();
        list("?flag=GAP")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(ids[1].toString()));
    }

    @Test
    void filtersToAnyOfSeveralFlags() throws Exception {
        var ids = mixed();
        list("?flag=GAP&flag=OUT_OF_RANGE")
                .andExpect(jsonPath("$.totalItems").value(2))
                .andExpect(jsonPath("$.items[0].id").value(ids[2].toString()))
                .andExpect(jsonPath("$.items[1].id").value(ids[1].toString()));
        list("?flag=GAP&flag=OUT_OF_RANGE&flag=DUPLICATE_TIMESTAMP&size=2")
                .andExpect(jsonPath("$.totalItems").value(4))
                .andExpect(jsonPath("$.items.length()").value(2));
    }

    @Test
    void withoutAFlagFilterEverythingIsListed() throws Exception {
        mixed();
        list("").andExpect(jsonPath("$.totalItems").value(5));
    }

    @Test
    void theFlagFilterCombinesWithMetricAndTime() throws Exception {
        db.execute("update \"Device\" set metrics = '{TEMPERATURE,HUMIDITY}' where id = ?", deviceId);
        var ids = mixed();
        reading(deviceId, "HUMIDITY", "500", T0.plusMinutes(6));
        list("?flag=OUT_OF_RANGE&flag=GAP&metric=TEMPERATURE&from=2026-10-01T00:06:00Z&to=2026-10-01T00:10:00Z")
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(ids[2].toString()));
    }

    @Test
    void anUnknownFlagIsRejected() throws Exception {
        list("?flag=LATE")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }
}
