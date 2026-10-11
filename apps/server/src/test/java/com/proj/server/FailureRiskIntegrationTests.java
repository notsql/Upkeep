package com.proj.server;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.lessThanOrEqualTo;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneOffset;
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

/**
 * The failure-risk endpoints (spec "Breakdown forecast", "Flags"). Integration-level because the
 * estate list's contents, the current condition and the counting events come from real queries.
 * Dates are relative to today, so probabilities are checked with a tolerance that absorbs a
 * one-day time-zone difference between the test and the server.
 */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class FailureRiskIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    final LocalDate today = LocalDate.now(ZoneOffset.UTC);
    UUID estateId, locationId;
    int references;

    @BeforeEach
    void setup() {
        estateId = UUID.randomUUID();
        locationId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                estateId,
                estateId.toString());
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                locationId,
                estateId);
    }

    UUID asset(String name, String category, LocalDate installedOn) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"installedOn\", \"updatedAt\") values (?, ?, ?, ?, ?, ?, ?::date, now())",
                id,
                estateId,
                locationId,
                "E-A%04d".formatted(++references),
                name,
                category,
                installedOn);
        return id;
    }

    void breakdown(UUID asset, LocalDate occurredOn) {
        db.execute(
                "insert into \"AssetEvent\" (id, \"estateId\", \"assetId\", type, \"occurredOn\", notes, \"recordedByUserId\") values (?, ?, ?, 'BREAKDOWN_REPAIR', ?, 'Repaired', 'owner')",
                UUID.randomUUID(),
                estateId,
                asset,
                occurredOn);
    }

    void assessment(UUID asset, String condition, LocalDate assessedOn, String recordedBy) {
        db.execute(
                "insert into \"AssetAssessment\" (id, \"estateId\", \"assetId\", condition, \"assessedOn\", notes, \"recordedByUserId\") values (?, ?, ?, ?, ?, 'Notes', ?)",
                UUID.randomUUID(),
                estateId,
                asset,
                condition,
                assessedOn,
                recordedBy);
    }

    void deactivate(UUID asset) {
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", asset);
    }

    /** Four breakdowns 90 days apart, the last 60 days ago: P30 ≈ 0.11, P60 ≈ 0.20, P90 ≈ 0.29. */
    UUID repeatOffender() {
        var pump = asset("Booster pump", "PUMP", today.minusDays(420));
        for (int daysAgo : new int[] {330, 240, 150, 60}) {
            breakdown(pump, today.minusDays(daysAgo));
        }
        return pump;
    }

    String one(UUID asset) {
        return "/estates/" + estateId + "/assets/" + asset + "/failure-risk";
    }

    String list() {
        return "/estates/" + estateId + "/failure-risk";
    }

    static MockHttpServletRequestBuilder as(String subject, MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(t -> t.subject(subject)));
    }

    @Test
    void forecastsAPumpFromItsRepairHistory() throws Exception {
        var pump = repeatOffender();
        mvc.perform(as("owner", get(one(pump))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assetId").value(pump.toString()))
                .andExpect(jsonPath("$.assetReference").value("E-A0001"))
                .andExpect(jsonPath("$.assetName").value("Booster pump"))
                .andExpect(jsonPath("$.category").value("PUMP"))
                .andExpect(jsonPath("$.basis").value("ASSET_HISTORY"))
                .andExpect(jsonPath("$.failuresObserved").value(4))
                .andExpect(jsonPath("$.daysSinceLastEvent", allOf(greaterThanOrEqualTo(59), lessThanOrEqualTo(61))))
                .andExpect(jsonPath("$.probability30Days", closeTo(0.105, 0.01)))
                .andExpect(jsonPath("$.probability60Days", closeTo(0.203, 0.01)))
                .andExpect(jsonPath("$.probability90Days", closeTo(0.293, 0.01)))
                .andExpect(jsonPath("$.recommendedTimeframe").value("WITHIN_60_DAYS"))
                .andExpect(jsonPath("$.expectedEndOfLife")
                        .value(today.minusDays(420).plusYears(15).toString()))
                .andExpect(jsonPath("$.flagged").value(true))
                .andExpect(jsonPath("$.flagReasons", contains("FAILURE_RISK")));
    }

    @Test
    void aPumpWithNoInstallDateOrEventsHasInsufficientData() throws Exception {
        var pump = asset("Sump pump", "PUMP", null);
        mvc.perform(as("owner", get(one(pump))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.basis").value("INSUFFICIENT_DATA"))
                .andExpect(jsonPath("$.probability90Days").value(nullValue()))
                .andExpect(jsonPath("$.recommendedTimeframe").value(nullValue()))
                .andExpect(jsonPath("$.expectedEndOfLife").value(nullValue()))
                .andExpect(jsonPath("$.flagged").value(false))
                .andExpect(jsonPath("$.flagReasons").isEmpty());
    }

    @Test
    void aNonPumpIsNotSupportedButStillFlaggedForItsCondition() throws Exception {
        var lift = asset("Passenger lift", "LIFT", today.minusYears(2));
        assessment(lift, "FAULTY", today.minusDays(3), "owner");
        mvc.perform(as("owner", get(one(lift))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.basis").value("NOT_SUPPORTED"))
                .andExpect(jsonPath("$.probability30Days").value(nullValue()))
                .andExpect(jsonPath("$.probability60Days").value(nullValue()))
                .andExpect(jsonPath("$.probability90Days").value(nullValue()))
                .andExpect(jsonPath("$.recommendedTimeframe").value(nullValue()))
                .andExpect(jsonPath("$.flagged").value(true))
                .andExpect(jsonPath("$.flagReasons", contains("CONDITION")));
    }

    @Test
    void flagsAConditionRecordedByAnomalyDetection() throws Exception {
        var pump = asset("Transfer pump", "PUMP", today.minusDays(30));
        assessment(pump, "NEEDS_ATTENTION", today, "system:anomaly-model");
        mvc.perform(as("owner", get(one(pump))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flagged").value(true))
                .andExpect(jsonPath("$.flagReasons", contains("CONDITION")));
    }

    @Test
    void onlyTheCurrentAssessmentRaisesAConditionFlag() throws Exception {
        var pump = asset("Transfer pump", "PUMP", today.minusDays(30));
        assessment(pump, "FAULTY", today.minusDays(20), "owner");
        assessment(pump, "GOOD", today.minusDays(10), "owner");
        mvc.perform(as("owner", get(one(pump))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flagged").value(false))
                .andExpect(jsonPath("$.flagReasons").isEmpty());
    }

    @Test
    void flagsAPumpNearingEndOfLife() throws Exception {
        var pump = asset("Old pump", "PUMP", today.minusYears(13));
        mvc.perform(as("owner", get(one(pump))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.expectedEndOfLife")
                        .value(today.minusYears(13).plusYears(15).toString()))
                .andExpect(jsonPath("$.flagged").value(true))
                .andExpect(jsonPath("$.flagReasons", contains("END_OF_LIFE")));
    }

    @Test
    void reportsEveryReasonThatApplies() throws Exception {
        var pump = asset("Worn pump", "PUMP", today.minusYears(13));
        // 25 breakdowns 10 days apart, the last 5 days ago: P90 ≈ 0.19 despite the long first interval.
        for (int i = 0; i < 25; i++) {
            breakdown(pump, today.minusDays(5 + 10L * i));
        }
        assessment(pump, "FAULTY", today, "system:anomaly-model");
        mvc.perform(as("owner", get(one(pump))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.flagged").value(true))
                .andExpect(jsonPath("$.flagReasons", containsInAnyOrder("CONDITION", "FAILURE_RISK", "END_OF_LIFE")));
    }

    @Test
    void aDeactivatedAssetsForecastIsStillReadable() throws Exception {
        var pump = repeatOffender();
        deactivate(pump);
        mvc.perform(as("owner", get(one(pump))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.basis").value("ASSET_HISTORY"));
    }

    @Test
    void theEstateListHoldsActivePumpsFlaggedFirstThenByRiskWithUnknownsLast() throws Exception {
        var risky = repeatOffender(); // FAILURE_RISK
        var old = asset("Old pump", "PUMP", today.minusYears(13)); // END_OF_LIFE, P90 ≈ 0.01
        var faulty = asset("Faulty pump", "PUMP", today.minusDays(30)); // CONDITION, P90 ≈ 0.05
        assessment(faulty, "FAULTY", today, "system:anomaly-model");
        var unknown = asset("Unrecorded pump", "PUMP", null); // INSUFFICIENT_DATA
        var threeYears = asset("Steady pump", "PUMP", today.minusDays(1095)); // P90 ≈ 0.031
        var brandNew = asset("New pump", "PUMP", today); // P90 ≈ 0.043
        var lift = asset("Passenger lift", "LIFT", today.minusYears(14));
        assessment(lift, "FAULTY", today, "owner");
        var retired = repeatOffender();
        deactivate(retired);

        mvc.perform(as("owner", get(list())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(6))
                .andExpect(jsonPath(
                        "$[0:3].assetId", containsInAnyOrder(risky.toString(), old.toString(), faulty.toString())))
                .andExpect(jsonPath("$[0:3].flagged", contains(true, true, true)))
                .andExpect(jsonPath("$[3].assetId").value(brandNew.toString()))
                .andExpect(jsonPath("$[4].assetId").value(threeYears.toString()))
                .andExpect(jsonPath("$[5].assetId").value(unknown.toString()))
                .andExpect(jsonPath("$[5].probability90Days").value(nullValue()));
    }

    @Test
    void anotherOwnerGetsNotFound() throws Exception {
        var pump = repeatOffender();
        mvc.perform(as("owner", get(one(pump)))).andExpect(status().isOk());
        mvc.perform(as("owner", get(list()))).andExpect(status().isOk());
        mvc.perform(as("other", get(one(pump)))).andExpect(status().isNotFound());
        mvc.perform(as("other", get(list()))).andExpect(status().isNotFound());
        mvc.perform(as("owner", get("/estates/" + estateId + "/assets/" + UUID.randomUUID() + "/failure-risk")))
                .andExpect(status().isNotFound());
        mvc.perform(get(list())).andExpect(status().isUnauthorized());
    }
}
