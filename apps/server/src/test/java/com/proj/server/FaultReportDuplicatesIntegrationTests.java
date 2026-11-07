package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.proj.server.resident.ResidentImageStore;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/** HTTP acceptance contract for fault-report-duplicates.md (ID-74). */
@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class FaultReportDuplicatesIntegrationTests {
    private static final OffsetDateTime OLD = OffsetDateTime.parse("2025-01-01T00:00:00Z");

    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    ResidentImageStore imageStore;

    // ---- Detection on submission -------------------------------------------------------------

    @Test
    void similarReportAtTheSameLocationIsSavedAsASuspectedDuplicate() throws Exception {
        var f = fixture();
        var original = report(f.estate, f.level, "Leaking pipe", "Water pooling near the lift", OLD);

        var created = submit(f, f.level, "Leaking pipe", "Water near the lift");

        var link = link(created);
        assertNotNull(link);
        assertEquals(original, link.get("originalReportId", UUID.class));
        assertEquals(f.estate, link.get("estateId", UUID.class));
        assertEquals("SUSPECTED", link.get("state", String.class));
        assertEquals("DETECTED", link.get("source", String.class));
        assertEquals("EXACT", link.get("locationMatch", String.class));
        assertEquals(new BigDecimal("0.800"), link.get("textSimilarity", BigDecimal.class));
        assertEquals(false, link.get("repeatCue", Boolean.class));
        assertNull(link.get("decidedByUserId"));
        assertNull(link.get("decidedAt"));
    }

    @Test
    void residentSubmissionResponseCarriesNoDuplicateInformation() throws Exception {
        var f = fixture();
        report(f.estate, f.level, "Leaking pipe", "Water pooling", OLD);

        mvc.perform(submission(f, f.level, "Leaking pipe", "Water pooling again"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.duplicateOf").doesNotExist())
                .andExpect(jsonPath("$.confirmedDuplicateCount").doesNotExist())
                .andExpect(jsonPath("$.suspectedDuplicateCount").doesNotExist())
                .andExpect(jsonPath("$.duplicates").doesNotExist());
    }

    @Test
    void firstReportOfAFaultHasNoLink() throws Exception {
        var f = fixture();

        assertNull(link(submit(f, f.level, "Leaking pipe", "Water pooling")));
    }

    @Test
    void dissimilarReportAtTheSameLocationWithoutACueIsNotLinked() throws Exception {
        var f = fixture();
        report(f.estate, f.level, "Broken light", "Bulb out in corridor", OLD);

        assertNull(link(submit(f, f.level, "Leaking pipe", "Water pooling")));
    }

    @Test
    void repeatCueLinksAReportWithNoSharedWords() throws Exception {
        var f = fixture();
        var original = report(f.estate, f.level, "Broken light", "Bulb out in corridor", OLD);

        var link = link(submit(f, f.level, "Happening again", "Please send someone"));

        assertEquals(original, link.get("originalReportId", UUID.class));
        assertEquals(true, link.get("repeatCue", Boolean.class));
        assertEquals(new BigDecimal("0.000"), link.get("textSimilarity", BigDecimal.class));
    }

    @Test
    void levelAndItsCommonAreasAreNearby() throws Exception {
        var f = fixture();
        var lobby = location(f.estate, "COMMON_AREA", f.level, "Lift lobby");
        var bin = location(f.estate, "COMMON_AREA", f.level, "Bin point");
        var onLevel = report(f.estate, f.level, "Leaking pipe", "Water pooling", OLD);

        var fromLobby = link(submit(f, lobby, "Leaking pipe", "Water pooling"));
        assertEquals(onLevel, fromLobby.get("originalReportId", UUID.class));
        assertEquals("NEARBY", fromLobby.get("locationMatch", String.class));

        db.execute("delete from \"IssueReportDuplicate\"");
        db.execute("delete from \"IssueReport\" where id=?", onLevel);
        var inLobby = report(f.estate, lobby, "Leaking pipe", "Water pooling", OLD);
        var fromSibling = link(submit(f, bin, "Leaking pipe", "Water pooling"));
        assertEquals(inLobby, fromSibling.get("originalReportId", UUID.class));
        assertEquals("NEARBY", fromSibling.get("locationMatch", String.class));
    }

    @Test
    void blockCommonAreasAreNearbyEachOtherButNotTheLevels() throws Exception {
        var f = fixture();
        var carPark = location(f.estate, "COMMON_AREA", f.block, "Car park");
        var lobby = location(f.estate, "COMMON_AREA", f.block, "Ground lobby");
        var original = report(f.estate, carPark, "Leaking pipe", "Water pooling", OLD);

        var link = link(submit(f, lobby, "Leaking pipe", "Water pooling"));
        assertEquals(original, link.get("originalReportId", UUID.class));
        assertEquals("NEARBY", link.get("locationMatch", String.class));

        assertNull(link(submit(f, f.level, "Leaking pipe", "Water pooling")));
    }

    @Test
    void otherLevelsBlocksAndEstatesAreNotCandidates() throws Exception {
        var f = fixture();
        var otherLevel = location(f.estate, "LEVEL", f.block, "Level 5");
        var otherBlock = location(f.estate, "BLOCK", null, "Block B");
        var otherBlockLevel = location(f.estate, "LEVEL", otherBlock, "Level 4");
        report(f.estate, otherLevel, "Leaking pipe", "Water pooling", OLD);
        report(f.estate, otherBlockLevel, "Leaking pipe", "Water pooling", OLD);
        var foreign = fixture();
        report(foreign.estate, foreign.level, "Leaking pipe", "Water pooling", OLD);

        assertNull(link(submit(f, f.level, "Leaking pipe", "Water pooling again")));
    }

    @Test
    void reportsWhoseWorkOrdersAreAllClosedAreNotCandidates() throws Exception {
        var f = fixture();
        var closed = report(f.estate, f.level, "Leaking pipe", "Water pooling", OLD);
        workOrder(f, closed, "CLOSED");
        workOrder(f, closed, "CLOSED");

        assertNull(link(submit(f, f.level, "Leaking pipe", "Water pooling")));
    }

    @Test
    void reportWithAnyUnclosedWorkOrderIsStillOpen() throws Exception {
        var f = fixture();
        var open = report(f.estate, f.level, "Leaking pipe", "Water pooling", OLD);
        workOrder(f, open, "CLOSED");
        workOrder(f, open, "IN_PROGRESS");

        assertEquals(
                open, link(submit(f, f.level, "Leaking pipe", "Water pooling")).get("originalReportId"));
    }

    @Test
    void linkedReportsAreSkippedSoLinksAlwaysPointAtTheOriginal() throws Exception {
        var f = fixture();
        var original = report(f.estate, f.level, "Leaking pipe", "Water pooling near lift", OLD);
        var suspected = report(f.estate, f.level, "Leaking pipe", "Water pooling", OLD.plusDays(1));
        var confirmed = report(f.estate, f.level, "Leaking pipe", "Water pooling", OLD.plusDays(2));
        insertLink(suspected, f.estate, original, "SUSPECTED");
        insertLink(confirmed, f.estate, original, "CONFIRMED");

        assertEquals(
                original,
                link(submit(f, f.level, "Leaking pipe", "Water pooling")).get("originalReportId"));
    }

    @Test
    void reportWithARejectedLinkCanBeAnOriginal() throws Exception {
        var f = fixture();
        var other = report(f.estate, f.level, "Broken light", "Bulb out", OLD);
        var rejected = report(f.estate, f.level, "Leaking pipe", "Water pooling", OLD.plusDays(1));
        insertLink(rejected, f.estate, other, "REJECTED");

        assertEquals(
                rejected,
                link(submit(f, f.level, "Leaking pipe", "Water pooling")).get("originalReportId"));
    }

    @Test
    void reportsAtDeactivatedNearbyLocationsAreStillCandidates() throws Exception {
        var f = fixture();
        var closedArea = location(f.estate, "COMMON_AREA", f.level, "Old store");
        var original = report(f.estate, closedArea, "Leaking pipe", "Water pooling", OLD);
        db.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", closedArea);

        assertEquals(
                original,
                link(submit(f, f.level, "Leaking pipe", "Water pooling")).get("originalReportId"));
    }

    // ---- Visibility ------------------------------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {"MANAGER", "CREW"})
    void estateListShowsCountsOnOriginalsAndTheLinkOnDuplicates(String role) throws Exception {
        var f = fixture();
        member(f.estate, "staff", role);
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var confirmedA = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        var confirmedB = report(f.estate, f.level, "Leak", "b", OLD.plusDays(2));
        var suspected = report(f.estate, f.level, "Leak", "c", OLD.plusDays(3));
        var rejected = report(f.estate, f.level, "Leak", "d", OLD.plusDays(4));
        insertLink(confirmedA, f.estate, original, "CONFIRMED");
        insertLink(confirmedB, f.estate, original, "CONFIRMED");
        insertLink(suspected, f.estate, original, "SUSPECTED");
        insertLink(rejected, f.estate, original, "REJECTED");

        mvc.perform(asStaff(get(reports(f.estate))))
                .andExpect(status().isOk())
                .andExpect(jsonPath(item(original) + ".confirmedDuplicateCount").value(2))
                .andExpect(jsonPath(item(original) + ".suspectedDuplicateCount").value(1))
                .andExpect(
                        jsonPath(item(original) + ".duplicateOf").value(org.hamcrest.Matchers.contains((Object) null)))
                .andExpect(jsonPath(item(suspected) + ".duplicateOf.reportId").value(original.toString()))
                .andExpect(jsonPath(item(suspected) + ".duplicateOf.title").value("Leaking pipe"))
                .andExpect(jsonPath(item(suspected) + ".duplicateOf.state").value("SUSPECTED"))
                .andExpect(jsonPath(item(confirmedA) + ".duplicateOf.state").value("CONFIRMED"))
                .andExpect(
                        jsonPath(item(confirmedA) + ".confirmedDuplicateCount").value(0))
                .andExpect(
                        jsonPath(item(rejected) + ".duplicateOf").value(org.hamcrest.Matchers.contains((Object) null)));
    }

    @Test
    void estateDetailOfAnOriginalListsItsActiveDuplicatesNewestFirst() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "CREW");
        var lobby = location(f.estate, "COMMON_AREA", f.level, "Lift lobby");
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var older = report(f.estate, lobby, "Leak in lobby", "a", OLD.plusDays(1));
        var newer = report(f.estate, f.level, "Leak again", "b", OLD.plusDays(2));
        var rejected = report(f.estate, f.level, "Leak", "c", OLD.plusDays(3));
        insertLink(older, f.estate, original, "CONFIRMED");
        insertLink(newer, f.estate, original, "SUSPECTED");
        insertLink(rejected, f.estate, original, "REJECTED");

        mvc.perform(asStaff(get(detail(f.estate, original))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confirmedDuplicateCount").value(1))
                .andExpect(jsonPath("$.suspectedDuplicateCount").value(1))
                .andExpect(jsonPath("$.duplicateOf").isEmpty())
                .andExpect(jsonPath("$.duplicates.length()").value(2))
                .andExpect(jsonPath("$.duplicates[0].reportId").value(newer.toString()))
                .andExpect(jsonPath("$.duplicates[0].title").value("Leak again"))
                .andExpect(jsonPath("$.duplicates[0].state").value("SUSPECTED"))
                .andExpect(jsonPath("$.duplicates[0].createdAt").exists())
                .andExpect(jsonPath("$.duplicates[1].reportId").value(older.toString()))
                .andExpect(jsonPath("$.duplicates[1].state").value("CONFIRMED"))
                .andExpect(jsonPath("$.duplicates[1].location.id").value(lobby.toString()))
                .andExpect(jsonPath("$.duplicates[1].location.label").value("Block A › Level 4 › Lift lobby"));
    }

    @Test
    void estateDetailOfADuplicateNamesItsOriginal() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(duplicate, f.estate, original, "CONFIRMED");

        mvc.perform(asStaff(get(detail(f.estate, duplicate))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicateOf.reportId").value(original.toString()))
                .andExpect(jsonPath("$.duplicateOf.title").value("Leaking pipe"))
                .andExpect(jsonPath("$.duplicateOf.state").value("CONFIRMED"))
                .andExpect(jsonPath("$.duplicates.length()").value(0))
                .andExpect(jsonPath("$.confirmedDuplicateCount").value(0));
    }

    @Test
    void residentHistoryAndDetailCarryNoDuplicateInformation() throws Exception {
        var f = fixture();
        report(f.estate, f.level, "Leaking pipe", "Water pooling", OLD);
        // The resident's report is both a suspected duplicate and an original with a confirmed duplicate.
        var created = submit(f, f.level, "Leaking pipe", "Water pooling");
        insertLink(UUID.randomUUID(), f.estate, created, "CONFIRMED", f.level);
        assertNotNull(link(created));

        for (var path : java.util.List.of("/resident/reports", "/resident/reports/" + created)) {
            var body = mvc.perform(get(path).with(identity("resident")))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            for (var field : java.util.List.of("duplicate", "Duplicate")) {
                org.junit.jupiter.api.Assertions.assertFalse(body.contains(field), path + " exposed " + field);
            }
        }
    }

    // ---- Reviewing links -------------------------------------------------------------------

    @ParameterizedTest
    @CsvSource({"SUSPECTED,CONFIRMED", "SUSPECTED,REJECTED", "CONFIRMED,REJECTED"})
    void managersMoveLinksAlongTheAllowedTransitions(String from, String to) throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(duplicate, f.estate, original, from);
        var reportBefore = row("IssueReport", "id", duplicate);
        var originalBefore = row("IssueReport", "id", original);

        mvc.perform(review(f.estate, duplicate, to, from))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(duplicate.toString()))
                .andExpect(
                        to.equals("REJECTED")
                                ? jsonPath("$.duplicateOf").isEmpty()
                                : jsonPath("$.duplicateOf.state").value(to));

        var link = link(duplicate);
        assertEquals(to, link.get("state", String.class));
        assertEquals("staff", link.get("decidedByUserId", String.class));
        assertNotNull(link.get("decidedAt"));
        assertEquals(original, link.get("originalReportId", UUID.class));
        assertEquals(reportBefore, row("IssueReport", "id", duplicate));
        assertEquals(originalBefore, row("IssueReport", "id", original));
    }

    @Test
    void reviewDoesNotChangeWorkOrders() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        workOrder(f, original, "OPEN");
        workOrder(f, duplicate, "OPEN");
        insertLink(duplicate, f.estate, original, "SUSPECTED");
        var before = db.fetch("select * from \"WorkOrder\" where \"estateId\"=? order by id", f.estate)
                .intoMaps();

        mvc.perform(review(f.estate, duplicate, "CONFIRMED", "SUSPECTED")).andExpect(status().isOk());

        assertEquals(
                before,
                db.fetch("select * from \"WorkOrder\" where \"estateId\"=? order by id", f.estate)
                        .intoMaps());
    }

    @ParameterizedTest
    @CsvSource({
        "SUSPECTED,SUSPECTED",
        "CONFIRMED,CONFIRMED",
        "SUSPECTED,CONFIRMED",
        "CONFIRMED,REJECTED",
        "SUSPECTED,REJECTED"
    })
    void disallowedTransitionsAreBadRequests(String to, String expected) throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(duplicate, f.estate, original, expected.equals("REJECTED") ? "SUSPECTED" : expected);

        mvc.perform(review(f.estate, duplicate, to, expected)).andExpect(status().isBadRequest());
    }

    @Test
    void reviewWithAStaleExpectedStateConflictsAndChangesNothing() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(duplicate, f.estate, original, "CONFIRMED");
        var before = link(duplicate).intoMap();

        mvc.perform(review(f.estate, duplicate, "CONFIRMED", "SUSPECTED")).andExpect(status().isConflict());
        db.execute("update \"IssueReportDuplicate\" set state='REJECTED' where \"reportId\"=?", duplicate);
        mvc.perform(review(f.estate, duplicate, "REJECTED", "CONFIRMED")).andExpect(status().isConflict());

        before.put("state", "REJECTED");
        assertEquals(before, link(duplicate).intoMap());
    }

    @Test
    void reviewingAReportWithoutALinkIsNotFound() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var report = report(f.estate, f.level, "Leaking pipe", "Water", OLD);

        mvc.perform(review(f.estate, report, "CONFIRMED", "SUSPECTED")).andExpect(status().isNotFound());
        mvc.perform(review(f.estate, UUID.randomUUID(), "CONFIRMED", "SUSPECTED"))
                .andExpect(status().isNotFound());
        mvc.perform(review(UUID.randomUUID(), report, "CONFIRMED", "SUSPECTED")).andExpect(status().isNotFound());
    }

    @Test
    void reportsInAnotherEstateAreNotFound() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var other = fixture();
        var original = report(other.estate, other.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(other.estate, other.level, "Leak", "a", OLD.plusDays(1));
        insertLink(duplicate, other.estate, original, "SUSPECTED");

        mvc.perform(review(f.estate, duplicate, "CONFIRMED", "SUSPECTED")).andExpect(status().isNotFound());
        assertEquals("SUSPECTED", link(duplicate).get("state"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREW", "COUNCIL", "RESIDENT", "MEMBER", "CUSTOM"})
    void onlyManagersReviewOrLink(String role) throws Exception {
        var f = fixture();
        if (role.equals("CUSTOM")) customMember(f.estate, "staff");
        else member(f.estate, "staff", role);
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        var unlinked = report(f.estate, f.level, "Leak", "b", OLD.plusDays(2));
        insertLink(duplicate, f.estate, original, "SUSPECTED");

        mvc.perform(review(f.estate, duplicate, "CONFIRMED", "SUSPECTED")).andExpect(status().isForbidden());
        mvc.perform(linkTo(f.estate, unlinked, original)).andExpect(status().isForbidden());
        assertEquals("SUSPECTED", link(duplicate).get("state"));
        assertNull(link(unlinked));
    }

    @Test
    void strangersGetNotFound() throws Exception {
        var f = fixture();
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(duplicate, f.estate, original, "SUSPECTED");

        mvc.perform(review(f.estate, duplicate, "CONFIRMED", "SUSPECTED")).andExpect(status().isNotFound());
    }

    @Test
    void ownersReviewThroughTheirManagerMembership() throws Exception {
        var f = fixture();
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(duplicate, f.estate, original, "SUSPECTED");

        mvc.perform(patch(detail(f.estate, duplicate) + "/duplicate")
                        .with(identity("estate-owner"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"CONFIRMED\",\"expectedState\":\"SUSPECTED\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void inactiveEstatesCannotBeReviewedOrLinked() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        var unlinked = report(f.estate, f.level, "Leak", "b", OLD.plusDays(2));
        insertLink(duplicate, f.estate, original, "SUSPECTED");
        db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", f.estate);

        mvc.perform(review(f.estate, duplicate, "CONFIRMED", "SUSPECTED")).andExpect(status().isConflict());
        mvc.perform(linkTo(f.estate, unlinked, original)).andExpect(status().isConflict());
        mvc.perform(asStaff(get(detail(f.estate, duplicate)))).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"state\":\"CONFIRMED\"}", "{\"state\":\"MAYBE\",\"expectedState\":\"SUSPECTED\"}"})
    void malformedReviewBodiesAreBadRequests(String body) throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(duplicate, f.estate, original, "SUSPECTED");

        mvc.perform(asStaff(patch(detail(f.estate, duplicate) + "/duplicate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectedReportIsNotSuggestedAgainButCanBecomeAnOriginal() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var original = report(f.estate, f.level, "Broken light", "Bulb out", OLD);
        var created = submit(f, f.level, "Leaking pipe", "Happening again");
        assertEquals(original, link(created).get("originalReportId"));

        mvc.perform(review(f.estate, created, "REJECTED", "SUSPECTED")).andExpect(status().isOk());
        var next = submit(f, f.level, "Leaking pipe", "Water pooling");

        assertEquals("REJECTED", link(created).get("state"));
        assertEquals(created, link(next).get("originalReportId"));
    }

    // ---- Manual linking --------------------------------------------------------------------

    @Test
    void managersLinkAnUnlinkedReportByHand() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var otherBlock = location(f.estate, "BLOCK", null, "Block B");
        var farLevel = location(f.estate, "LEVEL", otherBlock, "Level 9");
        var original = report(f.estate, farLevel, "Broken light", "Bulb out", OLD);
        workOrder(f, original, "CLOSED");
        var duplicate = report(f.estate, f.level, "Corridor dark", "No lighting", OLD.plusDays(1));
        var before = row("IssueReport", "id", duplicate);

        mvc.perform(linkTo(f.estate, duplicate, original))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(duplicate.toString()))
                .andExpect(jsonPath("$.duplicateOf.reportId").value(original.toString()))
                .andExpect(jsonPath("$.duplicateOf.state").value("CONFIRMED"));

        var link = link(duplicate);
        assertEquals("CONFIRMED", link.get("state"));
        assertEquals("MANUAL", link.get("source"));
        assertEquals(original, link.get("originalReportId"));
        assertEquals("staff", link.get("decidedByUserId"));
        assertNotNull(link.get("decidedAt"));
        assertNull(link.get("locationMatch"));
        assertNull(link.get("textSimilarity"));
        assertNull(link.get("repeatCue"));
        assertEquals(before, row("IssueReport", "id", duplicate));
    }

    @Test
    void manualLinkReplacesARejectedLink() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var wrong = report(f.estate, f.level, "Broken light", "Bulb out", OLD);
        var right = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(duplicate, f.estate, wrong, "REJECTED");

        mvc.perform(linkTo(f.estate, duplicate, right)).andExpect(status().isOk());

        var link = link(duplicate);
        assertEquals(right, link.get("originalReportId"));
        assertEquals("CONFIRMED", link.get("state"));
        assertEquals("MANUAL", link.get("source"));
        assertNull(link.get("locationMatch"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"SUSPECTED", "CONFIRMED"})
    void manualLinkConflictsWhenTheReportAlreadyHasAnActiveLink(String current) throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var previous = report(f.estate, f.level, "Broken light", "Bulb out", OLD);
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(duplicate, f.estate, previous, current);
        var before = link(duplicate).intoMap();

        mvc.perform(linkTo(f.estate, duplicate, original)).andExpect(status().isConflict());

        assertEquals(before, link(duplicate).intoMap());
    }

    @Test
    void manualLinkToItselfIsABadRequest() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var report = report(f.estate, f.level, "Leaking pipe", "Water", OLD);

        mvc.perform(linkTo(f.estate, report, report)).andExpect(status().isBadRequest());
        assertNull(link(report));
    }

    @ParameterizedTest
    @ValueSource(strings = {"SUSPECTED", "CONFIRMED"})
    void manualLinkToAReportThatIsItselfLinkedIsABadRequest(String state) throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var root = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var linked = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        var duplicate = report(f.estate, f.level, "Leak", "b", OLD.plusDays(2));
        insertLink(linked, f.estate, root, state);

        mvc.perform(linkTo(f.estate, duplicate, linked))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("original")));
        assertNull(link(duplicate));
    }

    @Test
    void manualLinkToAReportWithARejectedLinkIsAllowed() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var other = report(f.estate, f.level, "Broken light", "Bulb out", OLD);
        var formerlyLinked = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "b", OLD.plusDays(2));
        insertLink(formerlyLinked, f.estate, other, "REJECTED");

        mvc.perform(linkTo(f.estate, duplicate, formerlyLinked)).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"SUSPECTED", "CONFIRMED"})
    void manualLinkOfAReportThatHasItsOwnDuplicatesIsABadRequest(String state) throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var target = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var groupOriginal = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        var groupMember = report(f.estate, f.level, "Leak", "b", OLD.plusDays(2));
        insertLink(groupMember, f.estate, groupOriginal, state);

        mvc.perform(linkTo(f.estate, groupOriginal, target)).andExpect(status().isBadRequest());
        assertNull(link(groupOriginal));
    }

    @Test
    void manualLinkOfAReportWhoseDuplicatesWereAllRejectedIsAllowed() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var target = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var former = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(UUID.randomUUID(), f.estate, former, "REJECTED", f.level);

        mvc.perform(linkTo(f.estate, former, target)).andExpect(status().isOk());
    }

    @Test
    void manualLinkToAMissingOrForeignOriginalIsNotFound() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD);
        var other = fixture();
        var foreign = report(other.estate, other.level, "Leaking pipe", "Water", OLD);

        mvc.perform(linkTo(f.estate, duplicate, foreign)).andExpect(status().isNotFound());
        mvc.perform(linkTo(f.estate, duplicate, UUID.randomUUID())).andExpect(status().isNotFound());
        mvc.perform(linkTo(f.estate, UUID.randomUUID(), duplicate)).andExpect(status().isNotFound());
        assertNull(link(duplicate));
    }

    @Test
    void manualLinkWithoutAnOriginalIsABadRequest() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD);

        mvc.perform(asStaff(put(detail(f.estate, duplicate) + "/duplicate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"SUSPECTED", "CONFIRMED"})
    void workOrdersCannotBeCreatedFromALinkedReport(String state) throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        var duplicate = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(duplicate, f.estate, original, state);

        mvc.perform(createWorkOrder(f, duplicate))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("original")));

        assertEquals(0L, db.fetchValue("select count(*) from \"WorkOrder\" where \"sourceReportId\"=?", duplicate));
    }

    @Test
    void workOrdersCanBeCreatedFromAReportWhoseLinkWasRejected() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var other = report(f.estate, f.level, "Broken light", "Bulb out", OLD);
        var report = report(f.estate, f.level, "Leak", "a", OLD.plusDays(1));
        insertLink(report, f.estate, other, "REJECTED");

        mvc.perform(createWorkOrder(f, report)).andExpect(status().isCreated());
    }

    @Test
    void originalsStillGetWorkOrders() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        insertLink(UUID.randomUUID(), f.estate, original, "CONFIRMED", f.level);

        mvc.perform(createWorkOrder(f, original)).andExpect(status().isCreated());
    }

    @ParameterizedTest
    @ValueSource(strings = {"EstateIssueReportSummaryResponse", "EstateIssueReportDetailResponse"})
    void openApiRepresentsDuplicateOfAsANullableObject(String schema) throws Exception {
        var property = "$.components.schemas." + schema + ".properties.duplicateOf";
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(property + ".oneOf[0].$ref").value("#/components/schemas/DuplicateOf"))
                .andExpect(jsonPath(property + ".oneOf[1].type").value("null"));
    }

    // ---- Access context --------------------------------------------------------------------

    @ParameterizedTest
    @CsvSource({"MANAGER,false,true", "MANAGER,true,false", "CREW,false,false", "COUNCIL,false,false"})
    void accessContextExposesTheReviewCapability(String role, boolean inactive, boolean expected) throws Exception {
        var f = fixture();
        member(f.estate, "staff", role);
        if (inactive) db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", f.estate);

        mvc.perform(asStaff(get("/access/context")))
                .andExpect(status().isOk())
                .andExpect(
                        jsonPath("$.estates[0].canReviewFaultReportDuplicates").value(expected));
    }

    // ---- Work orders -----------------------------------------------------------------------

    @Test
    void workOrdersCarryTheirSourceReportsConfirmedDuplicateCount() throws Exception {
        var f = fixture();
        member(f.estate, "staff", "MANAGER");
        var original = report(f.estate, f.level, "Leaking pipe", "Water", OLD);
        insertLink(UUID.randomUUID(), f.estate, original, "CONFIRMED", f.level);
        insertLink(UUID.randomUUID(), f.estate, original, "CONFIRMED", f.level);
        insertLink(UUID.randomUUID(), f.estate, original, "SUSPECTED", f.level);
        insertLink(UUID.randomUUID(), f.estate, original, "REJECTED", f.level);
        var sourced = workOrder(f, original, "OPEN");
        var manual = workOrder(f, null, "OPEN");

        mvc.perform(asStaff(get("/estates/" + f.estate + "/work-orders/" + sourced)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceReportConfirmedDuplicateCount").value(2));
        mvc.perform(asStaff(get("/estates/" + f.estate + "/work-orders")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.id == '" + sourced + "')].sourceReportConfirmedDuplicateCount")
                        .value(2))
                .andExpect(jsonPath("$.items[?(@.id == '" + manual + "')].sourceReportConfirmedDuplicateCount")
                        .value(0));
    }

    // ---- Fixtures --------------------------------------------------------------------------

    private record Fixture(UUID estate, UUID block, UUID level) {}

    private Fixture fixture() {
        var estate = UUID.randomUUID();
        db.execute("""
                insert into "Estate" (id, "ownerUserId", name, code, address, "postalCode", "updatedAt")
                values (?, 'estate-owner', 'Maple Estate', ?, 'Road', '123456', now())
                """, estate, estate.toString().substring(0, 8));
        member(estate, "estate-owner", "MANAGER");
        member(estate, "resident", "RESIDENT");
        var block = location(estate, "BLOCK", null, "Block A");
        return new Fixture(estate, block, location(estate, "LEVEL", block, "Level 4"));
    }

    private void member(UUID estate, String user, String role) {
        db.execute("insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estate, user, role);
    }

    private UUID location(UUID estate, String type, UUID parent, String name) {
        var id = UUID.randomUUID();
        var parentType = parent == null ? null : db.fetchValue("select type from \"Location\" where id=?", parent);
        db.execute("""
                insert into "Location" (id, "estateId", type, "parentId", "parentType", name, "sortOrder", "updatedAt")
                values (?, ?, ?, ?, ?, ?, ?, now())
                """, id, estate, type, parent, parentType, name, type.equals("LEVEL") ? 4 : null);
        return id;
    }

    private UUID report(UUID estate, UUID location, String title, String description, OffsetDateTime createdAt) {
        var id = UUID.randomUUID();
        db.execute("""
                insert into "IssueReport" (id, "estateId", "locationId", "submittedByUserId", title, description,
                    status, "createdAt", "updatedAt")
                values (?, ?, ?, 'someone', ?, ?, 'SUBMITTED', ?::timestamptz, ?::timestamptz)
                """, id, estate, location, title, description, createdAt, createdAt);
        return id;
    }

    private UUID workOrder(Fixture f, UUID report, String status) {
        var id = UUID.randomUUID();
        db.execute(
                """
                insert into "WorkOrder" (id, "estateId", reference, description, "locationId", category, priority,
                    source, "sourceReportId", status, "createdByUserId", "updatedAt")
                values (?, ?, ?, 'Fix it', ?, 'EQUIPMENT_FAULT', 'MEDIUM', ?, ?, ?, 'estate-owner', now())
                """, id, f.estate, "W-" + id, f.level, report == null ? "MANUAL" : "RESIDENT_REPORT", report, status);
        return id;
    }

    private void insertLink(UUID report, UUID estate, UUID original, String state) {
        db.execute("""
                insert into "IssueReportDuplicate" ("reportId", "estateId", "originalReportId", state, source,
                    "locationMatch", "textSimilarity", "repeatCue")
                values (?, ?, ?, ?, 'DETECTED', 'EXACT', 0.5, false)
                """, report, estate, original, state);
    }

    private void insertLink(UUID report, UUID estate, UUID original, String state, UUID location) {
        // Creates the duplicate report itself, then links it, for tests that need an extra row.
        db.execute("""
                insert into "IssueReport" (id, "estateId", "locationId", "submittedByUserId", title, description,
                    status, "createdAt", "updatedAt")
                values (?, ?, ?, 'someone', 'Extra', 'Extra', 'SUBMITTED', now(), now())
                """, report, estate, location);
        insertLink(report, estate, original, state);
    }

    private Map<String, Object> row(String table, String key, UUID id) {
        var found = db.fetchOne("select * from \"" + table + "\" where \"" + key + "\"=?", id);
        assertNotNull(found);
        return found.intoMap();
    }

    private void customMember(UUID estate, String user) {
        var role = UUID.randomUUID();
        db.execute("""
                insert into "EstateRoleDefinition" (id, "estateId", name, "normalizedName", "createdByUserId", "updatedAt")
                values (?, ?, 'Report reader', 'report reader', 'estate-owner', now())
                """, role, estate);
        db.execute("""
                insert into "EstateRolePermission" ("roleId", permission)
                values (?, 'VIEW_FAULT_REPORTS'), (?, 'RELOCATE_FAULT_REPORTS')
                """, role, role);
        db.execute("""
                insert into "EstateUser" ("estateId", "userId", role, "customRoleId") values (?, ?, 'CUSTOM', ?)
                """, estate, user, role);
    }

    private MockHttpServletRequestBuilder review(UUID estate, UUID report, String state, String expected) {
        return asStaff(patch(detail(estate, report) + "/duplicate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"state\":\"" + state + "\",\"expectedState\":\"" + expected + "\"}"));
    }

    private MockHttpServletRequestBuilder linkTo(UUID estate, UUID report, UUID original) {
        return asStaff(put(detail(estate, report) + "/duplicate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"originalReportId\":\"" + original + "\"}"));
    }

    private MockHttpServletRequestBuilder createWorkOrder(Fixture f, UUID report) {
        return asStaff(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                        "/estates/" + f.estate + "/work-orders")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"description":"Fix the leak","locationId":"%s","category":"EQUIPMENT_FAULT",
                         "priority":"HIGH","source":"RESIDENT_REPORT","sourceReportId":"%s",
                         "expectedSourceLocationId":"%s"}
                        """.formatted(f.level, report, f.level)));
    }

    private static String reports(UUID estate) {
        return "/estates/" + estate + "/reports";
    }

    private static String detail(UUID estate, UUID report) {
        return reports(estate) + "/" + report;
    }

    private static String item(UUID report) {
        return "$.items[?(@.id == '" + report + "')]";
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

    private Record link(UUID report) {
        return db.fetchOne("select * from \"IssueReportDuplicate\" where \"reportId\"=?", report);
    }

    private org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder submission(
            Fixture f, UUID location, String title, String description) {
        var request = multipart("/resident/reports");
        request.param("estateId", f.estate.toString());
        request.param("title", title);
        request.param("description", description);
        request.param("locationId", location.toString());
        request.with(jwt().jwt(token -> token.subject("resident").claim("role", "user"))
                .authorities(new SimpleGrantedAuthority("ROLE_user")));
        return request;
    }

    private UUID submit(Fixture f, UUID location, String title, String description) throws Exception {
        var body = mvc.perform(submission(f, location, title, description))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }
}
