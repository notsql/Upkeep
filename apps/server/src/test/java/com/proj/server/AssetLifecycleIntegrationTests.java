package com.proj.server;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
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
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AssetLifecycleIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    UUID estateId, blockId, levelId, assetId;
    String base, one;

    @BeforeEach
    void setup() {
        estateId = UUID.randomUUID();
        blockId = UUID.randomUUID();
        levelId = UUID.randomUUID();
        assetId = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, 'owner', 'Estate', ?, 'Road', '123456', now())",
                estateId,
                estateId.toString());
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"updatedAt\") values (?, ?, 'BLOCK', 'Block A', now())",
                blockId,
                estateId);
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"parentId\", \"parentType\", \"sortOrder\", \"updatedAt\") values (?, ?, 'LEVEL', 'Level 1', ?, 'BLOCK', 1, now())",
                levelId,
                estateId,
                blockId);
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"installedOn\", \"updatedAt\") values (?, ?, ?, 'E-A0001', 'Water Pump', 'PUMP', '2020-01-01', now())",
                assetId,
                estateId,
                levelId);
        base = "/estates/" + estateId + "/assets";
        one = base + "/" + assetId;
    }

    String retirement(int version, String date, String reason) {
        return "{\"reference\":\"E-A0001\",\"retiredOn\":\"" + date + "\",\"retirementReason\":\"" + reason
                + "\",\"expectedVersion\":" + version + "}";
    }

    @Test
    void retirementCorrectionAndRestorationPreserveIdentityAndAudit() throws Exception {
        mvc.perform(post(one + "/deactivate")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(retirement(0, "2025-01-01", "Worn out")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.retiredOn").value("2025-01-01"))
                .andExpect(jsonPath("$.lifecycleVersion").value(1));
        mvc.perform(patch(one + "/retirement")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(retirement(1, "2025-02-01", "Corrected date")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.retiredOn").value("2025-02-01"));
        mvc.perform(post(one + "/restore")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reference\":\"E-A0001\",\"expectedVersion\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(assetId.toString()))
                .andExpect(jsonPath("$.deactivatedAt").isEmpty())
                .andExpect(jsonPath("$.lifecycleVersion").value(3));
        mvc.perform(get(one + "/lifecycle-events").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[0].action").value("RESTORED"))
                .andExpect(jsonPath("$[0].previousRetirementReason").value("Corrected date"))
                .andExpect(jsonPath("$[0].actorUserId").value("owner"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"2019-12-31", "2999-01-01"})
    void rejectsRetirementOutsideInstallationAndToday(String date) throws Exception {
        mvc.perform(post(one + "/deactivate")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(retirement(0, date, "Reason")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsOldReferenceOnlyRequestsAndStaleChanges() throws Exception {
        mvc.perform(post(one + "/deactivate")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reference\":\"E-A0001\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post(one + "/deactivate")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(retirement(0, "2025-01-01", "Reason")))
                .andExpect(status().isOk());
        mvc.perform(post(one + "/restore")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reference\":\"E-A0001\",\"expectedVersion\":0}"))
                .andExpect(status().isConflict());
    }

    @Test
    void registerSearchCombinesFiltersAndDescendantLocations() throws Exception {
        mvc.perform(get(base)
                        .param("q", "water")
                        .param("category", "PUMP")
                        .param("locationId", blockId.toString())
                        .param("condition", "UNASSESSED")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].locationPath").value("Block A › Level 1"));
        mvc.perform(get(base).param("category", "LIFT").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mvc.perform(get(base).param("status", "invalid").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isBadRequest());
        mvc.perform(get(base)
                        .param("locationId", UUID.randomUUID().toString())
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isNotFound());
        mvc.perform(get(base).with(jwt().jwt(j -> j.subject("outsider")))).andExpect(status().isNotFound());
    }

    @Test
    void retiredAssetsAreHiddenByDefaultButStillReadable() throws Exception {
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", assetId);
        mvc.perform(get(base).with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mvc.perform(get(base).param("status", "INACTIVE").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(assetId.toString()));
        mvc.perform(get(one).with(jwt().jwt(j -> j.subject("owner")))).andExpect(status().isOk());
    }

    @Test
    void historicalLocationsRequireExplicitOptIn() throws Exception {
        db.execute("update \"Location\" set \"deactivatedAt\" = now() where id = ?", levelId);
        String locations = "/estates/" + estateId + "/locations";
        mvc.perform(get(locations).with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get(locations).param("includeInactive", "true").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    private void assessment(String date, String condition) {
        db.execute(
                "insert into \"AssetAssessment\" (id, \"estateId\", \"assetId\", condition, \"assessedOn\", notes, \"recordedByUserId\") values (?, ?, ?, ?, ?::date, 'Inspection', 'owner')",
                UUID.randomUUID(),
                estateId,
                assetId,
                condition,
                date);
    }

    @Test
    void onlyLatestAssessmentDeterminesConditionAndRetirementPreservesHistory() throws Exception {
        assessment("2024-01-01", "FAULTY");
        assessment("2025-01-01", "GOOD");
        mvc.perform(get(base).param("condition", "FAULTY").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mvc.perform(get(base)
                        .param("condition", "GOOD")
                        .param("q", "  e-a0001  ")
                        .with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].currentCondition").value("GOOD"));
        mvc.perform(post(one + "/deactivate")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(retirement(0, "2025-01-01", "  Worn out  ")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.retirementReason").value("Worn out"));
        mvc.perform(get(one + "/assessments").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get(base).param("status", "ALL").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   "})
    void rejectsBlankReasonWithoutCreatingHistory(String reason) throws Exception {
        mvc.perform(post(one + "/deactivate")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(retirement(0, "2025-01-01", reason)))
                .andExpect(status().isBadRequest());
        mvc.perform(get(one + "/lifecycle-events").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void rejectsOversizedReasonAndGuardsAllLifecycleEndpoints() throws Exception {
        mvc.perform(post(one + "/deactivate")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(retirement(0, "2025-01-01", "x".repeat(2001))))
                .andExpect(status().isBadRequest());
        mvc.perform(get(base)).andExpect(status().isUnauthorized());
        mvc.perform(get(one + "/lifecycle-events").with(jwt().jwt(j -> j.subject("outsider"))))
                .andExpect(status().isNotFound());
        mvc.perform(post(one + "/restore")
                        .with(jwt().jwt(j -> j.subject("outsider")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reference\":\"E-A0001\",\"expectedVersion\":0}"))
                .andExpect(status().isNotFound());
        mvc.perform(patch(one + "/retirement")
                        .with(jwt().jwt(j -> j.subject("outsider")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(retirement(0, "2025-01-01", "Reason")))
                .andExpect(status().isNotFound());
    }

    @Test
    void legacyRetirementCanBeRestoredThenRetiredAgainWithoutChangingIdentity() throws Exception {
        db.execute("update \"Asset\" set \"deactivatedAt\"=now() where id=?", assetId);
        mvc.perform(get(one).with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.retiredOn").isEmpty());
        mvc.perform(post(one + "/restore")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reference\":\"E-A0001\",\"expectedVersion\":0}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lifecycleVersion").value(1));
        mvc.perform(post(one + "/deactivate")
                        .with(jwt().jwt(j -> j.subject("owner")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(retirement(1, "2025-01-01", "New retirement")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reference").value("E-A0001"))
                .andExpect(jsonPath("$.lifecycleVersion").value(2));
        mvc.perform(get(one + "/lifecycle-events").with(jwt().jwt(j -> j.subject("owner"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[1].previousRetiredOn").isEmpty());
    }

    private void cleanupCommittedFixture() {
        db.execute("delete from \"AssetLifecycleEvent\" where \"assetId\"=?", assetId);
        db.execute("delete from \"Asset\" where id=?", assetId);
        db.execute("delete from \"Location\" where id=?", levelId);
        db.execute("delete from \"Location\" where id=?", blockId);
        db.execute("delete from \"Estate\" where id=?", estateId);
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentRetirementsProduceExactlyOneEvent() throws Exception {
        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var start = new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.Callable<Integer> retire = () -> {
                start.await();
                return mvc.perform(post(one + "/deactivate")
                                .with(jwt().jwt(j -> j.subject("owner")))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(retirement(0, "2025-01-01", "Reason")))
                        .andReturn()
                        .getResponse()
                        .getStatus();
            };
            var first = executor.submit(retire);
            var second = executor.submit(retire);
            start.countDown();
            var results = new java.util.ArrayList<>(java.util.List.of(
                    first.get(10, java.util.concurrent.TimeUnit.SECONDS),
                    second.get(10, java.util.concurrent.TimeUnit.SECONDS)));
            results.sort(Integer::compareTo);
            org.junit.jupiter.api.Assertions.assertEquals(java.util.List.of(200, 409), results);
            mvc.perform(get(one + "/lifecycle-events").with(jwt().jwt(j -> j.subject("owner"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.length()").value(1));
        } finally {
            cleanupCommittedFixture();
        }
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void eventFailureRollsBackTheAssetTransition() throws Exception {
        try {
            db.execute(
                    "insert into \"AssetLifecycleEvent\" (id, \"estateId\", \"assetId\", action, \"actorUserId\", \"lifecycleVersion\") values (?, ?, ?, 'RETIRED', 'owner', 1)",
                    UUID.randomUUID(),
                    estateId,
                    assetId);
            mvc.perform(post(one + "/deactivate")
                            .with(jwt().jwt(j -> j.subject("owner")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(retirement(0, "2025-01-01", "Reason")))
                    .andExpect(status().isConflict());
            mvc.perform(get(one).with(jwt().jwt(j -> j.subject("owner"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.deactivatedAt").isEmpty())
                    .andExpect(jsonPath("$.lifecycleVersion").value(0));
        } finally {
            cleanupCommittedFixture();
        }
    }
}
