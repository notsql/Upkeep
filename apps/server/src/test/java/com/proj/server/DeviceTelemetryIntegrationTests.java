package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
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

/** POST /device-api/telemetry: a batch of readings, each decided as /device-api/readings would. */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class DeviceTelemetryIntegrationTests {
    static final String TELEMETRY = "/device-api/telemetry";

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
        key = issueKey();
    }

    String issueKey() throws Exception {
        var path = "/estates/" + estateId + "/assets/" + assetId + "/devices/" + deviceId + "/credential";
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

    static String batch(String... items) {
        return "{\"readings\":[" + String.join(",", items) + "]}";
    }

    static String secondsAgo(long seconds) {
        return DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(
                OffsetDateTime.now(ZoneOffset.UTC).minusSeconds(seconds).truncatedTo(ChronoUnit.SECONDS));
    }

    ResultActions send(String body) throws Exception {
        return send("Bearer " + key, body);
    }

    ResultActions send(String authorization, String body) throws Exception {
        var request = post(TELEMETRY).contentType(MediaType.APPLICATION_JSON).content(body);
        if (authorization != null) {
            request.header("Authorization", authorization);
        }
        return mvc.perform(request);
    }

    long storedReadings() {
        return ((Number) db.fetchValue("select count(*) from \"DeviceReading\" where \"deviceId\" = ?", deviceId))
                .longValue();
    }

    OffsetDateTime lastSeen() {
        return db.fetchValue("select \"lastSeenAt\" from \"Device\" where id = ?", deviceId) instanceof OffsetDateTime t
                ? t
                : null;
    }

    @Test
    void storesEachReadingAndReturnsResultsInRequestOrder() throws Exception {
        var first = secondsAgo(2);
        var second = secondsAgo(1);
        send(batch(temperature("21.5", first), temperature("21.6", second)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.length()").value(2))
                .andExpect(jsonPath("$.results[0].index").value(0))
                .andExpect(jsonPath("$.results[0].status").value("CREATED"))
                .andExpect(jsonPath("$.results[0].reading.measuredAt").value(first))
                .andExpect(jsonPath("$.results[0].reading.value").value(21.5))
                .andExpect(jsonPath("$.results[0].reading.deviceId").value(deviceId.toString()))
                .andExpect(jsonPath("$.results[0].reading.assetId").value(assetId.toString()))
                .andExpect(jsonPath("$.results[0].message").doesNotExist())
                .andExpect(jsonPath("$.results[1].index").value(1))
                .andExpect(jsonPath("$.results[1].status").value("CREATED"))
                .andExpect(jsonPath("$.results[1].reading.measuredAt").value(second));
        assertThat(storedReadings()).isEqualTo(2);
    }

    @Test
    void decidesEachItemOnItsOwn() throws Exception {
        var stored = secondsAgo(30);
        send(batch(temperature("20.0", stored))).andExpect(status().isOk());

        var good = secondsAgo(1);
        send(batch(
                        temperature("20.0", stored),
                        "{\"metric\":\"TEMPERATURE\",\"value\":21.5,\"unit\":\"C\",\"measuredAt\":\"" + good + "\"}",
                        temperature("25.0", stored),
                        temperature("21.5", good)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].status").value("ALREADY_STORED"))
                .andExpect(jsonPath("$.results[0].reading.value").value(20.0))
                .andExpect(jsonPath("$.results[0].message").doesNotExist())
                .andExpect(jsonPath("$.results[1].index").value(1))
                .andExpect(jsonPath("$.results[1].status").value("INVALID"))
                .andExpect(jsonPath("$.results[1].message").value("unit for TEMPERATURE must be °C; got C."))
                .andExpect(jsonPath("$.results[1].reading").doesNotExist())
                .andExpect(jsonPath("$.results[2].status").value("CONFLICT"))
                .andExpect(jsonPath("$.results[2].message")
                        .value("A different value is already stored for TEMPERATURE at " + stored
                                + ". A correction needs a new measuredAt."))
                .andExpect(jsonPath("$.results[2].reading").doesNotExist())
                .andExpect(jsonPath("$.results[3].status").value("CREATED"));
        assertThat(storedReadings()).isEqualTo(2);
    }

    @Test
    void reportsEachSingleReadingRuleAsInvalid() throws Exception {
        send(batch(
                        "21.5",
                        "{\"metric\":\"TEMPERATURE\",\"unit\":\"°C\",\"measuredAt\":\"" + secondsAgo(1) + "\"}",
                        "{\"metric\":\"PRESSURE\",\"value\":2.1,\"unit\":\"bar\",\"measuredAt\":\"" + secondsAgo(1)
                                + "\"}",
                        temperature("\"21.5\"", secondsAgo(1)),
                        "{\"metric\":\"TEMPERATURE\",\"value\":1,\"unit\":\"°C\",\"measuredAt\":\"" + secondsAgo(1)
                                + "\",\"deviceId\":\"x\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].status").value("INVALID"))
                .andExpect(jsonPath("$.results[0].message").value("A reading must be a JSON object."))
                .andExpect(jsonPath("$.results[1].message").value("value is required."))
                .andExpect(jsonPath("$.results[2].message")
                        .value("metric PRESSURE is not registered for this device. Registered metrics: TEMPERATURE."))
                .andExpect(jsonPath("$.results[3].message").value(startsWith("value must be a JSON number")))
                .andExpect(jsonPath("$.results[4].message").value(startsWith("deviceId is not accepted.")));
        assertThat(storedReadings()).isZero();
        assertThat(lastSeen()).isNull();
    }

    @Test
    void anIdenticalItemLaterInTheBatchIsAlreadyStoredAndADifferentOneConflicts() throws Exception {
        var at = secondsAgo(1);
        var body = send(batch(temperature("21.5", at), temperature("21.50", at), temperature("22.0", at)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].status").value("CREATED"))
                .andExpect(jsonPath("$.results[1].status").value("ALREADY_STORED"))
                .andExpect(jsonPath("$.results[2].status").value("CONFLICT"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        assertThat((String) JsonPath.read(body, "$.results[1].reading.id"))
                .isEqualTo(JsonPath.read(body, "$.results[0].reading.id"));
        assertThat(storedReadings()).isOne();
    }

    @Test
    void setsLastSeenToTheReceiptTimeWhenAnItemIsStored() throws Exception {
        var before = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
        send(batch(temperature("21.5", secondsAgo(3600)))).andExpect(status().isOk());
        assertThat(lastSeen()).isBetween(before, OffsetDateTime.now(ZoneOffset.UTC));
    }

    @Test
    void anAlreadyStoredItemAlsoUpdatesLastSeen() throws Exception {
        var at = secondsAgo(1);
        send(batch(temperature("21.5", at))).andExpect(status().isOk());
        var old = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        db.execute("update \"Device\" set \"lastSeenAt\" = ?::timestamptz where id = ?", old, deviceId);
        send(batch(temperature("21.5", at)))
                .andExpect(jsonPath("$.results[0].status").value("ALREADY_STORED"));
        assertThat(lastSeen()).isAfter(old);
    }

    @Test
    void lastSeenIsUnchangedWhenNoItemIsStored() throws Exception {
        var at = secondsAgo(1);
        send(batch(temperature("21.5", at))).andExpect(status().isOk());
        db.execute("update \"Device\" set \"lastSeenAt\" = null where id = ?", deviceId);
        send(batch(temperature("22.0", at), temperature("1", "yesterday")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results[0].status").value("CONFLICT"))
                .andExpect(jsonPath("$.results[1].status").value("INVALID"));
        assertThat(lastSeen()).isNull();
    }

    @Test
    void lastSeenNeverMovesBackwards() throws Exception {
        var later = OffsetDateTime.now(ZoneOffset.UTC).plusHours(1).truncatedTo(ChronoUnit.MICROS);
        db.execute("update \"Device\" set \"lastSeenAt\" = ?::timestamptz where id = ?", later, deviceId);
        send(batch(temperature("21.5", secondsAgo(1)))).andExpect(status().isOk());
        assertThat(lastSeen()).isEqualTo(later);
    }

    @Test
    void rejectsTheWholeBatchInAnInactiveEstate() throws Exception {
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        send(batch(temperature("21.5", secondsAgo(1))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("This estate is inactive. Readings are not accepted."));
        assertThat(storedReadings()).isZero();
        assertThat(lastSeen()).isNull();
    }

    @Test
    void rejectsAMalformedBatchAndStoresNothing() throws Exception {
        var valid = temperature("21.5", secondsAgo(1));
        var cases = new String[][] {
            {"not json", "The request body must be a JSON object, with each field given once."},
            {"[" + valid + "]", "The request body must be a JSON object, with each field given once."},
            {"{}", "readings is required."},
            {"{\"readings\":null}", "readings is required."},
            {"{\"readings\":[" + valid + "],\"deviceId\":\"x\"}", "deviceId is not accepted. A batch has only readings."
            },
            {"{\"readings\":" + valid + "}", "readings must be an array."},
            {"{\"readings\":[]}", "readings must have 1 to 500 items; got 0."},
            {
                batch(Collections.nCopies(501, valid).toArray(String[]::new)),
                "readings must have 1 to 500 items; got 501."
            },
        };
        for (var c : cases) {
            send(c[0])
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value(c[1]));
        }
        mvc.perform(post(TELEMETRY).header("Authorization", "Bearer " + key)).andExpect(status().isBadRequest());
        assertThat(storedReadings()).isZero();
        assertThat(lastSeen()).isNull();
    }

    @Test
    void acceptsFiveHundredItems() throws Exception {
        var items = new String[500];
        for (var i = 0; i < items.length; i++) {
            items[i] = temperature("21.5", secondsAgo(i + 1));
        }
        send(batch(items))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.results.length()").value(500));
        assertThat(storedReadings()).isEqualTo(500);
    }

    @Test
    void requiresAValidDeviceKeyAndStoresNothingWithoutOne() throws Exception {
        var body = batch(temperature("21.5", secondsAgo(1)));
        send(null, body).andExpect(status().isUnauthorized());
        send("Bearer not-a-key", body).andExpect(status().isUnauthorized());
        send("Bearer upk_unknownunknownunknownunknownunknown", body).andExpect(status().isUnauthorized());
        var replaced = key;
        key = issueKey();
        send("Bearer " + replaced, body).andExpect(status().isUnauthorized());
        assertThat(storedReadings()).isZero();
        assertThat(lastSeen()).isNull();
    }
}
