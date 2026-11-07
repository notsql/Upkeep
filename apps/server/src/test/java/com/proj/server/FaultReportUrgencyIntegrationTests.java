package com.proj.server;

import static com.proj.server.db.tables.Estate.ESTATE;
import static com.proj.server.db.tables.Estateuser.ESTATEUSER;
import static com.proj.server.db.tables.Issuereport.ISSUEREPORT;
import static com.proj.server.db.tables.Issuereporturgencyevent.ISSUEREPORTURGENCYEVENT;
import static com.proj.server.db.tables.Location.LOCATION;
import static com.proj.server.db.tables.Workorder.WORKORDER;
import static org.hamcrest.Matchers.nullValue;
import static org.jooq.impl.DSL.currentOffsetDateTime;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.proj.server.workos.WorkOSService;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(
        properties = {
            "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app",
            "springdoc.api-docs.enabled=true"
        })
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class FaultReportUrgencyIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    WorkOSService identity;

    @Test
    void reportsDefaultToMediumAndResidentResponsesKeepTheirContract() throws Exception {
        var f = fixture();
        var report = report(f, "2026-01-01T00:00:00Z");
        mvc.perform(staff(get(detail(f, report))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.urgency").value("MEDIUM"))
                .andExpect(jsonPath("$.isSafety").value(false))
                .andExpect(jsonPath("$.urgencyVersion").value(0))
                .andExpect(jsonPath("$.lastUrgencyChange").value(nullValue()));
        mvc.perform(get("/resident/reports/" + report).with(jwt().jwt(token -> token.subject("resident"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.urgency").doesNotExist())
                .andExpect(jsonPath("$.lastUrgencyChange").doesNotExist());
    }

    @Test
    void managerChangesAreRecordedAndOnlyLatestChangeIsReturned() throws Exception {
        var f = fixture();
        var report = report(f, "2026-01-01T00:00:00Z");
        org.mockito.Mockito.when(identity.findDisplayName("manager")).thenReturn(Optional.of("Alex Tan"));
        change(f, report, "HIGH", false, 0)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.urgencyVersion").value(1))
                .andExpect(jsonPath("$.lastUrgencyChange.fromUrgency").value("MEDIUM"))
                .andExpect(jsonPath("$.lastUrgencyChange.toUrgency").value("HIGH"))
                .andExpect(jsonPath("$.lastUrgencyChange.changedByName").value("Alex Tan"))
                .andExpect(jsonPath("$.lastUrgencyChange.changedByUserId").doesNotExist());
        change(f, report, "URGENT", true, 1).andExpect(status().isOk());
        assertEquals(2, events(report));
        mvc.perform(staff(get(detail(f, report))))
                .andExpect(jsonPath("$.lastUrgencyChange.version").value(2))
                .andExpect(jsonPath("$.lastUrgencyChange.toIsSafety").value(true));
    }

    @Test
    void staleVersionsIncludingChangedBackValuesCannotOverwriteChanges() throws Exception {
        var f = fixture();
        var report = report(f, "2026-01-01T00:00:00Z");
        change(f, report, "HIGH", false, 0).andExpect(status().isOk());
        change(f, report, "MEDIUM", false, 1).andExpect(status().isOk());
        change(f, report, "LOW", false, 0).andExpect(status().isConflict());
        change(f, report, "MEDIUM", false, 2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.urgencyVersion").value(2));
        assertEquals(2, events(report));
    }

    @Test
    void safetyRequiresUrgentAndCanBeExplicitlyRemoved() throws Exception {
        var f = fixture();
        var report = report(f, "2026-01-01T00:00:00Z");
        change(f, report, "LOW", true, 0).andExpect(status().isBadRequest());
        assertEquals(0, events(report));
        change(f, report, "URGENT", true, 0).andExpect(status().isOk());
        change(f, report, "HIGH", false, 1)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isSafety").value(false))
                .andExpect(jsonPath("$.lastUrgencyChange.fromIsSafety").value(true));
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREW", "COUNCIL", "RESIDENT", "MEMBER"})
    void onlyManagersCanEditEvenWithProviderAdminClaims(String role) throws Exception {
        var f = fixture();
        var report = report(f, "2026-01-01T00:00:00Z");
        db.update(ESTATEUSER)
                .set(ESTATEUSER.ROLE, role)
                .where(ESTATEUSER.ESTATEID.eq(f.estate).and(ESTATEUSER.USERID.eq("manager")))
                .execute();
        change(f, report, "HIGH", false, 0).andExpect(status().isForbidden());
        assertEquals(0, events(report));
    }

    @Test
    void foreignReportsInactiveEstatesAndMissingIdentityCannotBeEdited() throws Exception {
        var f = fixture();
        var other = fixture();
        var report = report(f, "2026-01-01T00:00:00Z");
        var foreign = report(other, "2026-01-01T00:00:00Z");
        change(f, foreign, "HIGH", false, 0).andExpect(status().isNotFound());
        mvc.perform(patch(detail(f, report) + "/urgency")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("HIGH", false, 0)))
                .andExpect(status().isUnauthorized());
        db.update(ESTATE)
                .set(ESTATE.DEACTIVATEDAT, currentOffsetDateTime())
                .where(ESTATE.ID.eq(f.estate))
                .execute();
        change(f, report, "HIGH", false, 0).andExpect(status().isConflict());
        mvc.perform(staff(get(detail(f, report)))).andExpect(status().isOk());
        assertEquals(0, events(report));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{}",
                "{\"urgency\":\"HIGH\",\"expectedVersion\":0}",
                "{\"urgency\":\"EXTREME\",\"isSafety\":false,\"expectedVersion\":0}",
                "{\"urgency\":\"HIGH\",\"isSafety\":false,\"expectedVersion\":-1}",
                "{\"urgency\":\"HIGH\",\"isSafety\":null,\"expectedVersion\":0}"
            })
    void malformedBodiesDoNotWrite(String body) throws Exception {
        var f = fixture();
        var report = report(f, "2026-01-01T00:00:00Z");
        mvc.perform(staff(patch(detail(f, report) + "/urgency")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)))
                .andExpect(status().isBadRequest());
        assertEquals(0, events(report));
    }

    @Test
    void safetyAndUrgencyAreOrderedAcrossPagesAndCursorsAreScoped() throws Exception {
        var f = fixture();
        var low = report(f, "2026-01-06T00:00:00Z");
        var medium = report(f, "2026-01-05T00:00:00Z");
        var high = report(f, "2026-01-04T00:00:00Z");
        var urgent = report(f, "2026-01-03T00:00:00Z");
        var safety = report(f, "2026-01-01T00:00:00Z");
        change(f, low, "LOW", false, 0).andExpect(status().isOk());
        change(f, high, "HIGH", false, 0).andExpect(status().isOk());
        change(f, urgent, "URGENT", false, 0).andExpect(status().isOk());
        change(f, safety, "URGENT", true, 0).andExpect(status().isOk());
        var first = mvc.perform(staff(get(list(f)).param("limit", "2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(safety.toString()))
                .andExpect(jsonPath("$.items[1].id").value(urgent.toString()))
                .andExpect(jsonPath("$.items[0].lastUrgencyChange").doesNotExist())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String cursor = JsonPath.read(first, "$.nextCursor");
        mvc.perform(staff(get(list(f)).param("limit", "3").param("cursor", cursor)))
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.items[0].id").value(high.toString()))
                .andExpect(jsonPath("$.items[1].id").value(medium.toString()))
                .andExpect(jsonPath("$.items[2].id").value(low.toString()));
        mvc.perform(staff(get(list(f)).param("cursor", cursor).param("openOnly", "true")))
                .andExpect(status().isBadRequest());
        mvc.perform(staff(get(list(f)).param("cursor", cursor).param("blockId", f.block.toString())))
                .andExpect(status().isBadRequest());
        var other = fixture();
        mvc.perform(staff(get(list(other)).param("cursor", cursor))).andExpect(status().isBadRequest());
    }

    @Test
    void openViewIncludesUnassignedAndMixedWorkButExcludesAllClosedWork() throws Exception {
        var f = fixture();
        var unassigned = report(f, "2026-01-01T00:00:00Z");
        var closed = report(f, "2026-01-02T00:00:00Z");
        var mixed = report(f, "2026-01-03T00:00:00Z");
        workOrder(f, closed, "CLOSED");
        workOrder(f, mixed, "CLOSED");
        workOrder(f, mixed, "OPEN");
        mvc.perform(staff(get(list(f)).param("openOnly", "true")))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(mixed.toString()))
                .andExpect(jsonPath("$.items[1].id").value(unassigned.toString()));
        mvc.perform(staff(get(list(f)))).andExpect(jsonPath("$.items.length()").value(3));
    }

    @Test
    void capabilityMatchesManagerMembershipAndActivity() throws Exception {
        var f = fixture();
        mvc.perform(staff(get("/access/context")))
                .andExpect(jsonPath("$.estates[0].canChangeFaultReportUrgency").value(true));
        db.update(ESTATE)
                .set(ESTATE.DEACTIVATEDAT, currentOffsetDateTime())
                .where(ESTATE.ID.eq(f.estate))
                .execute();
        mvc.perform(staff(get("/access/context")))
                .andExpect(jsonPath("$.estates[0].canChangeFaultReportUrgency").value(false));
    }

    @Test
    void latestChangeContractAllowsTheNullReturnedBeforeAnyEdit() throws Exception {
        mvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath(
                                "$.components.schemas.EstateIssueReportDetailResponse.properties.lastUrgencyChange.oneOf[1].type")
                        .value("null"));
    }

    @Test
    void newestSortIgnoresUrgencyAndUsesStableTimeOrderAcrossPages() throws Exception {
        var f = fixture();
        var newest = report(f, "2026-01-04T00:00:00Z");
        var tiedA = report(f, "2026-01-03T00:00:00Z");
        var tiedB = report(f, "2026-01-03T00:00:00Z");
        var safety = report(f, "2026-01-01T00:00:00Z");
        change(f, newest, "LOW", false, 0).andExpect(status().isOk());
        change(f, safety, "URGENT", true, 0).andExpect(status().isOk());
        var ties = java.util.stream.Stream.of(tiedA, tiedB)
                .sorted(java.util.Comparator.comparing(UUID::toString).reversed())
                .toList();
        var first = mvc.perform(staff(get(list(f))
                        .param("sort", "NEWEST")
                        .param("limit", "2")
                        .param("blockId", f.block.toString())
                        .param("openOnly", "true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(newest.toString()))
                .andExpect(jsonPath("$.items[1].id").value(ties.getFirst().toString()))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String cursor = JsonPath.read(first, "$.nextCursor");
        mvc.perform(staff(get(list(f))
                        .param("sort", "NEWEST")
                        .param("limit", "2")
                        .param("blockId", f.block.toString())
                        .param("openOnly", "true")
                        .param("cursor", cursor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(ties.getLast().toString()))
                .andExpect(jsonPath("$.items[1].id").value(safety.toString()));
    }

    @Test
    void oldestSortUsesAscendingSubmissionTimeAndScopedPagination() throws Exception {
        var f = fixture();
        var closed = report(f, "2025-12-01T00:00:00Z");
        workOrder(f, closed, "CLOSED");
        var oldest = report(f, "2026-01-01T00:00:00Z");
        var tiedA = report(f, "2026-01-02T00:00:00Z");
        var tiedB = report(f, "2026-01-02T00:00:00Z");
        var newestSafety = report(f, "2026-01-03T00:00:00Z");
        change(f, oldest, "LOW", false, 0).andExpect(status().isOk());
        change(f, newestSafety, "URGENT", true, 0).andExpect(status().isOk());
        var ties = java.util.stream.Stream.of(tiedA, tiedB)
                .sorted(java.util.Comparator.comparing(UUID::toString))
                .toList();
        var first = mvc.perform(staff(get(list(f))
                        .param("sort", "OLDEST")
                        .param("limit", "2")
                        .param("blockId", f.block.toString())
                        .param("minLevelPosition", "1")
                        .param("maxLevelPosition", "1")
                        .param("openOnly", "true")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(oldest.toString()))
                .andExpect(jsonPath("$.items[1].id").value(ties.getFirst().toString()))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String cursor = JsonPath.read(first, "$.nextCursor");
        mvc.perform(staff(get(list(f))
                        .param("sort", "OLDEST")
                        .param("limit", "2")
                        .param("blockId", f.block.toString())
                        .param("minLevelPosition", "1")
                        .param("maxLevelPosition", "1")
                        .param("openOnly", "true")
                        .param("cursor", cursor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(ties.getLast().toString()))
                .andExpect(jsonPath("$.items[1].id").value(newestSafety.toString()))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
        for (var sort : java.util.List.of("NEWEST", "URGENCY")) {
            mvc.perform(staff(get(list(f))
                            .param("sort", sort)
                            .param("blockId", f.block.toString())
                            .param("minLevelPosition", "1")
                            .param("maxLevelPosition", "1")
                            .param("openOnly", "true")
                            .param("cursor", cursor)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void changingSortRejectsThePreviousOrderingCursor() throws Exception {
        var f = fixture();
        report(f, "2026-01-01T00:00:00Z");
        report(f, "2026-01-02T00:00:00Z");
        var first = mvc.perform(staff(get(list(f)).param("limit", "1")))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String cursor = JsonPath.read(first, "$.nextCursor");
        mvc.perform(staff(get(list(f)).param("cursor", cursor).param("sort", "NEWEST")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unknownSortIsRejectedRatherThanSilentlyChangingTheQueue() throws Exception {
        var f = fixture();
        mvc.perform(staff(get(list(f)).param("sort", "UNKNOWN"))).andExpect(status().isBadRequest());
    }

    @Test
    void duplicateAndUrgencyEditsPreserveEachOthersFields() throws Exception {
        var f = fixture();
        var original = report(f, "2026-01-01T00:00:00Z");
        var duplicate = report(f, "2026-01-02T00:00:00Z");
        mvc.perform(staff(put(detail(f, duplicate) + "/duplicate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"originalReportId\":\"" + original + "\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.urgency").value("MEDIUM"));
        change(f, duplicate, "HIGH", false, 0)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicateOf.state").value("CONFIRMED"))
                .andExpect(jsonPath("$.urgency").value("HIGH"));
        mvc.perform(staff(patch(detail(f, duplicate) + "/duplicate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"REJECTED\",\"expectedState\":\"CONFIRMED\"}")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicateOf").value(nullValue()))
                .andExpect(jsonPath("$.urgency").value("HIGH"))
                .andExpect(jsonPath("$.lastUrgencyChange.toUrgency").value("HIGH"));
    }

    private record Fixture(UUID estate, UUID block, UUID level) {}

    private Fixture fixture() {
        var estate = UUID.randomUUID();
        db.insertInto(ESTATE)
                .set(ESTATE.ID, estate)
                .set(ESTATE.OWNERUSERID, "manager")
                .set(ESTATE.NAME, "Urgency estate")
                .set(ESTATE.CODE, estate.toString())
                .set(ESTATE.ADDRESS, "Road")
                .set(ESTATE.POSTALCODE, "123456")
                .set(ESTATE.UPDATEDAT, currentOffsetDateTime())
                .execute();
        db.insertInto(ESTATEUSER)
                .set(ESTATEUSER.ESTATEID, estate)
                .set(ESTATEUSER.USERID, "manager")
                .set(ESTATEUSER.ROLE, "MANAGER")
                .execute();
        var block = UUID.randomUUID();
        var level = UUID.randomUUID();
        db.insertInto(LOCATION)
                .set(LOCATION.ID, block)
                .set(LOCATION.ESTATEID, estate)
                .set(LOCATION.TYPE, "BLOCK")
                .set(LOCATION.NAME, "Block A")
                .set(LOCATION.UPDATEDAT, currentOffsetDateTime())
                .execute();
        db.insertInto(LOCATION)
                .set(LOCATION.ID, level)
                .set(LOCATION.ESTATEID, estate)
                .set(LOCATION.TYPE, "LEVEL")
                .set(LOCATION.PARENTID, block)
                .set(LOCATION.PARENTTYPE, "BLOCK")
                .set(LOCATION.NAME, "Level 1")
                .set(LOCATION.SORTORDER, 1)
                .set(LOCATION.UPDATEDAT, currentOffsetDateTime())
                .execute();
        return new Fixture(estate, block, level);
    }

    private UUID report(Fixture f, String time) {
        var report = UUID.randomUUID();
        var createdAt = OffsetDateTime.parse(time);
        db.insertInto(ISSUEREPORT)
                .set(ISSUEREPORT.ID, report)
                .set(ISSUEREPORT.ESTATEID, f.estate)
                .set(ISSUEREPORT.LOCATIONID, f.level)
                .set(ISSUEREPORT.SUBMITTEDBYUSERID, "resident")
                .set(ISSUEREPORT.TITLE, "Broken light")
                .set(ISSUEREPORT.DESCRIPTION, "Light is out")
                .set(ISSUEREPORT.CREATEDAT, createdAt)
                .set(ISSUEREPORT.UPDATEDAT, createdAt)
                .execute();
        return report;
    }

    private void workOrder(Fixture f, UUID report, String state) {
        var id = UUID.randomUUID();
        db.insertInto(WORKORDER)
                .set(WORKORDER.ID, id)
                .set(WORKORDER.ESTATEID, f.estate)
                .set(WORKORDER.REFERENCE, "U-" + id)
                .set(WORKORDER.DESCRIPTION, "Fix light")
                .set(WORKORDER.LOCATIONID, f.level)
                .set(WORKORDER.CATEGORY, "EQUIPMENT_FAULT")
                .set(WORKORDER.PRIORITY, "MEDIUM")
                .set(WORKORDER.SOURCE, "RESIDENT_REPORT")
                .set(WORKORDER.SOURCEREPORTID, report)
                .set(WORKORDER.STATUS, state)
                .set(WORKORDER.CREATEDBYUSERID, "manager")
                .set(WORKORDER.UPDATEDAT, currentOffsetDateTime())
                .execute();
    }

    private int events(UUID report) {
        return db.fetchCount(ISSUEREPORTURGENCYEVENT, ISSUEREPORTURGENCYEVENT.REPORTID.eq(report));
    }

    private org.springframework.test.web.servlet.ResultActions change(
            Fixture f, UUID report, String urgency, boolean safety, int version) throws Exception {
        return mvc.perform(staff(patch(detail(f, report) + "/urgency")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(urgency, safety, version))));
    }

    private static String body(String urgency, boolean safety, int version) {
        return "{\"urgency\":\"%s\",\"isSafety\":%s,\"expectedVersion\":%d}".formatted(urgency, safety, version);
    }

    private static String list(Fixture f) {
        return "/estates/" + f.estate + "/reports";
    }

    private static String detail(Fixture f, UUID report) {
        return list(f) + "/" + report;
    }

    private static MockHttpServletRequestBuilder staff(MockHttpServletRequestBuilder request) {
        return request.with(jwt().jwt(token -> token.subject("manager").claim("role", "admin")));
    }
}
