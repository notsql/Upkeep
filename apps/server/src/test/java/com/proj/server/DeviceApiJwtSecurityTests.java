package com.proj.server;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** With the issuer set, device keys and user JWTs are each confined to their own API (decision 0025). */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class DeviceApiJwtSecurityTests {
    static final String USER_TOKEN = "workos.user.jwt";
    static final String KEY = "upk_" + "A".repeat(42) + "w";

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    String devices;

    @BeforeEach
    void setup() {
        var data = new DeviceTestData(db);
        var ids = data.estateWithAsset("owner");
        data.device(ids[0], ids[1], ids[2], DeviceTestData.sha256Hex(KEY));
        devices = "/estates/" + ids[0] + "/assets/" + ids[2] + "/devices";
        // The owner's token is valid; anything else fails to decode, as a real decoder would.
        when(decoder.decode(USER_TOKEN))
                .thenReturn(Jwt.withTokenValue(USER_TOKEN)
                        .header("alg", "RS256")
                        .subject("owner")
                        .issuedAt(Instant.now())
                        .expiresAt(Instant.now().plusSeconds(300))
                        .build());
        when(decoder.decode(KEY)).thenThrow(new BadJwtException("Malformed token"));
    }

    @Test
    void theOwnersJwtWorksOnManagerEndpoints() throws Exception {
        mvc.perform(get(devices).header("Authorization", "Bearer " + USER_TOKEN))
                .andExpect(status().isOk());
    }

    @Test
    void rejectsAUserJwtOnTheDeviceApi() throws Exception {
        mvc.perform(get("/device-api/test/whoami").header("Authorization", "Bearer " + USER_TOKEN))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("A valid device key is required."));
    }

    @Test
    void rejectsADeviceKeyOnManagerEndpoints() throws Exception {
        mvc.perform(get(devices).header("Authorization", "Bearer " + KEY)).andExpect(status().isUnauthorized());
        mvc.perform(get("/estates/" + UUID.randomUUID()).header("Authorization", "Bearer " + KEY))
                .andExpect(status().isUnauthorized());
    }
}
