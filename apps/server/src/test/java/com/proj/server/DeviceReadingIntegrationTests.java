package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/** POST /device-api/readings (ID-43), with keys issued through the owner's endpoint (ID-42). */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class DeviceReadingIntegrationTests {
    static final String READINGS = "/device-api/readings";

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    DeviceTestData data;
    UUID estateId, locationId, assetId, deviceId;
    String key;

    @BeforeEach
    void setup() throws Exception {
        data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        estateId = ids[0];
        locationId = ids[1];
        assetId = ids[2];
        deviceId = data.device(estateId, locationId, assetId, null);
        key = issueKey(deviceId);
    }

    String issueKey(UUID device) throws Exception {
        var path = "/estates/" + estateId + "/assets/" + assetId + "/devices/" + device + "/credential";
        var body = mvc.perform(post(path).with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.apiKey");
    }

    static String temperature(String value, String measuredAt) {
        return "{\"metric\":\"TEMPERATURE\",\"value\":%s,\"unit\":\"°C\",\"measuredAt\":\"%s\"}"
                .formatted(value, measuredAt);
    }

    static String minutesAgo(long minutes) {
        return iso(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(minutes).truncatedTo(ChronoUnit.SECONDS));
    }

    /** Always with seconds, as the server writes timestamps; {@code toString()} drops ":00". */
    static String iso(OffsetDateTime at) {
        return DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(at);
    }

    ResultActions send(String body) throws Exception {
        return send(key, body);
    }

    ResultActions send(String deviceKey, String body) throws Exception {
        return mvc.perform(post(READINGS)
                .header("Authorization", "Bearer " + deviceKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    long storedReadings() {
        return ((Number) db.fetchValue("select count(*) from \"DeviceReading\" where \"deviceId\" = ?", deviceId))
                .longValue();
    }

    BigDecimal storedValue() {
        return (BigDecimal) db.fetchValue("select value from \"DeviceReading\" where \"deviceId\" = ?", deviceId);
    }

    OffsetDateTime lastSeen() {
        return db.fetchValue("select \"lastSeenAt\" from \"Device\" where id = ?", deviceId) instanceof OffsetDateTime t
                ? t
                : null;
    }

    @Test
    void storesANewReadingAgainstTheDeviceAndItsAsset() throws Exception {
        var at = minutesAgo(1);
        send(temperature("21.5", at))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.deviceId").value(deviceId.toString()))
                .andExpect(jsonPath("$.assetId").value(assetId.toString()))
                .andExpect(jsonPath("$.metric").value("TEMPERATURE"))
                .andExpect(jsonPath("$.value").value(21.5))
                .andExpect(jsonPath("$.unit").value("°C"))
                .andExpect(jsonPath("$.measuredAt").value(at))
                .andExpect(jsonPath("$.receivedAt").isNotEmpty());

        var row = db.fetchOne(
                "select \"estateId\", \"assetId\", metric, value from \"DeviceReading\" where \"deviceId\" = ?",
                deviceId);
        assertThat(row.get(0, UUID.class)).isEqualTo(estateId);
        assertThat(row.get(1, UUID.class)).isEqualTo(assetId);
        assertThat(row.get(2, String.class)).isEqualTo("TEMPERATURE");
        assertThat(row.get(3, BigDecimal.class)).isEqualByComparingTo("21.5");
    }

    @Test
    void anIdenticalRetryReturnsTheStoredReadingWithoutStoringItAgain() throws Exception {
        var utc = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1).truncatedTo(ChronoUnit.SECONDS);
        var first = send(temperature("21.5", iso(utc)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        // Same instant in another offset, same value with a trailing zero.
        var retry = temperature("21.50", iso(utc.withOffsetSameInstant(ZoneOffset.ofHours(8))));
        send(retry)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value((String) JsonPath.read(first, "$.id")))
                .andExpect(jsonPath("$.receivedAt").value((String) JsonPath.read(first, "$.receivedAt")));
        assertThat(storedReadings()).isEqualTo(1);
    }

    @Test
    void aDifferentValueForTheSameTimestampIsRejectedAndChangesNothing() throws Exception {
        var at = minutesAgo(1);
        send(temperature("21.5", at)).andExpect(status().isCreated());
        send(temperature("22.0", at))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message")
                        .value(org.hamcrest.Matchers.startsWith(
                                "A different value is already stored for TEMPERATURE at ")));
        assertThat(storedReadings()).isEqualTo(1);
        assertThat(storedValue()).isEqualByComparingTo("21.5");
    }

    @Test
    void acceptsReadingsThatArriveOutOfOrder() throws Exception {
        send(temperature("21.5", minutesAgo(1))).andExpect(status().isCreated());
        send(temperature("20.9", minutesAgo(30))).andExpect(status().isCreated());
        assertThat(storedReadings()).isEqualTo(2);
    }

    @Test
    void rejectsAnInvalidPayloadWithAReasonAndStoresNothing() throws Exception {
        send("{\"metric\":\"TEMPERATURE\",\"value\":21.5,\"unit\":\"C\",\"measuredAt\":\"" + minutesAgo(1) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("unit for TEMPERATURE must be °C; got C."));
        send("not json")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value("The request body must be a JSON object, with each field given once."));
        mvc.perform(post(READINGS).header("Authorization", "Bearer " + key))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertThat(storedReadings()).isZero();
        assertThat(lastSeen()).isNull();
    }

    @Test
    void rejectsAMetricNotRegisteredForThisDevice() throws Exception {
        send("{\"metric\":\"PRESSURE\",\"value\":2.1,\"unit\":\"bar\",\"measuredAt\":\"" + minutesAgo(1) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message")
                        .value("metric PRESSURE is not registered for this device. Registered metrics: TEMPERATURE."));
    }

    @Test
    void rejectsReadingsForARetiredAsset() throws Exception {
        db.execute(
                "update \"Asset\" set \"deactivatedAt\" = now(), \"retiredOn\" = current_date where id = ?", assetId);
        send(temperature("21.5", minutesAgo(1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("This asset is retired. Readings are not accepted."));
        assertThat(storedReadings()).isZero();
        assertThat(lastSeen()).isNull();
    }

    @Test
    void rejectsReadingsInAnInactiveEstate() throws Exception {
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        send(temperature("21.5", minutesAgo(1)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("This estate is inactive. Readings are not accepted."));
        assertThat(storedReadings()).isZero();
        assertThat(lastSeen()).isNull();
    }

    @Test
    void acceptsReadingsWhenOnlyTheDevicesLocationIsDeactivated() throws Exception {
        db.execute("update \"Location\" set \"deactivatedAt\" = now() where id = ?", locationId);
        send(temperature("21.5", minutesAgo(1))).andExpect(status().isCreated());
    }

    @Test
    void lastSeenIsTheReceiptTimeNotTheMeasurementTime() throws Exception {
        var before = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
        send(temperature("21.5", minutesAgo(60))).andExpect(status().isCreated());
        var after = OffsetDateTime.now(ZoneOffset.UTC);
        assertThat(lastSeen()).isBetween(before, after);
    }

    @Test
    void anIdenticalRetryAlsoUpdatesLastSeen() throws Exception {
        var at = minutesAgo(1);
        send(temperature("21.5", at)).andExpect(status().isCreated());
        var old = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        db.execute("update \"Device\" set \"lastSeenAt\" = ?::timestamptz where id = ?", old, deviceId);
        send(temperature("21.5", at)).andExpect(status().isOk());
        assertThat(lastSeen()).isAfter(old);
    }

    @Test
    void lastSeenNeverMovesBackwards() throws Exception {
        var later = OffsetDateTime.now(ZoneOffset.UTC).plusHours(1).truncatedTo(ChronoUnit.MICROS);
        db.execute("update \"Device\" set \"lastSeenAt\" = ?::timestamptz where id = ?", later, deviceId);
        send(temperature("21.5", minutesAgo(1))).andExpect(status().isCreated());
        assertThat(lastSeen()).isEqualTo(later);
    }

    @Test
    void aConflictDoesNotUpdateLastSeen() throws Exception {
        var at = minutesAgo(1);
        send(temperature("21.5", at)).andExpect(status().isCreated());
        db.execute("update \"Device\" set \"lastSeenAt\" = null where id = ?", deviceId);
        send(temperature("22.0", at)).andExpect(status().isConflict());
        assertThat(lastSeen()).isNull();
    }

    @Test
    void storesEachDevicesReadingsSeparately() throws Exception {
        var otherDevice = data.device(estateId, locationId, assetId, null);
        var otherKey = issueKey(otherDevice);
        var at = minutesAgo(1);
        send(temperature("21.5", at)).andExpect(status().isCreated());
        send(otherKey, temperature("30.0", at)).andExpect(status().isCreated());
        assertThat(storedReadings()).isEqualTo(1);
        assertThat(storedValue()).isEqualByComparingTo("21.5");
    }

    @Test
    void requiresADeviceKey() throws Exception {
        mvc.perform(post(READINGS).contentType(MediaType.APPLICATION_JSON).content(temperature("21.5", minutesAgo(1))))
                .andExpect(status().isUnauthorized());
        assertThat(storedReadings()).isZero();
    }

    /**
     * Acceptance criterion 5: behaves as a pump's temperature sensor with a real
     * issued key - a reading, a retry after a dropped response, a conflicting
     * resend and a misconfigured unit - then checks what was stored.
     */
    @Test
    void simulatedPumpCompleteFlow() throws Exception {
        var at = minutesAgo(2);
        send(temperature("48.2", at)).andExpect(status().isCreated());
        send(temperature("48.2", at)).andExpect(status().isOk());
        send(temperature("51.7", at)).andExpect(status().isConflict());
        send("{\"metric\":\"TEMPERATURE\",\"value\":48.4,\"unit\":\"degC\",\"measuredAt\":\"" + minutesAgo(1) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("unit for TEMPERATURE must be °C; got degC."));
        send(temperature("48.4", minutesAgo(1))).andExpect(status().isCreated());

        var rows = db.fetch(
                "select value, \"assetId\" from \"DeviceReading\" where \"deviceId\" = ? order by \"measuredAt\"",
                deviceId);
        assertThat(rows).hasSize(2);
        assertThat(rows.get(0).get(0, BigDecimal.class)).isEqualByComparingTo("48.2");
        assertThat(rows.get(1).get(0, BigDecimal.class)).isEqualByComparingTo("48.4");
        assertThat(rows).allSatisfy(row -> assertThat(row.get(1, UUID.class)).isEqualTo(assetId));
        assertThat(lastSeen()).isNotNull();

        mvc.perform(get("/estates/" + estateId + "/assets/" + assetId + "/devices")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].lastSeenAt").isNotEmpty());
    }
}
