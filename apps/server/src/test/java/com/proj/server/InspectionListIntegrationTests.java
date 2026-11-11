package com.proj.server;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.workos.WorkOSService;
import java.time.LocalDate;
import java.time.ZoneId;
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
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

/** The monthly inspection list and overdue checks (ID-84, ID-86, spec monthly-inspection-list.md). */
@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class InspectionListIntegrationTests {
    static final LocalDate TODAY = LocalDate.now(ZoneId.of("Asia/Singapore"));
    static final LocalDate MONTH = TODAY.withDayOfMonth(1);
    static final LocalDate MONTH_END = TODAY.withDayOfMonth(TODAY.lengthOfMonth());

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService workOS;

    UUID estateId, blockA;

    @BeforeEach
    void setup() {
        estateId = estate("owner");
        blockA = location("BLOCK", "Block A", null, null, null);
        when(workOS.findDisplayName("owner")).thenReturn(Optional.of("Casey Doe"));
        when(workOS.findDisplayName("manager")).thenReturn(Optional.of("Morgan Lee"));
    }

    UUID estate(String owner) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Estate\" (id, \"ownerUserId\", name, code, address, \"postalCode\", \"updatedAt\") values (?, ?, 'Estate', ?, 'Road', '123456', now())",
                id,
                owner,
                id.toString());
        return id;
    }

    UUID location(String type, String name, UUID parent, String parentType, Integer sortOrder) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id, \"estateId\", type, name, \"parentId\", \"parentType\", \"sortOrder\", \"updatedAt\") values (?, ?, ?, ?, ?, ?, ?, now())",
                id,
                estateId,
                type,
                name,
                parent,
                parentType,
                sortOrder);
        return id;
    }

    UUID asset(String reference, String category, UUID location, LocalDate installedOn) {
        var id = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"installedOn\", \"updatedAt\") values (?, ?, ?, ?, ?, ?, ?, now())",
                id,
                estateId,
                location,
                reference,
                "Asset " + reference,
                category,
                installedOn);
        return id;
    }

    UUID lamp(String reference) {
        return asset(reference, "LIGHTING", blockA, null);
    }

    void inspected(UUID asset, UUID location, LocalDate on) {
        db.execute(
                "insert into \"AssetInspectionResult\" (id, \"estateId\", \"assetId\", \"locationId\", \"locationPath\", outcome, \"inspectedOn\", \"recordedByUserId\") values (?, ?, ?, ?, 'Block A', 'PASS', ?, 'owner')",
                UUID.randomUUID(),
                estateId,
                asset,
                location,
                on);
    }

    void categoryInterval(String category, int value, String unit) {
        db.execute(
                "insert into \"AssetCategoryIntervalChange\" (id, \"estateId\", category, \"intervalValue\", \"intervalUnit\", \"changedByUserId\") values (?, ?, ?, ?, ?, 'owner')",
                UUID.randomUUID(),
                estateId,
                category,
                value,
                unit);
    }

    void openCheck(UUID asset, LocalDate month) {
        db.execute(
                "insert into \"InspectionCheck\" (id, \"estateId\", \"assetId\", month, \"dueOn\", \"dueBasis\", \"generatedByUserId\") values (?, ?, ?, ?, ?, 'NEVER_INSPECTED', 'owner')",
                UUID.randomUUID(),
                estateId,
                asset,
                month,
                month);
    }

    void membership(String user, String role) {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estateId, user, role);
    }

    ResultActions list(String user) throws Exception {
        return mvc.perform(get("/estates/" + estateId + "/inspection-list").with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions generate(String user) throws Exception {
        return mvc.perform(
                post("/estates/" + estateId + "/inspection-list/generate").with(jwt().jwt(j -> j.subject(user))));
    }

    ResultActions record(UUID asset, UUID location, String outcome) throws Exception {
        return mvc.perform(
                StoredUploadSubmission.inspection("/estates/" + estateId + "/assets/" + asset + "/inspections", null)
                        .param("expectedLocationId", location.toString())
                        .param("outcome", outcome)
                        .param("inspectedOn", TODAY.toString())
                        .param("notes", "FAIL".equals(outcome) ? "Not working" : "")
                        .with(jwt().jwt(j -> j.subject("owner"))));
    }

    int checks() {
        return ((Number) db.fetchValue("select count(*) from \"InspectionCheck\" where \"estateId\" = ?", estateId))
                .intValue();
    }

    static String check(String reference, String field) {
        return "$.list.checks[?(@.assetReference == '" + reference + "')]." + field;
    }

    @Test
    void anUngeneratedMonthIsEmpty() throws Exception {
        list("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").value(MONTH.toString()))
                .andExpect(jsonPath("$.estateActive").value(true))
                .andExpect(jsonPath("$.generatedAt").value(nullValue()))
                .andExpect(jsonPath("$.generatedByName").value(nullValue()))
                .andExpect(jsonPath("$.overdueCount").value(0))
                .andExpect(jsonPath("$.dueCount").value(0))
                .andExpect(jsonPath("$.doneCount").value(0))
                .andExpect(jsonPath("$.checks", hasSize(0)))
                .andExpect(jsonPath("$.unscheduled", hasSize(0)));
    }

    @Test
    void countsTheFlaggedCategories() throws Exception {
        list("owner").andExpect(jsonPath("$.flaggedCategoryCount").value(1));
        db.execute(
                "insert into \"AssetCategoryFlagChange\" (id, \"estateId\", category, \"failsSilently\", \"changedByUserId\") values (?, ?, 'LIGHTING', false, 'owner')",
                UUID.randomUUID(),
                estateId);
        list("owner").andExpect(jsonPath("$.flaggedCategoryCount").value(0));
        generate("owner").andExpect(jsonPath("$.list.flaggedCategoryCount").value(0));
    }

    @Test
    void generatingAddsANeverInspectedFlaggedAsset() throws Exception {
        lamp("L-1");
        generate("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.added").value(1))
                .andExpect(jsonPath("$.list.generatedAt").isNotEmpty())
                .andExpect(jsonPath("$.list.generatedByName").value("Casey Doe"))
                .andExpect(jsonPath("$.list.dueCount").value(1))
                .andExpect(jsonPath("$.list.checks[0].assetReference").value("L-1"))
                .andExpect(jsonPath("$.list.checks[0].assetName").value("Asset L-1"))
                .andExpect(jsonPath("$.list.checks[0].categoryLabel").value("Lighting"))
                .andExpect(jsonPath("$.list.checks[0].block.name").value("Block A"))
                .andExpect(jsonPath("$.list.checks[0].level").value(nullValue()))
                .andExpect(jsonPath("$.list.checks[0].dueOn").value(MONTH.toString()))
                .andExpect(jsonPath("$.list.checks[0].dueBasis").value("NEVER_INSPECTED"))
                .andExpect(jsonPath("$.list.checks[0].interval").value(nullValue()))
                .andExpect(jsonPath("$.list.checks[0].status").value("DUE"))
                .andExpect(jsonPath("$.list.checks[0].result").value(nullValue()));
        assertEquals(1, checks());
    }

    @Test
    void onlyActiveAssetsInFlaggedCategoriesAreChecked() throws Exception {
        lamp("L-1");
        asset("P-1", "PUMP", blockA, null);
        var retired = lamp("L-2");
        db.execute(
                "update \"Asset\" set \"deactivatedAt\" = now(), \"retiredOn\" = current_date where id = ?", retired);
        generate("owner").andExpect(jsonPath("$.added").value(1));
        db.execute(
                "insert into \"AssetCategoryFlagChange\" (id, \"estateId\", category, \"failsSilently\", \"changedByUserId\") values (?, ?, 'PUMP', true, 'owner')",
                UUID.randomUUID(),
                estateId);
        generate("owner")
                .andExpect(jsonPath("$.added").value(1))
                .andExpect(jsonPath("$.list.checks[*].assetReference", contains("L-1", "P-1")));
    }

    @Test
    void aServiceIntervalSetsTheDueDate() throws Exception {
        var due = lamp("L-DUE");
        var later = lamp("L-LATER");
        categoryInterval("LIGHTING", 30, "DAY");
        inspected(due, blockA, MONTH_END.minusDays(30));
        inspected(later, blockA, MONTH_END.minusDays(29));
        generate("owner")
                .andExpect(jsonPath("$.added").value(1))
                .andExpect(jsonPath(check("L-DUE", "dueOn")).value(contains(MONTH_END.toString())))
                .andExpect(jsonPath(check("L-DUE", "dueBasis")).value(contains("INTERVAL")))
                .andExpect(jsonPath(check("L-DUE", "interval.value")).value(contains(30)))
                .andExpect(jsonPath(check("L-DUE", "interval.unit")).value(contains("DAY")))
                .andExpect(jsonPath(check("L-DUE", "intervalSource")).value(contains("CATEGORY")))
                .andExpect(jsonPath("$.list.checks", hasSize(1)));
    }

    @Test
    void anAssetOverrideIsUsedAndRecorded() throws Exception {
        var lamp = lamp("L-1");
        categoryInterval("LIGHTING", 10, "YEAR");
        db.execute(
                "insert into \"AssetIntervalChange\" (id, \"assetId\", \"intervalValue\", \"intervalUnit\", \"changedByUserId\") values (?, ?, 7, 'DAY', 'owner')",
                UUID.randomUUID(),
                lamp);
        inspected(lamp, blockA, TODAY.minusDays(7));
        generate("owner")
                .andExpect(jsonPath("$.list.checks[0].dueOn").value(TODAY.toString()))
                .andExpect(jsonPath("$.list.checks[0].interval.unit").value("DAY"))
                .andExpect(jsonPath("$.list.checks[0].intervalSource").value("ASSET"));
    }

    @Test
    void theInstallationDateStandsInForAMissingInspection() throws Exception {
        asset("L-1", "LIGHTING", blockA, TODAY.minusYears(2));
        categoryInterval("LIGHTING", 1, "YEAR");
        generate("owner")
                .andExpect(jsonPath("$.list.checks[0].dueOn")
                        .value(TODAY.minusYears(1).toString()))
                .andExpect(jsonPath("$.list.checks[0].dueBasis").value("INTERVAL"));
    }

    @Test
    void anInspectedAssetWithoutAnIntervalIsNotScheduled() throws Exception {
        var lamp = lamp("L-1");
        inspected(lamp, blockA, TODAY.minusDays(1));
        generate("owner")
                .andExpect(jsonPath("$.added").value(0))
                .andExpect(jsonPath("$.list.checks", hasSize(0)))
                .andExpect(jsonPath("$.list.unscheduled[0].assetId").value(lamp.toString()))
                .andExpect(jsonPath("$.list.unscheduled[0].assetReference").value("L-1"))
                .andExpect(jsonPath("$.list.unscheduled[0].categoryLabel").value("Lighting"));
        list("owner").andExpect(jsonPath("$.unscheduled", hasSize(1)));
    }

    @Test
    void regeneratingNeverDuplicatesAndAddsNewlyDueAssets() throws Exception {
        lamp("L-1");
        generate("owner").andExpect(jsonPath("$.added").value(1));
        generate("owner").andExpect(jsonPath("$.added").value(0));
        assertEquals(1, checks());
        lamp("L-2");
        generate("owner").andExpect(jsonPath("$.added").value(1)).andExpect(jsonPath("$.list.checks", hasSize(2)));
        assertEquals(2, checks());
    }

    @Test
    void recordingAnInspectionCompletesTheOpenCheck() throws Exception {
        var lamp = lamp("L-1");
        generate("owner");
        record(lamp, blockA, "FAIL").andExpect(status().isCreated());
        list("owner")
                .andExpect(jsonPath("$.dueCount").value(0))
                .andExpect(jsonPath("$.doneCount").value(1))
                .andExpect(jsonPath("$.checks[0].status").value("DONE"))
                .andExpect(jsonPath("$.checks[0].result.outcome").value("FAIL"))
                .andExpect(jsonPath("$.checks[0].result.inspectedOn").value(TODAY.toString()))
                .andExpect(jsonPath("$.checks[0].result.id").isNotEmpty());
        record(lamp, blockA, "PASS").andExpect(status().isCreated());
        assertEquals(
                1,
                ((Number) db.fetchValue(
                                "select count(*) from \"InspectionCheck\" where \"completedByResultId\" is not null"))
                        .intValue());
    }

    @Test
    void aResultWithoutAnOpenCheckCompletesNothing() throws Exception {
        var lamp = lamp("L-1");
        record(lamp, blockA, "PASS").andExpect(status().isCreated());
        assertEquals(0, checks());
    }

    @Test
    void anOpenCheckFromAnEarlierMonthIsCarriedOverAsOverdue() throws Exception {
        var lamp = lamp("L-1");
        openCheck(lamp, MONTH.minusMonths(1));
        list("owner")
                .andExpect(jsonPath("$.overdueCount").value(1))
                .andExpect(jsonPath("$.dueCount").value(0))
                .andExpect(jsonPath("$.checks[0].status").value("OVERDUE"))
                .andExpect(jsonPath("$.generatedAt").value(nullValue()));
        generate("owner")
                .andExpect(jsonPath("$.added").value(0))
                .andExpect(jsonPath("$.list.checks", hasSize(1)))
                .andExpect(jsonPath("$.list.overdueCount").value(1));
        assertEquals(1, checks());
        record(lamp, blockA, "PASS").andExpect(status().isCreated());
        list("owner").andExpect(jsonPath("$.overdueCount").value(0)).andExpect(jsonPath("$.checks", hasSize(0)));
    }

    @Test
    void overdueComesBeforeDueWithinAGroup() throws Exception {
        var old = lamp("L-2");
        lamp("L-1");
        openCheck(old, MONTH.minusMonths(2));
        generate("owner")
                .andExpect(jsonPath("$.list.checks[*].assetReference", contains("L-2", "L-1")))
                .andExpect(jsonPath("$.list.checks[*].status", contains("OVERDUE", "DUE")));
    }

    @Test
    void retiredAssetsOpenChecksAreHidden() throws Exception {
        var lamp = lamp("L-1");
        openCheck(lamp, MONTH.minusMonths(1));
        db.execute("update \"Asset\" set \"deactivatedAt\" = now() where id = ?", lamp);
        list("owner").andExpect(jsonPath("$.overdueCount").value(0)).andExpect(jsonPath("$.checks", hasSize(0)));
    }

    @Test
    void checksAreGroupedByBlockThenLevel() throws Exception {
        var blockB = location("BLOCK", "Block B", null, null, null);
        var level2 = location("LEVEL", "Level 2", blockA, "BLOCK", 2);
        var level1 = location("LEVEL", "Level 1", blockA, "BLOCK", 1);
        var lobby = location("COMMON_AREA", "Lobby", level1, "LEVEL", null);
        var carPark = location("COMMON_AREA", "Car park", blockA, "BLOCK", null);
        asset("B-1", "LIGHTING", blockB, null);
        asset("A2-1", "LIGHTING", level2, null);
        asset("A1-2", "LIGHTING", lobby, null);
        asset("A1-1", "LIGHTING", level1, null);
        asset("A0-1", "LIGHTING", carPark, null);
        generate("owner")
                .andExpect(jsonPath("$.list.checks[*].assetReference", contains("A0-1", "A1-1", "A1-2", "A2-1", "B-1")))
                .andExpect(jsonPath(check("A1-2", "level.name")).value(contains("Level 1")))
                .andExpect(jsonPath(check("A1-2", "block.name")).value(contains("Block A")))
                .andExpect(jsonPath(check("A0-1", "level")).value(contains(nullValue())))
                .andExpect(jsonPath(check("B-1", "block.name")).value(contains("Block B")));
    }

    @Test
    void anAssignedManagerCanReadAndGenerate() throws Exception {
        membership("manager", "MANAGER");
        lamp("L-1");
        list("manager").andExpect(status().isOk());
        generate("manager")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list.generatedByName").value("Morgan Lee"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREW", "COUNCIL", "MEMBER"})
    void otherEstateRolesFindNothing(String role) throws Exception {
        membership("staff", role);
        lamp("L-1");
        list("staff").andExpect(status().isNotFound());
        generate("staff").andExpect(status().isNotFound());
        assertEquals(0, checks());
    }

    @Test
    void strangersFindNothingAndResidentsAreRefused() throws Exception {
        lamp("L-1");
        list("stranger").andExpect(status().isNotFound());
        generate("stranger").andExpect(status().isNotFound());
        membership("resident", "RESIDENT");
        list("resident").andExpect(status().isForbidden());
        generate("resident").andExpect(status().isForbidden());
        assertEquals(0, checks());
    }

    @Test
    void anInactiveEstateIsReadOnly() throws Exception {
        lamp("L-1");
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", estateId);
        list("owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estateActive").value(false));
        generate("owner")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertEquals(0, checks());
    }

    @Test
    void requiresSignIn() throws Exception {
        mvc.perform(get("/estates/" + estateId + "/inspection-list")).andExpect(status().isUnauthorized());
        mvc.perform(post("/estates/" + estateId + "/inspection-list/generate")).andExpect(status().isUnauthorized());
    }
}
