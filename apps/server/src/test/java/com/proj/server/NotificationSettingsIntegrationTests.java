package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.workos.WorkOSService;
import java.time.LocalDate;
import java.time.ZoneId;
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
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/** Per-estate notification settings (spec notifications.md, "Notification settings"). */
@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
            "app.r2.endpoint=",
            "app.r2.access-id=",
            "app.r2.secret-access-key=",
            "app.r2.bucket-name="
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class NotificationSettingsIntegrationTests {
    static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Singapore"));
    static final String VALID = "{\"anomalyScoreThreshold\":0.75,\"serviceLeadDays\":7,\"repairLeadDays\":60}";

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    UUID estateId;

    @BeforeEach
    void setup() {
        estateId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                estateId,
                estateId.toString());
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    ResultActions read(String user) throws Exception {
        return mvc.perform(
                get("/estates/" + estateId + "/notification-settings").with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions save(String user, String body) throws Exception {
        return mvc.perform(put("/estates/" + estateId + "/notification-settings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(jwt().jwt(j -> j.subject(user))));
    }

    int sweeps() {
        return ((Number) db.fetchValue("select count(*) from \"NotificationSweep\" where \"estateId\" = ?", estateId))
                .intValue();
    }

    @Test
    void anUnsavedEstateUsesTheDefaults() throws Exception {
        read("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anomalyScoreThreshold").value(0.51))
                .andExpect(jsonPath("$.serviceLeadDays").value(14))
                .andExpect(jsonPath("$.repairLeadDays").value(30));
    }

    @Test
    void theOwnerSavesSettings() throws Exception {
        save("owner", VALID)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anomalyScoreThreshold").value(0.75))
                .andExpect(jsonPath("$.serviceLeadDays").value(7))
                .andExpect(jsonPath("$.repairLeadDays").value(60));
        read("owner").andExpect(jsonPath("$.anomalyScoreThreshold").value(0.75));
        save("owner", "{\"anomalyScoreThreshold\":1,\"serviceLeadDays\":0,\"repairLeadDays\":90}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anomalyScoreThreshold").value(1.0))
                .andExpect(jsonPath("$.serviceLeadDays").value(0));
    }

    @Test
    void aManagerCanChangeThem() throws Exception {
        membership("manager", "MANAGER");
        save("manager", VALID).andExpect(status().isOk());
        read("manager").andExpect(jsonPath("$.repairLeadDays").value(60));
    }

    @ParameterizedTest
    @ValueSource(strings = {"MEMBER", "COUNCIL", "CREW"})
    void otherRolesCannotSeeThem(String role) throws Exception {
        membership("someone", role);
        read("someone").andExpect(status().isNotFound());
        save("someone", VALID).andExpect(status().isNotFound());
    }

    @Test
    void anUnknownEstateIs404() throws Exception {
        mvc.perform(get("/estates/" + UUID.randomUUID() + "/notification-settings")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{\"anomalyScoreThreshold\":0.50,\"serviceLeadDays\":7,\"repairLeadDays\":30}",
                "{\"anomalyScoreThreshold\":1.01,\"serviceLeadDays\":7,\"repairLeadDays\":30}",
                "{\"anomalyScoreThreshold\":0.555,\"serviceLeadDays\":7,\"repairLeadDays\":30}",
                "{\"anomalyScoreThreshold\":0.75,\"serviceLeadDays\":-1,\"repairLeadDays\":30}",
                "{\"anomalyScoreThreshold\":0.75,\"serviceLeadDays\":366,\"repairLeadDays\":30}",
                "{\"anomalyScoreThreshold\":0.75,\"serviceLeadDays\":1.5,\"repairLeadDays\":30}",
                "{\"anomalyScoreThreshold\":0.75,\"serviceLeadDays\":7,\"repairLeadDays\":45}",
                "{\"serviceLeadDays\":7,\"repairLeadDays\":30}",
                "{\"anomalyScoreThreshold\":0.75,\"repairLeadDays\":30}",
                "{\"anomalyScoreThreshold\":0.75,\"serviceLeadDays\":7}",
                "not json"
            })
    void rejectsInvalidSettings(String body) throws Exception {
        save("owner", body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").isNotEmpty());
        read("owner").andExpect(jsonPath("$.serviceLeadDays").value(14));
    }

    @Test
    void anInactiveEstateCannotChangeThem() throws Exception {
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        save("owner", VALID).andExpect(status().isConflict());
        read("owner").andExpect(status().isOk());
    }

    @Test
    void savingMakesTodaysSweepRunAgain() throws Exception {
        db.execute("insert into \"NotificationSweep\" (\"estateId\", day) values (?, ?)", estateId, TODAY);
        db.execute("insert into \"NotificationSweep\" (\"estateId\", day) values (?, ?)", estateId, TODAY.minusDays(1));
        save("owner", VALID).andExpect(status().isOk());
        assertEquals(1, sweeps());
    }
}
