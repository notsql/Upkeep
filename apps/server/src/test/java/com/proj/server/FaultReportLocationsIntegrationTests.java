package com.proj.server;

import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.proj.server.resident.ResidentImageStore;
import com.proj.server.resident.ResidentReportException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Executable HTTP acceptance contract for the fault-report-locations feature. */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class FaultReportLocationsIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    ResidentImageStore imageStore;

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void respondersSeeAllEstateReportsWithFullPathsAndPrivateImageMetadata(String role) throws Exception {
        var estate = estate();
        member(estate, "staff", role);
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var lobby = location(estate, "COMMON_AREA", level, "Lift lobby");
        var first = report(estate, lobby, "resident-a");
        var second = report(estate, level, "resident-b");
        var image = image(first);
        var foreignEstate = estate();
        var foreignBlock = location(foreignEstate, "BLOCK", null, "Block A");
        report(foreignEstate, location(foreignEstate, "LEVEL", foreignBlock, "Level 4"), "resident-a");

        mvc.perform(asStaff(get(reports(estate))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[*].id", containsInAnyOrder(first.toString(), second.toString())))
                .andExpect(jsonPath("$.items[*].location.label", hasItem("Block A › Level 4 › Lift lobby")))
                .andExpect(jsonPath("$.items[*].title", hasItem("Leaking pipe")))
                .andExpect(jsonPath("$.items[*].status", hasItem("SUBMITTED")));
        mvc.perform(asStaff(get(detail(estate, first))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(first.toString()))
                .andExpect(jsonPath("$.description").value("Water pooling near the lift"))
                .andExpect(jsonPath("$.location.id").value(lobby.toString()))
                .andExpect(jsonPath("$.location.label").value("Block A › Level 4 › Lift lobby"))
                .andExpect(jsonPath("$.images[0].id").value(image.toString()))
                .andExpect(jsonPath("$.images[0].contentType").value("image/png"))
                .andExpect(jsonPath("$.images[0].storageKey").doesNotExist())
                .andExpect(jsonPath("$.submittedByUserId").doesNotExist());
    }

    @ParameterizedTest
    @ValueSource(strings = {"COUNCIL", "RESIDENT", "MEMBER"})
    void otherEstateRolesCannotReadImagesOrRelocateReports(String role) throws Exception {
        var estate = estate();
        member(estate, "staff", role);
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var report = report(estate, level, "resident-a");
        var image = image(report);
        var before = reportRow(report);

        mvc.perform(asStaff(get(reports(estate)))).andExpect(status().isForbidden());
        mvc.perform(asStaff(get(detail(estate, report)))).andExpect(status().isForbidden());
        mvc.perform(asStaff(get(detail(estate, report) + "/images/" + image))).andExpect(status().isForbidden());
        mvc.perform(relocate(estate, report, level, level)).andExpect(status().isForbidden());
        assertEquals(before, reportRow(report));
        verifyNoInteractions(imageStore);
    }

    @Test
    void aWorkosAdminClaimAndResponderMembershipElsewhereDoNotBypassEstateAuthorization() throws Exception {
        var assigned = estate();
        var other = estate();
        member(assigned, "staff", "MANAGER");
        var block = location(other, "BLOCK", null, "Block B");
        var level = location(other, "LEVEL", block, "Level 2");
        var report = report(other, level, "resident-b");
        var image = image(report);
        for (var user : List.of("staff", "unassigned-admin")) {
            var token = jwt().jwt(value -> value.subject(user).claim("role", "admin"))
                    .authorities(new SimpleGrantedAuthority("ROLE_admin"));
            mvc.perform(get(reports(other)).with(token)).andExpect(status().isNotFound());
            mvc.perform(get(detail(other, report)).with(token)).andExpect(status().isNotFound());
            mvc.perform(get(detail(other, report) + "/images/" + image).with(token))
                    .andExpect(status().isNotFound());
            mvc.perform(patch(detail(other, report) + "/location")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body(level, level))
                            .with(token))
                    .andExpect(status().isNotFound());
        }
        assertEquals(level, reportRow(report).get("locationId"));
        verifyNoInteractions(imageStore);
    }

    @Test
    void mixingEstateReportLocationAndImageIdsNeverCrossesEstateBoundaries() throws Exception {
        var first = estate();
        var second = estate();
        member(first, "staff", "CREW");
        member(second, "staff", "CREW");
        var firstBlock = location(first, "BLOCK", null, "Block A");
        var firstLevel = location(first, "LEVEL", firstBlock, "Level 4");
        var firstReport = report(first, firstLevel, "resident-a");
        var secondBlock = location(second, "BLOCK", null, "Block B");
        var secondLevel = location(second, "LEVEL", secondBlock, "Level 2");
        var secondReport = report(second, secondLevel, "resident-b");
        var secondImage = image(secondReport);
        var before = reportRow(firstReport);

        mvc.perform(asStaff(get(detail(first, secondReport)))).andExpect(status().isNotFound());
        mvc.perform(asStaff(get(detail(first, firstReport) + "/images/" + secondImage)))
                .andExpect(status().isNotFound());
        mvc.perform(asStaff(get(detail(first, secondReport) + "/images/" + secondImage)))
                .andExpect(status().isNotFound());
        mvc.perform(asStaff(get(reports(first)).param("locationId", secondBlock.toString())))
                .andExpect(status().isNotFound());
        mvc.perform(relocate(first, firstReport, firstLevel, secondLevel)).andExpect(status().isNotFound());
        mvc.perform(relocate(first, secondReport, secondLevel, firstLevel)).andExpect(status().isNotFound());
        assertEquals(before, reportRow(firstReport));
        assertEquals(secondLevel, reportRow(secondReport).get("locationId"));
        verifyNoInteractions(imageStore);
    }

    @Test
    void respondersStillCannotUseResidentUrlsToReadAnotherPersonsReports() throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var report = report(estate, level, "resident-a");
        var image = image(report);

        mvc.perform(asStaff(get("/resident/reports")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(asStaff(get("/resident/reports/" + report))).andExpect(status().isNotFound());
        mvc.perform(asStaff(get("/resident/reports/" + report + "/images/" + image)))
                .andExpect(status().isNotFound());
        verifyNoInteractions(imageStore);
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void accessCapabilitiesFollowCurrentResponderMembershipAndEstateActivity(String role) throws Exception {
        var estate = estate();
        member(estate, "staff", role);
        mvc.perform(asStaff(get("/access/context")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].estateName").value("Maple Estate"))
                .andExpect(jsonPath("$.canEnterWorkspace").value(true))
                .andExpect(jsonPath("$.estates[0].canViewFaultReports").value(true))
                .andExpect(jsonPath("$.estates[0].canRelocateFaultReports").value(true));
        db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estate);
        mvc.perform(asStaff(get("/access/context")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewFaultReports").value(true))
                .andExpect(jsonPath("$.estates[0].canRelocateFaultReports").value(false));
    }

    @ParameterizedTest
    @ValueSource(strings = {"COUNCIL", "RESIDENT", "MEMBER"})
    void nonrespondersHaveNoFaultReportCapabilities(String role) throws Exception {
        var estate = estate();
        member(estate, "staff", role);
        mvc.perform(asStaff(get("/access/context")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewFaultReports").value(false))
                .andExpect(jsonPath("$.estates[0].canRelocateFaultReports").value(false));
    }

    @Test
    void conflictingOwnerResidentMembershipFailsClosed() throws Exception {
        var estate = estate();
        db.execute("update \"Estate\" set \"ownerUserId\"='staff' where id=?", estate);
        member(estate, "staff", "RESIDENT");
        mvc.perform(asStaff(get(reports(estate)))).andExpect(status().isForbidden());
        mvc.perform(asStaff(get("/access/context")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estates[0].canViewFaultReports").value(false))
                .andExpect(jsonPath("$.estates[0].canRelocateFaultReports").value(false));
    }

    @Test
    void parentFiltersIncludeExactlyTheirDescendantsIncludingDirectBlockCommonAreasAndInactiveHistory()
            throws Exception {
        var estate = estate();
        member(estate, "staff", "CREW");
        var blockA = location(estate, "BLOCK", null, "Block A");
        var levelA = location(estate, "LEVEL", blockA, "Level 4");
        var lobbyA = location(estate, "COMMON_AREA", levelA, "Lift lobby");
        var courtyard = location(estate, "COMMON_AREA", blockA, "Courtyard");
        var oldArea = location(estate, "COMMON_AREA", levelA, "Old lobby");
        var blockB = location(estate, "BLOCK", null, "Block B");
        var levelB = location(estate, "LEVEL", blockB, "Level 4");
        var lobbyB = location(estate, "COMMON_AREA", levelB, "Lift lobby");
        var atLevel = report(estate, levelA, "resident-a");
        var atLobby = report(estate, lobbyA, "resident-b");
        var atCourtyard = report(estate, courtyard, "resident-c");
        var historical = report(estate, oldArea, "former-resident");
        report(estate, lobbyB, "resident-d");
        db.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", oldArea);

        mvc.perform(asStaff(get(reports(estate)).param("locationId", blockA.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath(
                        "$.items[*].id",
                        containsInAnyOrder(
                                atLevel.toString(), atLobby.toString(), atCourtyard.toString(), historical.toString())))
                .andExpect(jsonPath("$.items[*].location.label", hasItem("Block A › Courtyard")));
        mvc.perform(asStaff(get(reports(estate)).param("locationId", levelA.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath(
                        "$.items[*].id",
                        containsInAnyOrder(atLevel.toString(), atLobby.toString(), historical.toString())));
        mvc.perform(asStaff(get(reports(estate)).param("locationId", lobbyA.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", containsInAnyOrder(atLobby.toString())));
        mvc.perform(asStaff(get(reports(estate)).param("locationId", oldArea.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", containsInAnyOrder(historical.toString())));
        mvc.perform(asStaff(get(reports(estate))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(5));
    }

    @Test
    void blockAndPositionFiltersUseNumericPositionsAndIncludeLevelCommonAreasAndInactiveHistory() throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        var block = location(estate, "BLOCK", null, "Block A");
        var basement = location(estate, "LEVEL", block, "Level 99");
        db.execute("update \"Location\" set \"sortOrder\"=-1 where id=?", basement);
        var ground = location(estate, "LEVEL", block, "Ground floor");
        db.execute("update \"Location\" set \"sortOrder\"=0 where id=?", ground);
        var upper = location(estate, "LEVEL", block, "Level -1");
        var lobby = location(estate, "COMMON_AREA", basement, "Basement lobby");
        var courtyard = location(estate, "COMMON_AREA", block, "Courtyard");
        var atBasement = report(estate, basement, "resident-a");
        var atGround = report(estate, ground, "resident-a");
        var atLobby = report(estate, lobby, "resident-b");
        var atCourtyard = report(estate, courtyard, "resident-c");
        var atUpper = report(estate, upper, "resident-d");
        db.execute("update \"Location\" set \"deactivatedAt\"=now() where id in (?, ?, ?)", lobby, basement, block);
        var other = location(estate, "BLOCK", null, "Block B");
        report(estate, location(estate, "LEVEL", other, "Other level"), "resident-e");

        mvc.perform(asStaff(get(reports(estate))
                        .param("blockId", block.toString())
                        .param("minLevelPosition", "-1")
                        .param("maxLevelPosition", "0")))
                .andExpect(status().isOk())
                .andExpect(jsonPath(
                        "$.items[*].id",
                        containsInAnyOrder(atBasement.toString(), atGround.toString(), atLobby.toString())));
        mvc.perform(asStaff(get(reports(estate)).param("blockId", block.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath(
                        "$.items[*].id",
                        containsInAnyOrder(
                                atBasement.toString(),
                                atGround.toString(),
                                atLobby.toString(),
                                atCourtyard.toString(),
                                atUpper.toString())));
        mvc.perform(asStaff(get(reports(estate))
                        .param("blockId", block.toString())
                        .param("minLevelPosition", "-1")
                        .param("maxLevelPosition", "-1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", containsInAnyOrder(atBasement.toString(), atLobby.toString())));
        mvc.perform(asStaff(
                        get(reports(estate)).param("blockId", block.toString()).param("minLevelPosition", "99")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void openEndedPositionRangesWorkAcrossBlocksAndStayWithinTheEstate() throws Exception {
        var estate = estate();
        member(estate, "staff", "CREW");
        var first = location(estate, "BLOCK", null, "Block A");
        var low = location(estate, "LEVEL", first, "Low");
        var high = location(estate, "LEVEL", first, "High");
        var second = location(estate, "BLOCK", null, "Block B");
        var otherLow = location(estate, "LEVEL", second, "Other low");
        var lowReport = report(estate, low, "resident-a");
        var highReport = report(estate, high, "resident-a");
        var otherReport = report(estate, otherLow, "resident-b");
        var foreign = estate();
        var foreignBlock = location(foreign, "BLOCK", null, "Foreign");
        report(foreign, location(foreign, "LEVEL", foreignBlock, "Foreign low"), "resident-c");
        mvc.perform(asStaff(get(reports(estate)).param("maxLevelPosition", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", containsInAnyOrder(lowReport.toString(), otherReport.toString())));
        mvc.perform(asStaff(get(reports(estate)).param("minLevelPosition", "2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", containsInAnyOrder(highReport.toString())));
        mvc.perform(asStaff(get(reports(estate))
                        .param("blockId", first.toString())
                        .param("locationId", high.toString())
                        .param("maxLevelPosition", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void positionAndBlockFiltersRunBeforeCursorPagination() throws Exception {
        var estate = estate();
        member(estate, "staff", "CREW");
        var block = location(estate, "BLOCK", null, "Block A");
        var low = location(estate, "LEVEL", block, "Low");
        var high = location(estate, "LEVEL", block, "High");
        var older = UUID.fromString("00000000-0000-0000-0000-000000000001");
        var newer = UUID.fromString("00000000-0000-0000-0000-000000000002");
        insertReport(older, estate, low, "resident-a");
        insertReport(newer, estate, low, "resident-b");
        var excluded = report(estate, high, "resident-c");
        db.execute("update \"IssueReport\" set \"createdAt\"=now() where id=?", excluded);
        var first = mvc.perform(asStaff(get(reports(estate))
                        .param("blockId", block.toString())
                        .param("maxLevelPosition", "1")
                        .param("limit", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(newer.toString()))
                .andReturn();
        String cursor = JsonPath.read(first.getResponse().getContentAsString(), "$.nextCursor");
        mvc.perform(asStaff(get(reports(estate))
                        .param("blockId", block.toString())
                        .param("maxLevelPosition", "1")
                        .param("limit", "1")
                        .param("cursor", cursor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(older.toString()))
                .andExpect(jsonPath("$.nextCursor").value((Object) null));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "minLevelPosition=2&maxLevelPosition=1",
                "minLevelPosition=1.5",
                "maxLevelPosition=abc",
                "minLevelPosition=2147483648",
                "maxLevelPosition=-2147483649",
                "blockId=invalid"
            })
    void rejectsInvalidBlockAndPositionFilters(String query) throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        mvc.perform(asStaff(get(reports(estate) + "?" + query))).andExpect(status().isBadRequest());
    }

    @Test
    void blockFiltersValidateTypeAndEstateAndAllowEmptyBlocks() throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        var empty = location(estate, "BLOCK", null, "Empty");
        var level = location(estate, "LEVEL", empty, "Level");
        var foreign = location(estate(), "BLOCK", null, "Foreign");
        mvc.perform(asStaff(get(reports(estate)).param("blockId", empty.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(asStaff(get(reports(estate)).param("blockId", level.toString())))
                .andExpect(status().isBadRequest());
        for (var id : List.of(foreign, UUID.randomUUID())) {
            mvc.perform(asStaff(get(reports(estate)).param("blockId", id.toString())))
                    .andExpect(status().isNotFound());
        }
    }

    @Test
    void emptySubtreesAreSuccessfulAndMissingOrMalformedFiltersAreErrors() throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        var empty = location(estate, "BLOCK", null, "Empty block");
        mvc.perform(asStaff(get(reports(estate)).param("locationId", empty.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty())
                .andExpect(jsonPath("$.nextCursor").value((Object) null));
        mvc.perform(asStaff(get(reports(estate))
                        .param("locationId", UUID.randomUUID().toString())))
                .andExpect(status().isNotFound());
        mvc.perform(asStaff(get(reports(estate)).param("locationId", "not-a-uuid")))
                .andExpect(status().isBadRequest());
        mvc.perform(asStaff(get(detail(estate, UUID.randomUUID())))).andExpect(status().isNotFound());
    }

    @Test
    void hierarchyFilterRunsBeforeCursorPaginationWithStableIdOrderForEqualTimestamps() throws Exception {
        var estate = estate();
        member(estate, "staff", "CREW");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var otherBlock = location(estate, "BLOCK", null, "Block B");
        var otherLevel = location(estate, "LEVEL", otherBlock, "Level 4");
        var older = UUID.fromString("00000000-0000-0000-0000-000000000001");
        var newer = UUID.fromString("00000000-0000-0000-0000-000000000002");
        insertReport(older, estate, level, "resident-a");
        insertReport(newer, estate, level, "resident-b");
        var unrelated = report(estate, otherLevel, "resident-c");
        db.execute("update \"IssueReport\" set \"createdAt\"=now() where id=?", unrelated);

        var response = mvc.perform(asStaff(get(reports(estate))
                        .param("locationId", block.toString())
                        .param("limit", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(newer.toString()))
                .andExpect(jsonPath("$.nextCursor").isNotEmpty())
                .andReturn();
        String cursor = JsonPath.read(response.getResponse().getContentAsString(), "$.nextCursor");
        mvc.perform(asStaff(get(reports(estate))
                        .param("locationId", block.toString())
                        .param("limit", "1")
                        .param("cursor", cursor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(older.toString()))
                .andExpect(jsonPath("$.nextCursor").value((Object) null));
    }

    @ParameterizedTest
    @ValueSource(strings = {"limit=0", "limit=51", "limit=abc", "cursor=not-a-cursor"})
    void rejectsInvalidResponderPagination(String query) throws Exception {
        var estate = estate();
        member(estate, "staff", "CREW");
        mvc.perform(asStaff(get(reports(estate) + "?" + query))).andExpect(status().isBadRequest());
    }

    @Test
    void defaultPageSizeIsTwentyAndMaximumPageSizeIsFifty() throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        for (var i = 0; i < 51; i++) report(estate, level, "resident-" + i);
        mvc.perform(asStaff(get(reports(estate))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(20))
                .andExpect(jsonPath("$.nextCursor").isNotEmpty());
        mvc.perform(asStaff(get(reports(estate)).param("limit", "50")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(50))
                .andExpect(jsonPath("$.nextCursor").isNotEmpty());
    }

    @Test
    void renamesAndReparentingUpdateDisplayedPathsAndFilterAncestryWithoutChangingTheReportReference()
            throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        var oldBlock = location(estate, "BLOCK", null, "Block A");
        var newBlock = location(estate, "BLOCK", null, "Block B");
        var level = location(estate, "LEVEL", oldBlock, "Level 4");
        var lobby = location(estate, "COMMON_AREA", level, "Lift lobby");
        var report = report(estate, lobby, "resident-a");
        db.execute("update \"Location\" set name='Renamed lobby' where id=?", lobby);
        db.execute("update \"Location\" set \"parentId\"=? where id=?", newBlock, level);

        mvc.perform(asStaff(get(detail(estate, report))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.id").value(lobby.toString()))
                .andExpect(jsonPath("$.location.label").value("Block B › Level 4 › Renamed lobby"));
        mvc.perform(asStaff(get(reports(estate)).param("locationId", oldBlock.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(asStaff(get(reports(estate)).param("locationId", newBlock.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", hasItem(report.toString())));
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void correctionsCanChangeBlockLevelAndCommonAreaWhilePreservingEveryOtherFieldAndImage(String role)
            throws Exception {
        var estate = estate();
        member(estate, "staff", role);
        member(estate, "resident-a", "RESIDENT");
        var blockA = location(estate, "BLOCK", null, "Block A");
        var levelA = location(estate, "LEVEL", blockA, "Level 4");
        var lobbyA = location(estate, "COMMON_AREA", levelA, "Lift lobby");
        var blockB = location(estate, "BLOCK", null, "Block B");
        var levelB = location(estate, "LEVEL", blockB, "Level 2");
        var lobbyB = location(estate, "COMMON_AREA", levelB, "Lift lobby");
        var otherLobby = location(estate, "COMMON_AREA", levelB, "Stair lobby");
        var courtyard = location(estate, "COMMON_AREA", blockB, "Courtyard");
        var report = report(estate, lobbyA, "resident-a");
        var image = image(report);
        var original = reportRow(report);
        var originalImages = imageRows(report);
        var current = lobbyA;

        // The body deliberately contains no correction reason or other report fields.
        for (var destination : List.of(lobbyB, otherLobby, levelB, courtyard)) {
            mvc.perform(relocate(estate, report, current, destination))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(report.toString()))
                    .andExpect(jsonPath("$.location.id").value(destination.toString()))
                    .andExpect(jsonPath("$.title").value("Leaking pipe"))
                    .andExpect(jsonPath("$.status").value("SUBMITTED"))
                    .andExpect(jsonPath("$.images[0].id").value(image.toString()));
            var corrected = reportRow(report);
            assertEquals(destination, corrected.get("locationId"));
            assertNotEquals(original.get("updatedAt"), corrected.get("updatedAt"));
            var unchanged = new HashMap<>(original);
            unchanged.remove("locationId");
            unchanged.remove("updatedAt");
            corrected.remove("locationId");
            corrected.remove("updatedAt");
            assertEquals(unchanged, corrected);
            assertEquals(originalImages, imageRows(report));
            current = destination;
        }
        verifyNoInteractions(imageStore);
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='resident-a'", estate);
        mvc.perform(get("/resident/reports/" + report).with(identity("resident-a")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.id").value(courtyard.toString()))
                .andExpect(jsonPath("$.location.label").value("Block B › Courtyard"));
        mvc.perform(get("/resident/reports").with(identity("resident-a")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].location.id").value(courtyard.toString()));
        mvc.perform(asStaff(get(reports(estate)).param("locationId", blockA.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(asStaff(get(reports(estate)).param("locationId", blockB.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(report.toString()));
        when(imageStore.read("private/" + image)).thenReturn(new byte[] {1, 2, 3});
        mvc.perform(get("/resident/reports/" + report + "/images/" + image).with(identity("resident-a")))
                .andExpect(status().isOk())
                .andExpect(content().bytes(new byte[] {1, 2, 3}));
    }

    @Test
    void relocatingAnOlderReportDoesNotPromoteItAboveNewerReports() throws Exception {
        var estate = estate();
        member(estate, "staff", "CREW");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var lobby = location(estate, "COMMON_AREA", level, "Lift lobby");
        var older = report(estate, level, "resident-a");
        var newer = report(estate, level, "resident-b");
        db.execute("update \"IssueReport\" set \"createdAt\"='2026-01-02T00:00:00Z' where id=?", newer);
        mvc.perform(relocate(estate, older, level, lobby)).andExpect(status().isOk());
        mvc.perform(asStaff(get(reports(estate))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(newer.toString()))
                .andExpect(jsonPath("$.items[1].id").value(older.toString()));
    }

    @Test
    void staleEditorsCannotOverwriteACorrectionAndCanRetryAfterRefetching() throws Exception {
        var estate = estate();
        member(estate, "staff", "CREW");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var first = location(estate, "COMMON_AREA", level, "Lift lobby");
        var second = location(estate, "COMMON_AREA", level, "Stair lobby");
        var report = report(estate, level, "resident-a");
        mvc.perform(relocate(estate, report, level, first)).andExpect(status().isOk());
        var corrected = reportRow(report);
        mvc.perform(relocate(estate, report, level, second)).andExpect(status().isConflict());
        // Even saving the current destination with a stale expectation must conflict.
        mvc.perform(relocate(estate, report, level, first)).andExpect(status().isConflict());
        assertEquals(corrected, reportRow(report));
        mvc.perform(asStaff(get(detail(estate, report))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.id").value(first.toString()));
        mvc.perform(relocate(estate, report, first, second))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.id").value(second.toString()));
    }

    @Test
    void savingTheCurrentLocationIsANoOpIncludingTheUpdatedTimestamp() throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var report = report(estate, level, "resident-a");
        var before = reportRow(report);
        mvc.perform(relocate(estate, report, level, level))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.id").value(level.toString()));
        assertEquals(before, reportRow(report));
        verifyNoInteractions(imageStore);
    }

    @Test
    void blockOnlyAndMissingDestinationsNeverModifyTheReport() throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var report = report(estate, level, "resident-a");
        var before = reportRow(report);
        mvc.perform(relocate(estate, report, level, block)).andExpect(status().isBadRequest());
        mvc.perform(relocate(estate, report, level, UUID.randomUUID())).andExpect(status().isNotFound());
        assertEquals(before, reportRow(report));
    }

    @ParameterizedTest
    @ValueSource(strings = {"destination", "parent", "grandparent", "estate"})
    void inactiveDestinationsAncestorsOrEstatesRejectCorrectionsWithoutChangingTheReport(String inactive)
            throws Exception {
        var estate = estate();
        member(estate, "staff", "CREW");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var lobby = location(estate, "COMMON_AREA", level, "Lift lobby");
        var report = report(estate, level, "resident-a");
        var before = reportRow(report);
        if (inactive.equals("estate")) {
            db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estate);
        } else {
            var id =
                    switch (inactive) {
                        case "destination" -> lobby;
                        case "parent" -> level;
                        default -> block;
                    };
            db.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", id);
        }
        mvc.perform(relocate(estate, report, level, lobby)).andExpect(status().isConflict());
        assertEquals(before, reportRow(report));
        verifyNoInteractions(imageStore);
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{}",
                "{\"locationId\":null,\"expectedLocationId\":null}",
                "{\"locationId\":\"bad\",\"expectedLocationId\":\"bad\"}",
                "{\"locationId\":\"00000000-0000-0000-0000-000000000001\"}",
                "{\"expectedLocationId\":\"00000000-0000-0000-0000-000000000001\"}"
            })
    void bothLocationIdsAreRequiredValidUuids(String body) throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var report = report(estate, level, "resident-a");
        var before = reportRow(report);
        mvc.perform(asStaff(patch(detail(estate, report) + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)))
                .andExpect(status().isBadRequest());
        assertEquals(before, reportRow(report));
    }

    @Test
    void extraRequestFieldsCannotChangeReportInformationOrTransferEstates() throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var lobby = location(estate, "COMMON_AREA", level, "Lift lobby");
        var report = report(estate, level, "resident-a");
        var before = reportRow(report);
        var payload = """
                {"locationId":"%s","expectedLocationId":"%s","estateId":"%s",
                 "submittedByUserId":"attacker","title":"Changed","description":"Changed",
                 "status":"RESOLVED","images":[],"createdAt":"2030-01-01T00:00:00Z"}
                """.formatted(lobby, level, UUID.randomUUID());
        // Unknown fields may be rejected or ignored, but must never mutate other data.
        var result = mvc.perform(asStaff(patch(detail(estate, report) + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)))
                .andReturn();
        var responseStatus = result.getResponse().getStatus();
        assertTrue(responseStatus == 200 || responseStatus == 400);
        var after = reportRow(report);
        if (responseStatus == 400) {
            assertEquals(before, after);
        } else {
            assertEquals(lobby, after.remove("locationId"));
            before.remove("locationId");
            before.remove("updatedAt");
            after.remove("updatedAt");
            assertEquals(before, after);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void inactiveEstateAndLocationHistoryRemainsReadableIncludingPrivateImages(String role) throws Exception {
        var estate = estate();
        member(estate, "staff", role);
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var report = report(estate, level, "former-resident");
        var image = image(report);
        db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estate);
        db.execute("update \"Location\" set \"deactivatedAt\"=now() where \"estateId\"=?", estate);
        when(imageStore.read("private/" + image)).thenReturn(new byte[] {1, 2, 3});

        mvc.perform(asStaff(get(reports(estate)).param("locationId", block.toString())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(report.toString()))
                .andExpect(jsonPath("$.items[0].location.label").value("Block A › Level 4"));
        mvc.perform(asStaff(get(detail(estate, report))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.id").value(level.toString()));
        mvc.perform(asStaff(get(detail(estate, report) + "/images/" + image)))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(content().bytes(new byte[] {1, 2, 3}));
        mvc.perform(asStaff(get("/estates/" + estate + "/locations").param("includeInactive", "true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].id", containsInAnyOrder(block.toString(), level.toString())));
        mvc.perform(relocate(estate, report, level, level)).andExpect(status().isConflict());
    }

    @Test
    void anInactiveCurrentPlacementCanBeCorrectedToAnActiveDestination() throws Exception {
        var estate = estate();
        member(estate, "staff", "CREW");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var oldLobby = location(estate, "COMMON_AREA", level, "Old lobby");
        var report = report(estate, oldLobby, "resident-a");
        db.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", oldLobby);
        mvc.perform(relocate(estate, report, oldLobby, level))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.id").value(level.toString()));
    }

    @Test
    void privateImageReadsRequireTheExactReportImageRelationshipAndHideStorageFailures() throws Exception {
        var estate = estate();
        member(estate, "staff", "MANAGER");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var report = report(estate, level, "resident-a");
        var otherReport = report(estate, level, "resident-b");
        var image = image(report);
        mvc.perform(asStaff(get(detail(estate, otherReport) + "/images/" + image)))
                .andExpect(status().isNotFound());
        mvc.perform(asStaff(get(detail(estate, report) + "/images/" + UUID.randomUUID())))
                .andExpect(status().isNotFound());
        verifyNoInteractions(imageStore);
        var bytes = new byte[] {1, 2, 3};
        when(imageStore.read("private/" + image)).thenReturn(bytes);
        var response = mvc.perform(asStaff(get(detail(estate, report) + "/images/" + image)))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andReturn();
        assertArrayEquals(bytes, response.getResponse().getContentAsByteArray());
        when(imageStore.read("private/" + image))
                .thenThrow(new ResidentReportException(
                        HttpStatus.SERVICE_UNAVAILABLE, "Image storage is temporarily unavailable."));
        mvc.perform(asStaff(get(detail(estate, report) + "/images/" + image)))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Image storage is temporarily unavailable."));
    }

    @Test
    void removingMembershipRevokesReadsImagesAndCorrectionsOnTheNextRequestWithTheSameToken() throws Exception {
        var estate = estate();
        member(estate, "staff", "CREW");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var report = report(estate, level, "resident-a");
        var image = image(report);
        var token = identity("staff");
        mvc.perform(get(detail(estate, report)).with(token)).andExpect(status().isOk());
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='staff'", estate);
        var before = reportRow(report);
        mvc.perform(get(reports(estate)).with(token)).andExpect(status().isNotFound());
        mvc.perform(get(detail(estate, report)).with(token)).andExpect(status().isNotFound());
        mvc.perform(get(detail(estate, report) + "/images/" + image).with(token))
                .andExpect(status().isNotFound());
        mvc.perform(patch(detail(estate, report) + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(level, level))
                        .with(token))
                .andExpect(status().isNotFound());
        assertEquals(before, reportRow(report));
        verifyNoInteractions(imageStore);
    }

    @Test
    void crewReportAccessDoesNotGrantEstateLocationAssetOrDeviceWrites() throws Exception {
        var estate = estate();
        member(estate, "staff", "CREW");
        var block = location(estate, "BLOCK", null, "Block A");
        var level = location(estate, "LEVEL", block, "Level 4");
        var asset = UUID.randomUUID();
        db.execute("""
                insert into "Asset" (id, "estateId", "locationId", reference, name, category, "updatedAt")
                values (?, ?, ?, ?, 'Private pump', 'PUMP', now())
                """, asset, estate, level, asset.toString());
        report(estate, level, "resident-a");
        mvc.perform(asStaff(get(reports(estate)))).andExpect(status().isOk());
        mvc.perform(
                        asStaff(
                                patch("/estates/" + estate)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"name\":\"Changed\",\"code\":\"CHANGED\",\"address\":\"Road\",\"postalCode\":\"123456\"}")))
                .andExpect(status().isNotFound());
        mvc.perform(asStaff(patch("/estates/" + estate + "/locations/" + level)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Changed\",\"parentId\":\"" + block + "\",\"sortOrder\":1}")))
                .andExpect(status().isNotFound());
        mvc.perform(asStaff(get("/estates/" + estate + "/assets"))).andExpect(status().isNotFound());
        mvc.perform(asStaff(post("/estates/" + estate + "/assets")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Pump\",\"category\":\"PUMP\",\"locationId\":\"" + level + "\"}")))
                .andExpect(status().isNotFound());
        mvc.perform(asStaff(post("/estates/" + estate + "/assets/" + asset + "/devices")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"identifier":"sensor-1","model":"Sensor","locationId":"%s",
                                 "metrics":["TEMPERATURE"],"reportingIntervalSeconds":60}
                                """.formatted(level))))
                .andExpect(status().isNotFound());
        assertEquals("Level 4", db.fetchValue("select name from \"Location\" where id=?", level));
        assertEquals(
                0L,
                db.fetchOne("select count(*) from \"Device\" where \"assetId\"=?", asset)
                        .get(0, Long.class));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void simultaneousEditorsCannotBothReplaceTheSameObservedLocation() throws Exception {
        var estate = estate();
        try {
            member(estate, "staff", "CREW");
            var block = location(estate, "BLOCK", null, "Block A");
            var level = location(estate, "LEVEL", block, "Level 4");
            var first = location(estate, "COMMON_AREA", level, "Lift lobby");
            var second = location(estate, "COMMON_AREA", level, "Stair lobby");
            var report = report(estate, level, "resident-a");
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            try (var requests = Executors.newVirtualThreadPerTaskExecutor()) {
                var results = List.of(first, second).stream()
                        .map(destination -> requests.submit(() -> {
                            ready.countDown();
                            if (!start.await(5, TimeUnit.SECONDS))
                                throw new IllegalStateException("Editors did not start");
                            return mvc.perform(relocate(estate, report, level, destination))
                                    .andReturn()
                                    .getResponse()
                                    .getStatus();
                        }))
                        .toList();
                try {
                    assertTrue(ready.await(5, TimeUnit.SECONDS), "Both editors must be ready before starting");
                } finally {
                    start.countDown();
                }
                var statuses = List.of(
                        results.get(0).get(10, TimeUnit.SECONDS), results.get(1).get(10, TimeUnit.SECONDS));
                assertEquals(List.of(200, 409), statuses.stream().sorted().toList());
                assertEquals(
                        statuses.get(0) == 200 ? first : second,
                        reportRow(report).get("locationId"));
            }
        } finally {
            cleanupCommittedEstate(estate);
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"estate", "destination", "ancestor", "membership", "reparent"})
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void queuedCorrectionsRecheckChangesCommittedByTheTransactionHoldingTheEstateLock(String change) throws Exception {
        var estate = estate();
        try {
            member(estate, "staff", "CREW");
            var block = location(estate, "BLOCK", null, "Block A");
            var level = location(estate, "LEVEL", block, "Level 4");
            var inactiveLevel = location(estate, "LEVEL", block, "Closed level");
            db.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", inactiveLevel);
            var destination = location(estate, "COMMON_AREA", level, "Lift lobby");
            var report = report(estate, level, "resident-a");
            var before = reportRow(report);
            try (var requests = Executors.newVirtualThreadPerTaskExecutor()) {
                var pending = db.transactionResult(configuration -> {
                    var locked = DSL.using(configuration);
                    locked.fetch("select id from \"Estate\" where id=? for update", estate);
                    var blocker = locked.fetchValue("select pg_backend_pid()", Integer.class);
                    var correction = requests.submit(() -> mvc.perform(relocate(estate, report, level, destination))
                            .andReturn()
                            .getResponse()
                            .getStatus());
                    var deadline = Instant.now().plusSeconds(5);
                    var blocked = false;
                    // Observe PostgreSQL's lock wait rather than guessing when the request starts.
                    while (!correction.isDone() && Instant.now().isBefore(deadline)) {
                        blocked = Boolean.TRUE.equals(locked.fetchOne(
                                        "select exists(select 1 from pg_stat_activity where ? = any(pg_blocking_pids(pid)))",
                                        blocker)
                                .get(0, Boolean.class));
                        if (blocked) break;
                    }
                    assertTrue(blocked, "Correction must wait for the in-progress estate/hierarchy mutation");
                    switch (change) {
                        case "estate" ->
                            locked.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", estate);
                        case "destination" ->
                            locked.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", destination);
                        case "ancestor" ->
                            locked.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", block);
                        case "membership" ->
                            locked.execute(
                                    "delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='staff'", estate);
                        case "reparent" ->
                            locked.execute(
                                    "update \"Location\" set \"parentId\"=? where id=?", inactiveLevel, destination);
                        default -> throw new IllegalArgumentException("Unknown concurrent change: " + change);
                    }
                    return correction;
                });
                assertEquals(change.equals("membership") ? 404 : 409, pending.get(10, TimeUnit.SECONDS));
                assertEquals(before, reportRow(report));
                verifyNoInteractions(imageStore);
            }
        } finally {
            cleanupCommittedEstate(estate);
        }
    }

    private void cleanupCommittedEstate(UUID estate) {
        // Concurrent requests require committed fixtures, so rollback cannot clean these tests up.
        db.execute("delete from \"IssueReport\" where \"estateId\"=?", estate);
        db.execute("delete from \"Location\" where \"estateId\"=? and type='COMMON_AREA'", estate);
        db.execute("delete from \"Location\" where \"estateId\"=? and type='LEVEL'", estate);
        db.execute("delete from \"Location\" where \"estateId\"=? and type='BLOCK'", estate);
        db.execute("delete from \"EstateUser\" where \"estateId\"=?", estate);
        db.execute("delete from \"Estate\" where id=?", estate);
    }

    private UUID estate() {
        var id = UUID.randomUUID();
        db.execute("""
                insert into "Estate" (id, "ownerUserId", name, code, address, "postalCode", "updatedAt")
                values (?, 'estate-owner', 'Maple Estate', ?, 'Road', '123456', now())
                """, id, id.toString());
        member(id, "estate-owner", "MANAGER");
        return id;
    }

    private void member(UUID estate, String user, String role) {
        db.execute("insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estate, user, role);
    }

    private UUID location(UUID estate, String type, UUID parent, String name) {
        var id = UUID.randomUUID();
        var parentType = parent == null ? null : db.fetchValue("select type from \"Location\" where id=?", parent);
        var position = type.equals("LEVEL")
                ? db.fetchOne("select count(*)+1 from \"Location\" where \"parentId\"=? and type='LEVEL'", parent)
                        .get(0, Integer.class)
                : null;
        db.execute("""
                insert into "Location" (id, "estateId", type, "parentId", "parentType", name, "sortOrder", "updatedAt")
                values (?, ?, ?, ?, ?, ?, ?, now())
                """, id, estate, type, parent, parentType, name, position);
        return id;
    }

    private UUID report(UUID estate, UUID location, String submitter) {
        var id = UUID.randomUUID();
        insertReport(id, estate, location, submitter);
        return id;
    }

    private void insertReport(UUID id, UUID estate, UUID location, String submitter) {
        var timestamp = OffsetDateTime.parse("2026-01-01T00:00:00Z");
        db.execute("""
                insert into "IssueReport" (id, "estateId", "locationId", "submittedByUserId", title, description,
                    status, "createdAt", "updatedAt")
                values (?, ?, ?, ?, 'Leaking pipe', 'Water pooling near the lift', 'SUBMITTED', ?::timestamptz, ?::timestamptz)
                """, id, estate, location, submitter, timestamp, timestamp);
    }

    private UUID image(UUID report) {
        var id = UUID.randomUUID();
        db.execute("""
                insert into "IssueReportImage" (id, "reportId", "storageKey", "contentType", "sizeBytes")
                values (?, ?, ?, 'image/png', 3)
                """, id, report, "private/" + id);
        return id;
    }

    private Map<String, Object> reportRow(UUID id) {
        var row = db.fetchOne("select * from \"IssueReport\" where id=?", id);
        assertNotNull(row);
        return row.intoMap();
    }

    private List<Map<String, Object>> imageRows(UUID report) {
        return db.fetch("select * from \"IssueReportImage\" where \"reportId\"=? order by id", report)
                .intoMaps();
    }

    private static String reports(UUID estate) {
        return "/estates/" + estate + "/reports";
    }

    private static String detail(UUID estate, UUID report) {
        return reports(estate) + "/" + report;
    }

    private static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors
                    .JwtRequestPostProcessor
            identity(String user) {
        return jwt().jwt(token -> token.subject(user).claim("role", "user"))
                .authorities(new SimpleGrantedAuthority("ROLE_user"));
    }

    private static MockHttpServletRequestBuilder asStaff(MockHttpServletRequestBuilder request) {
        return request.with(identity("staff"));
    }

    private static String body(UUID expected, UUID destination) {
        return "{\"locationId\":\"" + destination + "\",\"expectedLocationId\":\"" + expected + "\"}";
    }

    private static MockHttpServletRequestBuilder relocate(UUID estate, UUID report, UUID expected, UUID destination) {
        return asStaff(patch(detail(estate, report) + "/location")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(expected, destination)));
    }
}
