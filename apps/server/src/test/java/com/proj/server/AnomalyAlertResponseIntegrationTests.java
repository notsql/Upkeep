package com.proj.server;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.workos.WorkOSService;
import java.time.Instant;
import java.util.Optional;
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

/** Acknowledging or dismissing an anomaly alert, and the asset's alert history (ID-107, spec notifications.md). */
@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AnomalyAlertResponseIntegrationTests {
    static final String REASON_TOO_LONG = "x".repeat(501);

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    UUID estateId, pumpId, alertId;

    @BeforeEach
    void setup() {
        estateId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                estateId,
                estateId.toString());
        var location = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                location,
                estateId);
        pumpId = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"updatedAt\") values (?, ?, ?, 'P-1', 'Booster pump', 'PUMP', now())",
                pumpId,
                estateId,
                location);
        alertId = anomaly(Instant.now().minusSeconds(60), false);
        when(workOS.findDisplayName("owner")).thenReturn(Optional.of("Casey Doe"));
        when(workOS.findDisplayName("manager")).thenReturn(Optional.of("Morgan Lee"));
    }

    UUID anomaly(Instant createdAt, boolean resolved) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Notification\" (id, \"estateId\", \"assetId\", type, summary, \"createdAt\", \"updatedAt\", \"resolvedAt\", condition, \"medianScore\", \"maxScore\", \"firstDetectedAt\", \"lastDetectedAt\", explanation, response) values (?, ?, ?, 'ANOMALY', 'Abnormal readings: needs attention', ?::timestamptz, ?::timestamptz, ?::timestamptz, 'NEEDS_ATTENTION', 0.74, 0.91, ?::timestamptz, ?::timestamptz, '10 consecutive abnormal readings.', 'NONE')",
                id,
                estateId,
                pumpId,
                createdAt.toString(),
                createdAt.toString(),
                resolved ? createdAt.plusSeconds(1).toString() : null,
                createdAt.minusSeconds(60).toString(),
                createdAt.minusSeconds(50).toString());
        return id;
    }

    UUID serviceDue() {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Notification\" (id, \"estateId\", \"assetId\", type, summary, \"dueOn\", \"intervalValue\", \"intervalUnit\", \"intervalSource\") values (?, ?, ?, 'SERVICE_DUE', 'Service due', current_date, 6, 'MONTH', 'CATEGORY')",
                id,
                estateId,
                pumpId);
        return id;
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    ResultActions acknowledge(String user, UUID id, String body) throws Exception {
        return mvc.perform(post("/notifications/" + id + "/acknowledge")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions dismiss(String user, UUID id, String body) throws Exception {
        return mvc.perform(post("/notifications/" + id + "/dismiss")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body)
                .with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions history(String user) throws Exception {
        return mvc.perform(get("/estates/" + estateId + "/assets/" + pumpId + "/anomaly-alerts")
                .with(jwt().jwt(j -> j.subject(user))));
    }

    static String reason(String reason) {
        return "{\"reason\":\"" + reason + "\"}";
    }

    @Test
    void acknowledgingRecordsWhoAndWhenAndMarksItRead() throws Exception {
        acknowledge("owner", alertId, "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(alertId.toString()))
                .andExpect(jsonPath("$.read").value(true))
                .andExpect(jsonPath("$.anomaly.response").value("ACKNOWLEDGED"))
                .andExpect(jsonPath("$.anomaly.respondedByName").value("Casey Doe"))
                .andExpect(jsonPath("$.anomaly.respondedAt").isNotEmpty())
                .andExpect(jsonPath("$.anomaly.responseReason").value(nullValue()))
                .andExpect(jsonPath("$.resolvedAt").value(nullValue()));
        assertEquals(
                "owner", db.fetchValue("select \"respondedByUserId\" from \"Notification\" where id = ?", alertId));
    }

    @Test
    void anAcknowledgementCanCarryAReason() throws Exception {
        acknowledge("owner", alertId, reason("  Crew booked for Monday  "))
                .andExpect(jsonPath("$.anomaly.responseReason").value("Crew booked for Monday"));
    }

    @Test
    void dismissingRequiresAReason() throws Exception {
        for (var body : new String[] {"{}", reason(""), reason("   ")}) {
            dismiss("owner", alertId, body)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Enter a reason for dismissing this alert."));
        }
        dismiss("owner", alertId, reason("Sensor was being recalibrated"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anomaly.response").value("DISMISSED"))
                .andExpect(jsonPath("$.anomaly.responseReason").value("Sensor was being recalibrated"))
                .andExpect(jsonPath("$.anomaly.respondedByName").value("Casey Doe"));
    }

    @Test
    void reasonsAreAtMost500Characters() throws Exception {
        acknowledge("owner", alertId, reason(REASON_TOO_LONG)).andExpect(status().isBadRequest());
        dismiss("owner", alertId, reason(REASON_TOO_LONG)).andExpect(status().isBadRequest());
        dismiss("owner", alertId, reason("x".repeat(500))).andExpect(status().isOk());
    }

    @Test
    void anAcknowledgedAlertCanStillBeDismissed() throws Exception {
        acknowledge("owner", alertId, "{}");
        membership("manager", "MANAGER");
        dismiss("manager", alertId, reason("False alarm"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anomaly.response").value("DISMISSED"))
                .andExpect(jsonPath("$.anomaly.respondedByName").value("Morgan Lee"));
    }

    @Test
    void aDismissedAlertIsFinal() throws Exception {
        dismiss("owner", alertId, reason("False alarm"));
        acknowledge("owner", alertId, "{}").andExpect(status().isConflict());
        dismiss("owner", alertId, reason("Again")).andExpect(status().isConflict());
    }

    @Test
    void aResolvedAlertCanStillBeActedOn() throws Exception {
        var resolved = anomaly(Instant.now().minusSeconds(600), true);
        acknowledge("owner", resolved, "{}").andExpect(status().isOk());
    }

    @Test
    void actingDoesNotResolveTheAlert() throws Exception {
        dismiss("owner", alertId, reason("False alarm"));
        assertNull(db.fetchValue("select \"resolvedAt\" from \"Notification\" where id = ?", alertId));
    }

    @Test
    void onlyAnomalyAlertsCanBeActedOn() throws Exception {
        var due = serviceDue();
        acknowledge("owner", due, "{}").andExpect(status().isConflict());
        dismiss("owner", due, reason("No")).andExpect(status().isConflict());
    }

    @ParameterizedTest
    @ValueSource(strings = {"MEMBER", "COUNCIL", "CREW"})
    void onlyManagersCanAct(String role) throws Exception {
        membership("someone", role);
        acknowledge("someone", alertId, "{}").andExpect(status().isNotFound());
        dismiss("someone", alertId, reason("No")).andExpect(status().isNotFound());
        history("someone").andExpect(status().isNotFound());
    }

    @Test
    void anUnknownAlertIs404() throws Exception {
        acknowledge("owner", UUID.randomUUID(), "{}").andExpect(status().isNotFound());
    }

    @Test
    void aRetiredAssetsAlertCannotBeActedOn() throws Exception {
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", pumpId);
        acknowledge("owner", alertId, "{}").andExpect(status().isConflict());
    }

    @Test
    void anInactiveEstatesAlertCannotBeActedOn() throws Exception {
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        dismiss("owner", alertId, reason("No")).andExpect(status().isConflict());
    }

    @Test
    void theAssetHistoryListsItsAnomalyAlertsNewestFirst() throws Exception {
        var older = anomaly(Instant.now().minusSeconds(3600), true);
        serviceDue();
        dismiss("owner", older, reason("False alarm"));
        membership("manager", "MANAGER");
        history("manager")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(alertId.toString()))
                .andExpect(jsonPath("$[1].id").value(older.toString()))
                .andExpect(jsonPath("$[1].resolvedAt").isNotEmpty())
                .andExpect(jsonPath("$[1].anomaly.response").value("DISMISSED"))
                .andExpect(jsonPath("$[1].anomaly.responseReason").value("False alarm"))
                .andExpect(jsonPath("$[1].read").value(false));
    }

    @Test
    void anUnknownAssetsHistoryIs404() throws Exception {
        mvc.perform(get("/estates/" + estateId + "/assets/" + UUID.randomUUID() + "/anomaly-alerts")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isNotFound());
    }
}
