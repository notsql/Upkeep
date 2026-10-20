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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** GET /estates/{estateId}/assets/{assetId}/readings (spec suspect-readings, "Reading list"). */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AssetReadingIntegrationTests {
    static final OffsetDateTime T0 = OffsetDateTime.parse("2026-10-01T00:00:00Z");

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    DeviceTestData data;
    UUID estateId, locationId, assetId, deviceId;
    String readings;

    @BeforeEach
    void setup() {
        data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        estateId = ids[0];
        locationId = ids[1];
        assetId = ids[2];
        deviceId = data.device(estateId, locationId, assetId, null);
        readings = path(estateId, assetId);
    }

    static String path(UUID estate, UUID asset) {
        return "/estates/" + estate + "/assets/" + asset + "/readings";
    }

    UUID reading(UUID device, UUID asset, String metric, String value, OffsetDateTime measuredAt) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"DeviceReading\" (id, \"deviceId\", \"estateId\", \"assetId\", metric, value, \"measuredAt\", \"receivedAt\") values (?, ?, ?, ?, ?, ?, ?::timestamptz, now())",
                id,
                device,
                estateId,
                asset,
                metric,
                new BigDecimal(value),
                measuredAt);
        return id;
    }

    UUID reading(String metric, String value, OffsetDateTime measuredAt) {
        return reading(deviceId, assetId, metric, value, measuredAt);
    }

    static MockHttpServletRequestBuilder as(String subject, MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(j -> j.subject(subject)));
    }

    ResultActions list(String query) throws Exception {
        return mvc.perform(as("owner", get(readings + query)));
    }

    @Test
    void listsAnAssetsReadingsNewestFirstWithUnitAndDeviceIdentifier() throws Exception {
        db.execute("update \"Device\" set metrics = '{TEMPERATURE,PRESSURE}' where id = ?", deviceId);
        reading("TEMPERATURE", "21.5", T0);
        var newest = reading("PRESSURE", "3.25", T0.plusMinutes(2));
        reading("TEMPERATURE", "22", T0.plusMinutes(1));
        // Another asset's reading is never listed.
        var otherAsset = data.asset(estateId, locationId);
        var otherDevice = data.device(estateId, locationId, otherAsset, null);
        reading(otherDevice, otherAsset, "TEMPERATURE", "99", T0.plusMinutes(3));

        list("").andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(50))
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.items[0].id").value(newest.toString()))
                .andExpect(jsonPath("$.items[0].metric").value("PRESSURE"))
                .andExpect(jsonPath("$.items[0].unit").value("bar"))
                .andExpect(jsonPath("$.items[0].value").value(3.25))
                .andExpect(jsonPath("$.items[0].deviceId").value(deviceId.toString()))
                .andExpect(jsonPath("$.items[0].deviceIdentifier").value("DEV-" + deviceId))
                .andExpect(jsonPath("$.items[0].measuredAt").value("2026-10-01T00:02:00Z"))
                .andExpect(jsonPath("$.items[1].unit").value("°C"))
                .andExpect(jsonPath("$.items[1].measuredAt").value("2026-10-01T00:01:00Z"))
                .andExpect(jsonPath("$.items[2].measuredAt").value("2026-10-01T00:00:00Z"));
    }

    @Test
    void anAssetWithNoReadingsListsNothing() throws Exception {
        list("").andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(0))
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void filtersByMetric() throws Exception {
        reading("TEMPERATURE", "21", T0);
        reading("PRESSURE", "3", T0.plusMinutes(1));
        list("?metric=PRESSURE")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].metric").value("PRESSURE"));
    }

    @Test
    void filtersByTimeRangeFromInclusiveToExclusive() throws Exception {
        reading("TEMPERATURE", "1", T0.minusMinutes(1));
        var atFrom = reading("TEMPERATURE", "2", T0);
        reading("TEMPERATURE", "3", T0.plusMinutes(10));
        list("?from=2026-10-01T00:00:00Z&to=2026-10-01T00:10:00Z")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(atFrom.toString()));
    }

    @Test
    void filtersCombine() throws Exception {
        reading("TEMPERATURE", "1", T0);
        var match = reading("PRESSURE", "2", T0.plusMinutes(1));
        reading("PRESSURE", "3", T0.plusMinutes(10));
        reading("TEMPERATURE", "4", T0.plusMinutes(2));
        list("?metric=PRESSURE&from=2026-10-01T00:00:00Z&to=2026-10-01T00:05:00Z")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].id").value(match.toString()));
    }

    @Test
    void paginatesAndReportsTheTotalMatchingCount() throws Exception {
        for (int i = 0; i < 5; i++) {
            reading("TEMPERATURE", String.valueOf(i), T0.plusMinutes(i));
        }
        list("?page=1&size=2")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.totalItems").value(5))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].measuredAt").value("2026-10-01T00:02:00Z"))
                .andExpect(jsonPath("$.items[1].measuredAt").value("2026-10-01T00:01:00Z"));
        list("?page=2&size=2").andExpect(jsonPath("$.items.length()").value(1));
        list("?size=200")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(200));
    }

    @Test
    void sizeDefaultsToFifty() throws Exception {
        for (int i = 0; i < 51; i++) {
            reading("TEMPERATURE", String.valueOf(i), T0.plusMinutes(i));
        }
        list("").andExpect(jsonPath("$.items.length()").value(50))
                .andExpect(jsonPath("$.totalItems").value(51));
    }

    @Test
    void aDeactivatedAssetsReadingsCanStillBeListed() throws Exception {
        reading("TEMPERATURE", "21", T0);
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", assetId);
        list("").andExpect(status().isOk()).andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test
    void requiresAuthentication() throws Exception {
        mvc.perform(get(readings)).andExpect(status().isUnauthorized());
    }

    @Test
    void anEstateTheCallerDoesNotOwnIsNotFound() throws Exception {
        reading("TEMPERATURE", "21", T0);
        mvc.perform(as("someone-else", get(readings))).andExpect(status().isNotFound());
    }

    @Test
    void anUnknownAssetIsNotFound() throws Exception {
        list("").andExpect(status().isOk());
        mvc.perform(as("owner", get(path(estateId, UUID.randomUUID())))).andExpect(status().isNotFound());
    }

    @Test
    void anAssetInAnotherEstateIsNotFound() throws Exception {
        var other = data.estateWithAsset("owner");
        mvc.perform(as("owner", get(path(estateId, other[2])))).andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "?metric=NOISE",
                "?from=2026-10-01T00:10:00Z&to=2026-10-01T00:00:00Z",
                "?from=2026-10-01T00:00:00Z&to=2026-10-01T00:00:00Z",
                "?from=yesterday",
                "?size=0",
                "?size=201",
                "?page=-1"
            })
    void rejectsInvalidFilters(String query) throws Exception {
        list(query)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }
}
