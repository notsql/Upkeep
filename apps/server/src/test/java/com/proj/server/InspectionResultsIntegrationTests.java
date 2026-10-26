package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

/** Acceptance tests for recording and reading standalone results; ID-49 owns the history table UI. */
class InspectionResultsIntegrationTests extends InspectionTestSupport {
    @ParameterizedTest
    @ValueSource(strings = {"OWNER", "MANAGER", "CREW"})
    void currentEstateInspectorsCanRecordAndReadBothOutcomes(String role) throws Exception {
        var data = asset();
        String user = role.equals("OWNER") ? OWNER : "inspector";
        if (!role.equals("OWNER")) member(data[0], user, role);
        for (String outcome : List.of("PASS", "FAIL")) {
            var before = Instant.now();
            var body = save(data, user, outcome)
                    .andExpect(status().isCreated())
                    .andExpect(header().string("Cache-Control", "private, no-store"))
                    .andExpect(jsonPath("$.estateId").value(data[0].toString()))
                    .andExpect(jsonPath("$.assetId").value(data[2].toString()))
                    .andExpect(jsonPath("$.locationId").value(data[1].toString()))
                    .andExpect(jsonPath("$.locationPath").value("Block A"))
                    .andExpect(jsonPath("$.outcome").value(outcome))
                    .andExpect(jsonPath("$.inspectedOn").value(today().toString()))
                    .andExpect(jsonPath("$.recordedByUserId").value(user))
                    .andExpect(jsonPath("$.notes").isEmpty())
                    .andExpect(jsonPath("$.photos").isEmpty())
                    .andExpect(jsonPath("$.workOrder").isEmpty())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            var createdAt = Instant.parse(JsonPath.read(body, "$.createdAt"));
            assertFalse(createdAt.isBefore(before.minusSeconds(1)));
            assertFalse(createdAt.isAfter(Instant.now().plusSeconds(1)));
            read(inspections(data) + "/" + id(body), user)
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", "private, no-store"))
                    .andExpect(content().json(body));
        }
        read(inspections(data), user)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2));
        assertEquals(2, count("AssetInspectionResult", data[0]));
        assertEquals(0, count("WorkOrder", data[0]));
    }

    @Test
    void creationReturnsALocationHeaderForTheSavedRecord() throws Exception {
        var data = asset();
        var response = save(data, OWNER, "PASS")
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse();
        assertEquals(inspections(data) + "/" + id(response.getContentAsString()), response.getHeader("Location"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"MEMBER", "COUNCIL", "RESIDENT", "CUSTOM"})
    void unrelatedEstateRolesCannotReadOrCreateInspectionResults(String role) throws Exception {
        var data = asset();
        var body = saved(data, "FAIL");
        if (role.equals("CUSTOM")) customMember(data[0], "outsider");
        else member(data[0], "outsider", role);
        for (String path : List.of(
                inspections(data),
                inspections(data) + "/" + id(body),
                "/estates/" + data[0] + "/inspection-assets",
                "/estates/" + data[0] + "/inspection-assets/" + data[2])) {
            read(path, "outsider").andExpect(status().isForbidden());
        }
        save(data, "outsider", "PASS").andExpect(status().isForbidden());
        assertEquals(1, count("AssetInspectionResult", data[0]));
    }

    @ParameterizedTest
    @ValueSource(strings = {"COUNCIL", "CREW", "CUSTOM"})
    void independentOwnershipStillQualifiesDespiteAnotherMembership(String role) throws Exception {
        var data = asset();
        if (role.equals("CUSTOM")) customMember(data[0], OWNER);
        else member(data[0], OWNER, role);
        save(data, OWNER, "PASS").andExpect(status().isCreated());
    }

    private void customMember(UUID estate, String user) {
        var roleId = UUID.randomUUID();
        db.execute("""
                insert into "EstateRoleDefinition" (id,"estateId",name,"normalizedName","createdByUserId","updatedAt")
                values (?,?,'Viewer','viewer',?,now())
                """, roleId, estate, OWNER);
        db.execute("insert into \"EstateRolePermission\" (\"roleId\",permission) values (?,'VIEW_ESTATE')", roleId);
        db.execute(
                "insert into \"EstateUser\" (\"estateId\",\"userId\",role,\"customRoleId\") values (?,?,'CUSTOM',?)",
                estate,
                user,
                roleId);
    }

    @Test
    void independentOwnershipKeepsEstateNavigationWithoutCustomReadGrants() throws Exception {
        var data = asset();
        customMember(data[0], OWNER);
        db.execute(
                "delete from \"EstateRolePermission\" where \"roleId\" in (select \"customRoleId\" from \"EstateUser\" where \"estateId\"=? and \"userId\"=?)",
                data[0],
                OWNER);
        read("/estates/" + data[0], OWNER).andExpect(status().isOk());
        read("/estates/" + data[0] + "/assets/" + data[2], OWNER).andExpect(status().isOk());
        read("/access/context", OWNER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewEstateDetails").value(true))
                .andExpect(jsonPath("$.estates[0].canCreateInspectionResults").value(true));
    }

    @Test
    void sameEstateResidentOverridesOwnershipAndForeignAuthorityGrantsNothing() throws Exception {
        var data = asset();
        member(data[0], OWNER, "RESIDENT");
        save(data, OWNER, "PASS").andExpect(status().isForbidden());
        read(inspections(data), OWNER).andExpect(status().isForbidden());
        var another = asset();
        member(another[0], "foreign-manager", "MANAGER");
        save(data, "foreign-manager", "PASS").andExpect(status().isNotFound());
        read(inspections(data), "foreign-manager").andExpect(status().isNotFound());
    }

    @Test
    void providerAdminWithoutEstateAuthorityCannotInspect() throws Exception {
        var data = asset();
        mvc.perform(submission(data, "PASS", today().toString())
                        .with(jwt().jwt(t -> t.subject("platform-admin").claim("role", "admin"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void inspectorAndAssociationsComeFromTheIdentityAndPath() throws Exception {
        var data = asset();
        var foreign = asset();
        mvc.perform(submission(data, "PASS", today().toString())
                        .param("recordedByUserId", "someone-else")
                        .param("estateId", foreign[0].toString())
                        .param("assetId", foreign[2].toString())
                        .param("createdAt", "2000-01-01T00:00:00Z")
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recordedByUserId").value(OWNER))
                .andExpect(jsonPath("$.estateId").value(data[0].toString()))
                .andExpect(jsonPath("$.assetId").value(data[2].toString()));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"UNKNOWN", "pass", "  "})
    void outcomeMustBeAnExplicitPassOrFail(String outcome) throws Exception {
        var data = asset();
        mvc.perform(submission(data, outcome, today().toString()).with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isBadRequest());
        assertEquals(0, count("AssetInspectionResult", data[0]));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"not-a-date", "2026-02-30", "2019-12-31"})
    void inspectionDateMustBeValidAndNoEarlierThanKnownInstallation(String date) throws Exception {
        var data = asset();
        mvc.perform(submission(data, "PASS", date).with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isBadRequest());
        assertEquals(0, count("AssetInspectionResult", data[0]));
    }

    @Test
    void singaporeTodayAndInstallationDateAreAcceptedButTomorrowIsRejected() throws Exception {
        var data = asset();
        for (var date : List.of("2020-01-01", today().toString())) {
            mvc.perform(submission(data, "PASS", date).with(jwt().jwt(t -> t.subject(OWNER))))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.inspectedOn").value(date));
        }
        mvc.perform(submission(data, "PASS", today().plusDays(1).toString()).with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isBadRequest());
        db.execute("update \"Asset\" set \"installedOn\"=null where id=?", data[2]);
        mvc.perform(submission(data, "PASS", "2019-01-01").with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isCreated());
    }

    @Test
    void notesAreTrimmedAndTheLimitAppliesAfterTrimming() throws Exception {
        var data = asset();
        for (String notes : List.of("   ", "  Checked seal  ", "  " + "x".repeat(2000) + "  ")) {
            mvc.perform(submission(data, "PASS", today().toString())
                            .param("notes", notes)
                            .with(jwt().jwt(t -> t.subject(OWNER))))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.notes").value(notes.isBlank() ? null : notes.trim()));
        }
        mvc.perform(submission(data, "PASS", today().toString())
                        .param("notes", "x".repeat(2001))
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isBadRequest());
        assertEquals(3, count("AssetInspectionResult", data[0]));
    }

    @ParameterizedTest
    @ValueSource(strings = {"estate", "asset", "location", "ancestor"})
    void inactiveResourcesRejectWritesAndKeepExistingHistoryReadable(String resource) throws Exception {
        var data = asset();
        String resultId = id(saved(data, "FAIL"));
        switch (resource) {
            case "estate" -> db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", data[0]);
            case "asset" ->
                db.execute(
                        "update \"Asset\" set \"retiredOn\"=current_date,\"retirementReason\"='Retired',\"deactivatedAt\"=now() where id=?",
                        data[2]);
            case "location" -> db.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", data[1]);
            case "ancestor" -> {
                var level = UUID.randomUUID();
                db.execute(
                        "insert into \"Location\" (id,\"estateId\",type,\"parentId\",\"parentType\",name,\"sortOrder\",\"updatedAt\") values (?,?,'LEVEL',?,'BLOCK','Level 1',1,now())",
                        level,
                        data[0],
                        data[1]);
                db.execute("update \"Asset\" set \"locationId\"=? where id=?", level, data[2]);
                db.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", data[1]);
                data[1] = level;
            }
            default -> throw new IllegalArgumentException(resource);
        }
        save(data, OWNER, "PASS").andExpect(status().isConflict());
        read(inspections(data) + "/" + resultId, OWNER).andExpect(status().isOk());
        read(inspections(data), OWNER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test
    void movedAssetConflictsAndHistoricalLocationSurvivesMovesAndRenaming() throws Exception {
        var data = asset();
        String resultId = id(saved(data, "FAIL"));
        var moved = location(data[0], "Block B");
        db.execute("update \"Asset\" set \"locationId\"=? where id=?", moved, data[2]);
        db.execute("update \"Location\" set name='Renamed block' where id=?", data[1]);
        save(data, OWNER, "PASS").andExpect(status().isConflict());
        read(inspections(data) + "/" + resultId, OWNER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locationId").value(data[1].toString()))
                .andExpect(jsonPath("$.locationPath").value("Block A"));
        data[1] = moved;
        save(data, OWNER, "PASS")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.locationPath").value("Block B"));
    }

    @Test
    void expectedLocationIsRequiredAndForeignAssetsAreHiddenEvenWhenBothEstatesAreOwned() throws Exception {
        var data = asset();
        mvc.perform(multipart(inspections(data))
                        .param("outcome", "PASS")
                        .param("inspectedOn", today().toString())
                        .with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isBadRequest());
        var foreign = asset();
        var forged = new UUID[] {data[0], foreign[1], foreign[2]};
        save(forged, OWNER, "PASS").andExpect(status().isNotFound());
        read(inspections(forged), OWNER).andExpect(status().isNotFound());
        var result = id(saved(foreign, "FAIL"));
        read(inspections(data) + "/" + result, OWNER).andExpect(status().isNotFound());
    }

    @Test
    void recordingDoesNotWriteMaintenanceOrConditionOrChangeTheAsset() throws Exception {
        var data = asset();
        var before = db.fetchOne("select * from \"Asset\" where id=?", data[2]).intoMap();
        var counts = new java.util.HashMap<String, Long>();
        for (String table : List.of("AssetEvent", "AssetAssessment", "AssetLifecycleEvent"))
            counts.put(table, count(table, data[0]));
        saved(data, "FAIL");
        saved(data, "PASS");
        assertEquals(
                before,
                db.fetchOne("select * from \"Asset\" where id=?", data[2]).intoMap());
        for (var entry : counts.entrySet()) assertEquals(entry.getValue(), count(entry.getKey(), data[0]));
        assertEquals(0, count("WorkOrder", data[0]));
    }

    @Test
    void missingAndEmptyHistoryHaveReadableResponsesAndDuplicateDatesRemainIndependent() throws Exception {
        var data = asset();
        read(inspections(data), OWNER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.nextCursor").isEmpty());
        read(inspections(data) + "/" + UUID.randomUUID(), OWNER).andExpect(status().isNotFound());
        String first = id(saved(data, "PASS"));
        String second = id(saved(data, "PASS"));
        assertNotEquals(first, second);
        read(inspections(data), OWNER).andExpect(jsonPath("$.items.length()").value(2));
    }

    @Test
    void historyOrdersByInspectionDateThenRecordingTimestampThenIdAcrossPages() throws Exception {
        var data = asset();
        var ids = new ArrayList<String>();
        for (int i = 0; i < 4; i++) ids.add(id(saved(data, "PASS")));
        ids.sort(Comparator.naturalOrder());
        for (int i = 0; i < ids.size(); i++) {
            db.execute(
                    "update \"AssetInspectionResult\" set \"inspectedOn\"=?::date,\"createdAt\"=?::timestamptz where id=?::uuid",
                    i == 3 ? "2020-01-01" : "2020-01-02",
                    i == 0 ? "2026-01-01T00:00:00Z" : "2026-01-02T00:00:00Z",
                    ids.get(i));
        }
        String cursor = null;
        for (int index : new int[] {2, 1, 0, 3}) {
            var request = get(inspections(data)).param("limit", "1").with(jwt().jwt(t -> t.subject(OWNER)));
            if (cursor != null) request.param("cursor", cursor);
            var body = mvc.perform(request)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items.length()").value(1))
                    .andExpect(jsonPath("$.items[0].id").value(ids.get(index)))
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            cursor = JsonPath.read(body, "$.nextCursor");
        }
        assertNull(cursor);
    }

    @ParameterizedTest
    @CsvSource({"limit,0", "limit,51", "cursor,broken"})
    void malformedPaginationIsRejected(String name, String value) throws Exception {
        var data = asset();
        mvc.perform(get(inspections(data)).param(name, value).with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void historyCursorsCannotBeReusedForAnotherEstateOrAsset() throws Exception {
        var data = asset();
        saved(data, "PASS");
        saved(data, "FAIL");
        var page = mvc.perform(get(inspections(data)).param("limit", "1").with(jwt().jwt(t -> t.subject(OWNER))))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String cursor = JsonPath.read(page, "$.nextCursor");
        var otherAsset = new UUID[] {data[0], data[1], new DeviceTestData(db).asset(data[0], data[1])};
        for (var target : List.of(otherAsset, asset())) {
            mvc.perform(get(inspections(target)).param("cursor", cursor).with(jwt().jwt(t -> t.subject(OWNER))))
                    .andExpect(status().isBadRequest());
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void inspectionAssetContextExposesOnlyTheRestrictedFieldsAndHistoricalActivity(String role) throws Exception {
        var data = asset();
        member(data[0], "limited-reader", role);
        String base = "/estates/" + data[0] + "/inspection-assets";
        read(base + "/" + data[2], "limited-reader")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(data[2].toString()))
                .andExpect(jsonPath("$.locationId").value(data[1].toString()))
                .andExpect(jsonPath("$.locationPath").value("Block A"))
                .andExpect(jsonPath("$.installedOn").value("2020-01-01"))
                .andExpect(jsonPath("$.estateActive").value(true))
                .andExpect(jsonPath("$.assetActive").value(true))
                .andExpect(jsonPath("$.locationActive").value(true))
                .andExpect(jsonPath("$.serialNumber").doesNotExist())
                .andExpect(jsonPath("$.purchaseCost").doesNotExist())
                .andExpect(jsonPath("$.condition").doesNotExist());
        mvc.perform(get(base).param("q", "%").with(jwt().jwt(t -> t.subject("limited-reader"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        db.execute(
                "update \"Asset\" set \"deactivatedAt\"=now(),\"retiredOn\"=current_date,\"retirementReason\"='Retired' where id=?",
                data[2]);
        read(base, "limited-reader")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(data[2].toString()))
                .andExpect(jsonPath("$.items[0].assetActive").value(false));
        // Existing owner-only asset APIs deliberately hide records from other roles.
        read("/estates/" + data[0] + "/assets/" + data[2], "limited-reader").andExpect(status().isNotFound());
    }

    @Test
    void revocationRemovesAccessEvenToTheInspectorsOwnRecords() throws Exception {
        var data = asset();
        member(data[0], "former-inspector", "CREW");
        String resultId = id(save(data, "former-inspector", "FAIL")
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='former-inspector'", data[0]);
        read(inspections(data), "former-inspector").andExpect(status().isNotFound());
        read(inspections(data) + "/" + resultId, "former-inspector").andExpect(status().isNotFound());
        save(data, "former-inspector", "PASS").andExpect(status().isNotFound());
        read(inspections(data) + "/" + resultId, OWNER).andExpect(status().isOk());
    }
}
