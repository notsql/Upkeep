package com.proj.server;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.workos.WorkOSService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
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
import org.springframework.transaction.annotation.Transactional;

/** The in-app notification inbox (ID-100, spec notifications.md). */
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
class NotificationInboxIntegrationTests {
    static final Instant NOW = Instant.now().truncatedTo(ChronoUnit.SECONDS);

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    UUID estateId, pump;

    @BeforeEach
    void setup() {
        estateId = estate("owner", "Harbour View");
        pump = asset(estateId, "P-1");
    }

    UUID estate(String owner, String name) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, ?, ?, ?, 'Road', '123456', now())",
                id,
                owner,
                name,
                id.toString());
        return id;
    }

    UUID asset(UUID estate, String reference) {
        var location = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                location,
                estate);
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"updatedAt\") values (?, ?, ?, ?, ?, 'PUMP', now())",
                id,
                estate,
                location,
                reference,
                "Pump " + reference);
        return id;
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    static String at(Instant instant) {
        return instant.toString();
    }

    UUID anomaly(UUID estate, UUID asset, Instant createdAt) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Notification\" (id, \"estateId\", \"assetId\", type, summary, \"createdAt\", \"updatedAt\", condition, \"medianScore\", \"maxScore\", \"firstDetectedAt\", \"lastDetectedAt\", explanation, response) values (?, ?, ?, 'ANOMALY', 'Abnormal readings: needs attention', ?::timestamptz, ?::timestamptz, 'NEEDS_ATTENTION', 0.74, 0.91, ?::timestamptz, ?::timestamptz, '10 consecutive abnormal readings.', 'NONE')",
                id,
                estate,
                asset,
                at(createdAt),
                at(createdAt),
                at(createdAt.minusSeconds(60)),
                at(createdAt.minusSeconds(40)));
        return id;
    }

    UUID serviceDue(UUID asset, Instant createdAt) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Notification\" (id, \"estateId\", \"assetId\", type, summary, \"createdAt\", \"updatedAt\", \"dueOn\", \"intervalValue\", \"intervalUnit\", \"intervalSource\") values (?, ?, ?, 'SERVICE_DUE', 'Service due on 2026-11-20', ?::timestamptz, ?::timestamptz, ?, 6, 'MONTH', 'CATEGORY')",
                id,
                estateId,
                asset,
                at(createdAt),
                at(createdAt),
                LocalDate.parse("2026-11-20"));
        return id;
    }

    UUID repairPredicted(UUID asset, Instant createdAt) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Notification\" (id, \"estateId\", \"assetId\", type, summary, \"createdAt\", \"updatedAt\", \"recommendedTimeframe\", probability, basis, \"failuresObserved\") values (?, ?, ?, 'REPAIR_PREDICTED', 'Repair likely within 30 days', ?::timestamptz, ?::timestamptz, 'WITHIN_30_DAYS', 0.42, 'ASSET_HISTORY', 3)",
                id,
                estateId,
                asset,
                at(createdAt),
                at(createdAt));
        return id;
    }

    ResultActions count(String user) throws Exception {
        return mvc.perform(get("/notifications/unread-count").with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions list(String user, String query) throws Exception {
        return mvc.perform(get("/notifications" + query).with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions read(String user, UUID notification) throws Exception {
        return mvc.perform(post("/notifications/" + notification + "/read").with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions readAll(String user) throws Exception {
        return mvc.perform(post("/notifications/read-all").with(jwt().jwt(j -> j.subject(user))));
    }

    int reads(String user) {
        return ((Number) db.fetchValue("select count(*) from \"NotificationRead\" where \"userId\" = ?", user))
                .intValue();
    }

    @Test
    void signInIsRequired() throws Exception {
        mvc.perform(get("/notifications/unread-count")).andExpect(status().isUnauthorized());
        mvc.perform(get("/notifications")).andExpect(status().isUnauthorized());
        mvc.perform(post("/notifications/read-all")).andExpect(status().isUnauthorized());
    }

    @Test
    void anEmptyInbox() throws Exception {
        count("owner").andExpect(status().isOk()).andExpect(jsonPath("$.unread").value(0));
        list("owner", "")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void listsNotificationsNewestFirstWithTheirDetails() throws Exception {
        var older = serviceDue(pump, NOW.minusSeconds(300));
        var middle = repairPredicted(pump, NOW.minusSeconds(200));
        var newest = anomaly(estateId, pump, NOW.minusSeconds(100));

        list("owner", "")
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items[0].id").value(newest.toString()))
                .andExpect(jsonPath("$.items[1].id").value(middle.toString()))
                .andExpect(jsonPath("$.items[2].id").value(older.toString()))
                .andExpect(jsonPath("$.items[0].type").value("ANOMALY"))
                .andExpect(jsonPath("$.items[0].estateId").value(estateId.toString()))
                .andExpect(jsonPath("$.items[0].estateName").value("Harbour View"))
                .andExpect(jsonPath("$.items[0].assetId").value(pump.toString()))
                .andExpect(jsonPath("$.items[0].assetReference").value("P-1"))
                .andExpect(jsonPath("$.items[0].assetName").value("Pump P-1"))
                .andExpect(jsonPath("$.items[0].summary").value("Abnormal readings: needs attention"))
                .andExpect(jsonPath("$.items[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$.items[0].resolvedAt").value(nullValue()))
                .andExpect(jsonPath("$.items[0].read").value(false))
                .andExpect(jsonPath("$.items[0].anomaly.condition").value("NEEDS_ATTENTION"))
                .andExpect(jsonPath("$.items[0].anomaly.medianScore").value(0.74))
                .andExpect(jsonPath("$.items[0].anomaly.maxScore").value(0.91))
                .andExpect(jsonPath("$.items[0].anomaly.explanation").value("10 consecutive abnormal readings."))
                .andExpect(jsonPath("$.items[0].anomaly.response").value("NONE"))
                .andExpect(jsonPath("$.items[0].anomaly.respondedByName").value(nullValue()))
                .andExpect(jsonPath("$.items[0].serviceDue").value(nullValue()))
                .andExpect(jsonPath("$.items[0].repairPredicted").value(nullValue()))
                .andExpect(jsonPath("$.items[1].type").value("REPAIR_PREDICTED"))
                .andExpect(jsonPath("$.items[1].anomaly").value(nullValue()))
                .andExpect(jsonPath("$.items[1].repairPredicted.recommendedTimeframe")
                        .value("WITHIN_30_DAYS"))
                .andExpect(jsonPath("$.items[1].repairPredicted.probability").value(0.42))
                .andExpect(jsonPath("$.items[1].repairPredicted.basis").value("ASSET_HISTORY"))
                .andExpect(
                        jsonPath("$.items[1].repairPredicted.failuresObserved").value(3))
                .andExpect(jsonPath("$.items[2].type").value("SERVICE_DUE"))
                .andExpect(jsonPath("$.items[2].serviceDue.dueOn").value("2026-11-20"))
                .andExpect(jsonPath("$.items[2].serviceDue.interval.value").value(6))
                .andExpect(jsonPath("$.items[2].serviceDue.interval.unit").value("MONTH"))
                .andExpect(jsonPath("$.items[2].serviceDue.intervalSource").value("CATEGORY"));
        count("owner").andExpect(jsonPath("$.unread").value(3));
    }

    @Test
    void equalTimesAreOrderedById() throws Exception {
        var first = anomaly(estateId, pump, NOW);
        var second = serviceDue(asset(estateId, "P-2"), NOW);
        var ids = new String[] {first.toString(), second.toString()};
        java.util.Arrays.sort(ids);
        list("owner", "")
                .andExpect(jsonPath("$.items[0].id").value(ids[1]))
                .andExpect(jsonPath("$.items[1].id").value(ids[0]));
    }

    @Test
    void managersSeeTheEstatesNotifications() throws Exception {
        membership("manager", "MANAGER");
        anomaly(estateId, pump, NOW);
        count("manager").andExpect(jsonPath("$.unread").value(1));
        list("manager", "").andExpect(jsonPath("$.total").value(1));
    }

    @ParameterizedTest
    @ValueSource(strings = {"MEMBER", "COUNCIL", "CREW", "RESIDENT"})
    void otherRolesSeeNothing(String role) throws Exception {
        membership("someone", role);
        var id = anomaly(estateId, pump, NOW);
        count("someone").andExpect(jsonPath("$.unread").value(0));
        list("someone", "").andExpect(jsonPath("$.total").value(0));
        read("someone", id).andExpect(status().isNotFound());
    }

    @Test
    void anotherOwnersEstateIsInvisible() throws Exception {
        var other = estate("stranger", "Elsewhere");
        var id = anomaly(other, asset(other, "X-1"), NOW);
        count("owner").andExpect(jsonPath("$.unread").value(0));
        read("owner", id).andExpect(status().isNotFound());
        count("stranger").andExpect(jsonPath("$.unread").value(1));
    }

    @Test
    void losingTheManagerRoleHidesExistingNotifications() throws Exception {
        membership("manager", "MANAGER");
        anomaly(estateId, pump, NOW);
        count("manager").andExpect(jsonPath("$.unread").value(1));
        db.execute("delete from \"EstateUser\" where \"userId\" = 'manager'");
        count("manager").andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void readStateIsPerUser() throws Exception {
        membership("manager", "MANAGER");
        var id = anomaly(estateId, pump, NOW);
        read("owner", id).andExpect(status().isNoContent());
        count("owner").andExpect(jsonPath("$.unread").value(0));
        list("owner", "").andExpect(jsonPath("$.items[0].read").value(true));
        count("manager").andExpect(jsonPath("$.unread").value(1));
        list("manager", "").andExpect(jsonPath("$.items[0].read").value(false));
    }

    @Test
    void readingTwiceIsNotAnError() throws Exception {
        var id = anomaly(estateId, pump, NOW);
        read("owner", id).andExpect(status().isNoContent());
        read("owner", id).andExpect(status().isNoContent());
        assertEquals(1, reads("owner"));
    }

    @Test
    void readingAnUnknownNotificationIs404() throws Exception {
        read("owner", UUID.randomUUID()).andExpect(status().isNotFound());
    }

    @Test
    void readAllMarksEveryVisibleNotificationForThisUserOnly() throws Exception {
        membership("manager", "MANAGER");
        var already = anomaly(estateId, pump, NOW.minusSeconds(10));
        read("owner", already);
        serviceDue(pump, NOW);
        repairPredicted(asset(estateId, "P-2"), NOW);
        var other = estate("stranger", "Elsewhere");
        anomaly(other, asset(other, "X-1"), NOW);

        readAll("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(0));
        assertEquals(3, reads("owner"));
        count("manager").andExpect(jsonPath("$.unread").value(3));
        count("stranger").andExpect(jsonPath("$.unread").value(1));
    }

    @Test
    void readAllWithNothingUnreadIsFine() throws Exception {
        readAll("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(0));
    }

    @Test
    void pagesThroughTheList() throws Exception {
        for (int i = 0; i < 3; i++) {
            anomaly(estateId, asset(estateId, "P-" + (10 + i)), NOW.minusSeconds(i));
        }
        list("owner", "?page=1&size=2")
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.size").value(2))
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].assetReference").value("P-12"));
        list("owner", "?page=5&size=2")
                .andExpect(jsonPath("$.items", hasSize(0)))
                .andExpect(jsonPath("$.total").value(3));
    }

    @ParameterizedTest
    @ValueSource(strings = {"?page=-1", "?size=0", "?size=101"})
    void rejectsBadPaging(String query) throws Exception {
        list("owner", query).andExpect(status().isBadRequest());
    }
}
