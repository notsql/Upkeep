package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** ID-45 end to end: a real key and real readings through deactivation and replacement. */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class DeviceReplacementIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    UUID estateId, locationId, assetId, deviceId;
    String devices;

    @BeforeEach
    void setup() {
        var data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        estateId = ids[0];
        locationId = ids[1];
        assetId = ids[2];
        deviceId = data.device(estateId, locationId, assetId, null);
        devices = "/estates/" + estateId + "/assets/" + assetId + "/devices";
    }

    static MockHttpServletRequestBuilder asOwner(MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(j -> j.subject("owner")));
    }

    String issueKey(UUID device) throws Exception {
        var body = mvc.perform(asOwner(post(devices + "/" + device + "/credential")))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.apiKey");
    }

    ResultActions sendReading(String key, int minutesAgo) throws Exception {
        var at = DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(
                OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(minutesAgo).withNano(0));
        return mvc.perform(post("/device-api/readings")
                .header("Authorization", "Bearer " + key)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"metric\":\"TEMPERATURE\",\"value\":21.5,\"unit\":\"°C\",\"measuredAt\":\"%s\"}"
                        .formatted(at)));
    }

    ResultActions deactivate(UUID device) throws Exception {
        return mvc.perform(asOwner(post(devices + "/" + device + "/deactivate"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"identifier\":\"DEV-%s\"}".formatted(device)));
    }

    ResultActions replace(UUID device, String identifier) throws Exception {
        return mvc.perform(asOwner(post(devices + "/" + device + "/replace"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"identifier":"%s","model":"PT-200","locationId":"%s",\
                        "metrics":["TEMPERATURE"],"reportingIntervalSeconds":60}""".formatted(identifier, locationId)));
    }

    long readingsOf(UUID device) {
        return ((Number) db.fetchValue(
                        "select count(*) from \"DeviceReading\" where \"deviceId\" = ? and \"assetId\" = ?",
                        device,
                        assetId))
                .longValue();
    }

    @Test
    void deactivationRevokesTheKeyAndKeepsEveryReading() throws Exception {
        var key = issueKey(deviceId);
        sendReading(key, 2).andExpect(status().isCreated());

        deactivate(deviceId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deactivatedAt").isNotEmpty());

        sendReading(key, 1).andExpect(status().isUnauthorized());
        assertThat(readingsOf(deviceId)).isEqualTo(1);
        assertThat(db.fetchValue("select \"credentialHash\" from \"Device\" where id = ?", deviceId))
                .isNull();
        mvc.perform(asOwner(post(devices + "/" + deviceId + "/credential"))).andExpect(status().isConflict());
    }

    @Test
    void aReplacementGetsItsOwnKeyAndReadingsStayWithTheirDevice() throws Exception {
        var oldKey = issueKey(deviceId);
        sendReading(oldKey, 3).andExpect(status().isCreated());

        var body = replace(deviceId, "PUMP-NEW")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.replacesDeviceId").value(deviceId.toString()))
                .andReturn()
                .getResponse()
                .getContentAsString();
        var newId = UUID.fromString(JsonPath.read(body, "$.id"));

        sendReading(oldKey, 2).andExpect(status().isUnauthorized());
        var newKey = issueKey(newId);
        sendReading(newKey, 1).andExpect(status().isCreated());

        assertThat(readingsOf(deviceId)).isEqualTo(1);
        assertThat(readingsOf(newId)).isEqualTo(1);
        mvc.perform(asOwner(get(devices)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(newId.toString()))
                .andExpect(jsonPath("$[0].replacesDeviceId").value(deviceId.toString()))
                .andExpect(jsonPath("$[0].deactivatedAt").value(nullValue()))
                .andExpect(jsonPath("$[1].id").value(deviceId.toString()))
                .andExpect(jsonPath("$[1].replacedByDeviceId").value(newId.toString()))
                .andExpect(jsonPath("$[1].deactivatedAt").isNotEmpty());
    }

    @Test
    void aDeviceCanBeReplacedOnlyOnce() throws Exception {
        replace(deviceId, "PUMP-NEW").andExpect(status().isCreated());
        replace(deviceId, "PUMP-NEWER").andExpect(status().isConflict());
        assertThat(db.fetchValue("select count(*) from \"Device\" where identifier = 'PUMP-NEWER'"))
                .isEqualTo(0L);
    }
}
