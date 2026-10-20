package com.proj.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** POST /estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential (ID-42). */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class DeviceCredentialIntegrationTests {
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
        deviceId = data.device(estateId, locationId, assetId, null);
    }

    static MockHttpServletRequestBuilder as(String subject, MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(j -> j.subject(subject)));
    }

    String credential(UUID estate, UUID asset, UUID device) {
        return "/estates/" + estate + "/assets/" + asset + "/devices/" + device + "/credential";
    }

    String issue() throws Exception {
        var body = mvc.perform(as("owner", post(credential(estateId, assetId, deviceId))))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.apiKey");
    }

    String storedHash() {
        return db.fetchValue("select \"credentialHash\" from \"Device\" where id = ?", deviceId)
                .toString();
    }

    @Test
    void issuesAKeyOnceToTheOwner() throws Exception {
        mvc.perform(as("owner", post(credential(estateId, assetId, deviceId))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deviceId").value(deviceId.toString()))
                .andExpect(jsonPath("$.apiKey").value(matchesPattern("^upk_[A-Za-z0-9_-]{43}$")))
                .andExpect(jsonPath("$.issuedAt").value(notNullValue()));
    }

    @Test
    void storesOnlyTheSha256HexOfTheKey() throws Exception {
        var key = issue();
        var hash = storedHash();
        assertThat(hash).isEqualTo(DeviceTestData.sha256Hex(key)).doesNotContain(key.substring(4));
        assertThat(db.fetchValue("select count(*) from \"Device\" where \"credentialHash\" = ?", key))
                .isEqualTo(0L);
    }

    @Test
    void theIssuedKeyAuthenticatesAsTheDevice() throws Exception {
        var key = issue();
        mvc.perform(get("/device-api/test/whoami").header("Authorization", "Bearer " + key))
                .andExpect(status().isOk())
                .andExpect(content().string(deviceId.toString()));
    }

    @Test
    void reissuingReplacesTheKey() throws Exception {
        var first = issue();
        var second = issue();
        assertThat(second).isNotEqualTo(first);
        mvc.perform(get("/device-api/test/whoami").header("Authorization", "Bearer " + first))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/device-api/test/whoami").header("Authorization", "Bearer " + second))
                .andExpect(status().isOk())
                .andExpect(content().string(deviceId.toString()));
    }

    @Test
    void deviceResponseShowsWhenACredentialWasIssued() throws Exception {
        var devices = "/estates/" + estateId + "/assets/" + assetId + "/devices";
        mvc.perform(as("owner", get(devices)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].credentialIssuedAt").value(nullValue()));
        issue();
        mvc.perform(as("owner", get(devices)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].credentialIssuedAt").value(notNullValue()))
                .andExpect(jsonPath("$[0].apiKey").doesNotExist())
                .andExpect(jsonPath("$[0].credentialHash").doesNotExist());
    }

    @Test
    void hidesUnknownDevicesDevicesElsewhereAndEstatesTheCallerDoesNotOwn() throws Exception {
        var otherAsset = data.asset(estateId, locationId);
        var deviceOnOtherAsset = data.device(estateId, locationId, otherAsset, null);
        var otherEstate = data.estateWithAsset("owner");
        var deviceInOtherEstate = data.device(otherEstate[0], otherEstate[1], otherEstate[2], null);

        mvc.perform(as("owner", post(credential(estateId, assetId, UUID.randomUUID()))))
                .andExpect(status().isNotFound());
        mvc.perform(as("owner", post(credential(estateId, assetId, deviceOnOtherAsset))))
                .andExpect(status().isNotFound());
        mvc.perform(as("owner", post(credential(estateId, assetId, deviceInOtherEstate))))
                .andExpect(status().isNotFound());
        mvc.perform(as("outsider", post(credential(estateId, assetId, deviceId))))
                .andExpect(status().isNotFound());
        assertThat(db.fetchValue("select count(*) from \"Device\" where \"credentialHash\" is not null"))
                .isEqualTo(0L);
    }

    @Test
    void rejectsADeviceOnARetiredAsset() throws Exception {
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", assetId);
        mvc.perform(as("owner", post(credential(estateId, assetId, deviceId))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void rejectsADeviceInAnInactiveEstate() throws Exception {
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        mvc.perform(as("owner", post(credential(estateId, assetId, deviceId))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void requiresSignIn() throws Exception {
        mvc.perform(post(credential(estateId, assetId, deviceId))).andExpect(status().isUnauthorized());
    }
}
