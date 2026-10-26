package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * /device-api with the JWT issuer UNSET, where the main chain allows everything
 * (decision 0025). Blanking the dotenv key keeps a local apps/server/.env from
 * setting the issuer, so this matches local development and CI alike.
 */
@SpringBootTest(
        properties = {
            "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI=",
            "SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES="
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class DeviceApiSecurityTests {
    static final String WHOAMI = "/device-api/test/whoami";
    static final String REJECTED = "A valid device key is required.";
    static final String KEY = "upk_" + "A".repeat(42) + "w";
    static final String OTHER_KEY = "upk_" + "B".repeat(42) + "w";

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    UUID deviceId;

    @BeforeEach
    void setup() {
        var data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        deviceId = data.device(ids[0], ids[1], ids[2], DeviceTestData.sha256Hex(KEY));
    }

    @Test
    void requiresADeviceKeyEvenThoughTheIssuerIsUnset() throws Exception {
        mvc.perform(get(WHOAMI))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(REJECTED));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "Bearer",
                "Bearer ",
                "Bearer not-a-device-key",
                "Bearer upk_",
                "Bearer upk_short",
                "Basic dXNlcjpwYXNz",
                "upk_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAw",
                // Well-formed, but no device holds it.
                "Bearer upk_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCw"
            })
    void rejectsMalformedAndUnknownKeysWithOneGenericMessage(String header) throws Exception {
        mvc.perform(get(WHOAMI).header("Authorization", header))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(REJECTED));
    }

    @Test
    void authenticatesAValidKeyAsExactlyThatDevice() throws Exception {
        var data = new DeviceTestData(db);
        var other = data.estateWithAsset("someone-else");
        data.device(other[0], other[1], other[2], DeviceTestData.sha256Hex(OTHER_KEY));

        mvc.perform(get(WHOAMI).header("Authorization", "Bearer " + KEY))
                .andExpect(status().isOk())
                .andExpect(content().string(deviceId.toString()));
    }

    @Test
    void rejectsAReplacedKey() throws Exception {
        db.execute(
                "update \"Device\" set \"credentialHash\" = ? where id = ?",
                DeviceTestData.sha256Hex(OTHER_KEY),
                deviceId);

        mvc.perform(get(WHOAMI).header("Authorization", "Bearer " + KEY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(REJECTED));
        mvc.perform(get(WHOAMI).header("Authorization", "Bearer " + OTHER_KEY))
                .andExpect(status().isOk())
                .andExpect(content().string(deviceId.toString()));
    }

    @Test
    void rejectsTheKeyOfADeactivatedDeviceEvenIfItsHashRemains() throws Exception {
        db.execute("update \"Device\" set \"deactivatedAt\" = now() where id = ?", deviceId);

        mvc.perform(get(WHOAMI).header("Authorization", "Bearer " + KEY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(REJECTED));
    }
}
