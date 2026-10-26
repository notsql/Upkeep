package com.proj.server;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
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

@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class WorkOrdersIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    com.proj.server.workos.WorkOSService workOS;

    private final String owner = "work-order-owner-" + UUID.randomUUID();

    @ParameterizedTest
    @CsvSource({"ASC,false", "DESC,false", "ASC,true", "DESC,true"})
    void priorityTiesUseOldestFirstAcrossPagesInEitherDirection(String direction, boolean filtered) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        var ids = new java.util.ArrayList<String>();
        for (int i = 1; i <= 5; i++) {
            var body = create(data, owner, "CLEANLINESS", i == 4 ? "LOW" : i == 5 ? "URGENT" : "HIGH", "")
                    .andExpect(status().isCreated())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            ids.add(JsonPath.read(body, "$.id"));
        }
        // Keep persisted identities/audit relations intact. Assign priorities and dates
        // against sorted UUIDs so equal-priority ordering must use time before ID.
        ids.sort(java.util.Comparator.naturalOrder());
        for (int i = 1; i <= ids.size(); i++) {
            db.execute(
                    "update \"WorkOrder\" set priority=?, \"createdAt\"=?::timestamptz where id=?::uuid",
                    i == 4 ? "LOW" : i == 5 ? "URGENT" : "HIGH",
                    i == 2 ? "2026-10-01T00:00:00Z" : "2026-10-02T00:00:00Z",
                    ids.get(i - 1));
        }
        var expected = filtered
                ? new int[] {2, 3, 1}
                : direction.equals("ASC") ? new int[] {4, 2, 3, 1, 5} : new int[] {5, 2, 3, 1, 4};
        String cursor = null;
        for (int position : expected) {
            var request = get(path(data[0]))
                    .param("sortBy", "PRIORITY")
                    .param("direction", direction)
                    .param("q", "w000")
                    .param("limit", "1")
                    .with(jwt().jwt(t -> t.subject(owner)));
            if (filtered) request.param("priority", "HIGH");
            if (cursor != null) request.param("cursor", cursor);
            var body = mvc.perform(request)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items.length()").value(1))
                    .andExpect(jsonPath("$.items[0].id").value(ids.get(position - 1)))
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            cursor = JsonPath.read(body, "$.nextCursor");
        }
        assertEquals(null, cursor);
    }

    @Test
    void linkedAssetsMustMatchTheWorkLocationWithoutChangingExistingHistory() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String linked = ",\"assetId\":\"" + data[2] + "\"";
        var saved = create(data, owner, "EQUIPMENT_FAULT", "LOW", linked)
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        var alternative = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id,\"estateId\",type,name,\"updatedAt\") values (?,?,'BLOCK','Block B',now())",
                alternative,
                data[0]);
        db.execute("update \"Asset\" set \"locationId\"=? where id=?", alternative, data[2]);
        create(data, owner, "EQUIPMENT_FAULT", "LOW", linked).andExpect(status().isBadRequest());
        assertEquals(1, db.fetchCount(org.jooq.impl.DSL.table("\"WorkOrder\"")));
        String id = JsonPath.read(saved, "$.id");
        mvc.perform(get(path(data[0]) + "/" + id).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk());
        create(data, owner, "EQUIPMENT_FAULT", "LOW", "").andExpect(status().isCreated());
    }

    @Test
    void acceptsLegacyTimestampCursorForDefaultOrdering() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        var first = JsonPath.<String>read(
                create(data, owner, "CLEANLINESS", "LOW", "")
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        var second = create(data, owner, "CLEANLINESS", "LOW", "")
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String time = JsonPath.read(second, "$.createdAt");
        String id = JsonPath.read(second, "$.id");
        var cursor = java.util.Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString((time + "|" + id).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        mvc.perform(get(path(data[0])).param("cursor", cursor).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(first));
    }

    @ParameterizedTest
    @CsvSource({
        "REFERENCE,ASC,1,2,3",
        "REFERENCE,DESC,3,2,1",
        "PRIORITY,ASC,2,1,3",
        "PRIORITY,DESC,3,1,2",
        "CATEGORY,ASC,2,1,3",
        "CATEGORY,DESC,3,1,2",
        "CREATED_AT,ASC,1,2,3",
        "CREATED_AT,DESC,3,2,1"
    })
    void sortingOrdersEveryPageWithoutRemovingOtherPriorities(String sort, String direction, int a, int b, int c)
            throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        var ids = new java.util.ArrayList<String>();
        for (var values : new String[][] {{"EQUIPMENT_FAULT", "HIGH"}, {"CLEANLINESS", "LOW"}, {"SAFETY", "URGENT"}}) {
            ids.add(JsonPath.read(
                    create(data, owner, values[0], values[1], "")
                            .andExpect(status().isCreated())
                            .andReturn()
                            .getResponse()
                            .getContentAsString(),
                    "$.id"));
        }
        for (int i = 0; i < ids.size(); i++)
            db.execute(
                    "update \"WorkOrder\" set \"createdAt\"=?::timestamptz where id=?::uuid",
                    "2026-10-" + (10 + i) + "T00:00:00Z",
                    ids.get(i));
        String cursor = null;
        for (var position : new int[] {a, b, c}) {
            var request = get(path(data[0]))
                    .param("sortBy", sort)
                    .param("direction", direction)
                    .param("limit", "1")
                    .with(jwt().jwt(t -> t.subject(owner)));
            if (cursor != null) request.param("cursor", cursor);
            var body = mvc.perform(request)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items.length()").value(1))
                    .andExpect(jsonPath("$.items[0].id").value(ids.get(position - 1)))
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            cursor = JsonPath.read(body, "$.nextCursor");
        }
        assertEquals(null, cursor);
    }

    @Test
    void sortedPaginationUsesStableTiesKeepsFiltersAndRejectsWrongCursors() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        var ids = new java.util.ArrayList<String>();
        for (int i = 0; i < 3; i++)
            ids.add(JsonPath.read(
                    create(data, owner, "CLEANLINESS", "HIGH", "")
                            .andExpect(status().isCreated())
                            .andReturn()
                            .getResponse()
                            .getContentAsString(),
                    "$.id"));
        create(data, owner, "CLEANLINESS", "LOW", "").andExpect(status().isCreated());
        // True timestamp ties exercise the final UUID fallback under the oldest-first rule (with the existing
        // descending UUID fallback).
        db.execute("update \"WorkOrder\" set \"createdAt\"='2026-10-01T00:00:00Z' where \"estateId\"=?", data[0]);
        ids.sort(java.util.Comparator.reverseOrder());
        var body = mvc.perform(get(path(data[0]))
                        .param("priority", "HIGH")
                        .param("q", "w000")
                        .param("sortBy", "PRIORITY")
                        .param("direction", "DESC")
                        .param("limit", "1")
                        .with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(ids.getFirst()))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String cursor = JsonPath.read(body, "$.nextCursor");
        mvc.perform(get(path(data[0]))
                        .param("priority", "HIGH")
                        .param("q", "w000")
                        .param("sortBy", "PRIORITY")
                        .param("direction", "DESC")
                        .param("cursor", cursor)
                        .with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(ids.get(1)))
                .andExpect(jsonPath("$.items[1].id").value(ids.get(2)));
        for (var values : new String[][] {{"PRIORITY", "ASC"}, {"REFERENCE", "DESC"}})
            mvc.perform(get(path(data[0]))
                            .param("sortBy", values[0])
                            .param("direction", values[1])
                            .param("cursor", cursor)
                            .with(jwt().jwt(t -> t.subject(owner))))
                    .andExpect(status().isBadRequest());
        var other = new DeviceTestData(db).estateWithAsset(owner);
        mvc.perform(get(path(other[0]))
                        .param("sortBy", "PRIORITY")
                        .param("direction", "DESC")
                        .param("cursor", cursor)
                        .with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path(data[0])).param("sortBy", "STATUS").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path(data[0])).param("direction", "SIDEWAYS").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void referenceOrderingUsesNumericSequenceBeyondFourDigitsAcrossCodeChanges() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        var first = JsonPath.<String>read(
                create(data, owner, "CLEANLINESS", "LOW", "")
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        var second = JsonPath.<String>read(
                create(data, owner, "CLEANLINESS", "LOW", "")
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        db.execute("update \"WorkOrder\" set reference='Z-W9999' where id=?::uuid", first);
        db.execute("update \"WorkOrder\" set reference='A-W10000' where id=?::uuid", second);
        mvc.perform(get(path(data[0]))
                        .param("sortBy", "REFERENCE")
                        .param("direction", "ASC")
                        .with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(first));
    }

    @Test
    void priorityAndReferenceFiltersRunBeforePaginationAndStayEstateScoped() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        var first = JsonPath.<String>read(
                create(data, owner, "CLEANLINESS", "HIGH", "")
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        create(data, owner, "CLEANLINESS", "LOW", "").andExpect(status().isCreated());
        var second = JsonPath.<String>read(
                create(data, owner, "CLEANLINESS", "HIGH", "")
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        create(data, owner, "CLEANLINESS", "LOW", "").andExpect(status().isCreated());
        var other = new DeviceTestData(db).estateWithAsset(owner);
        create(other, owner, "CLEANLINESS", "HIGH", "").andExpect(status().isCreated());

        var page = mvc.perform(get(path(data[0]))
                        .param("priority", "HIGH")
                        .param("q", "  w000  ")
                        .param("limit", "1")
                        .with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(second))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String cursor = JsonPath.read(page, "$.nextCursor");
        mvc.perform(get(path(data[0]))
                        .param("priority", "HIGH")
                        .param("q", "w000")
                        .param("limit", "1")
                        .param("cursor", cursor)
                        .with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(first))
                .andExpect(jsonPath("$.nextCursor").isEmpty());
        mvc.perform(get(path(data[0])).param("priority", "URGENT").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get(path(data[0])).param("q", "no-such-reference").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void referenceSearchTreatsSqlWildcardsLiterallyAndMatchesWithoutCase() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        db.execute("update \"Estate\" set code='A%_B' where id=?", data[0]);
        create(data, owner, "CLEANLINESS", "LOW", "").andExpect(status().isCreated());
        db.execute("update \"Estate\" set code='AXXB' where id=?", data[0]);
        create(data, owner, "CLEANLINESS", "HIGH", "").andExpect(status().isCreated());
        for (var search : new String[] {"%", "_", "a%_b"}) {
            mvc.perform(get(path(data[0])).param("q", search).with(jwt().jwt(t -> t.subject(owner))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items.length()").value(1))
                    .andExpect(jsonPath("$.items[0].reference").value("A%_B-W0001"));
        }
        mvc.perform(get(path(data[0])).param("q", "\\").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void rejectsInvalidListFiltersWithoutBypassingEstatePermissions() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        mvc.perform(get(path(data[0])).param("priority", "IMPORTANT").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path(data[0])).param("q", "x".repeat(201)).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path(data[0]))
                        .param("priority", "HIGH")
                        .param("q", "W0001")
                        .with(jwt().jwt(t -> t.subject("stranger"))))
                .andExpect(status().isNotFound());
        member(data[0], "list-resident", "RESIDENT");
        mvc.perform(get(path(data[0])).param("priority", "HIGH").with(jwt().jwt(t -> t.subject("list-resident"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void creatorDisplayNameIsReturnedOnCreationAndDetailWithoutChangingTheAuditIdentity() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        org.mockito.Mockito.when(workOS.findDisplayName(owner)).thenReturn(java.util.Optional.of("Alex Tan"));
        var body = create(data, owner, "CLEANLINESS", "LOW", "")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.createdByName").value("Alex Tan"))
                .andExpect(jsonPath("$.createdByUserId").value(owner))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String id = JsonPath.read(body, "$.id");
        mvc.perform(get(path(data[0]) + "/" + id).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdByName").value("Alex Tan"));
    }

    @Test
    void unavailableCreatorNameDoesNotPreventReadingAnExistingOrder() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = JsonPath.read(
                create(data, owner, "CLEANLINESS", "LOW", "")
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        mvc.perform(get(path(data[0]) + "/" + id).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.createdByUserId").value(owner));
    }

    @ParameterizedTest
    @ValueSource(strings = {"EQUIPMENT_FAULT", "CLEANLINESS", "SAFETY"})
    void createsAnOpenOrderWithoutRegisteredEquipment(String category) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        db.execute("delete from \"Asset\" where id = ?", data[2]);
        create(data, owner, category, "URGENT", "")
                .andExpect(status().isCreated())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.reference").value(data[0] + "-W0001"))
                .andExpect(jsonPath("$.description").value("Water pooling"))
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.createdByUserId").value(owner))
                .andExpect(jsonPath("$.assetId").isEmpty());
    }

    @Test
    void currentManagerCreatesAndCrewReadsEveryOrderButCannotCreateOrPickAssets() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        member(data[0], "manager", "MANAGER");
        member(data[0], "crew", "CREW");
        var body = create(data, "manager", "CLEANLINESS", "MEDIUM", "")
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String id = JsonPath.read(body, "$.id");
        mvc.perform(get(path(data[0])).with(jwt().jwt(t -> t.subject("crew"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(id));
        mvc.perform(get(path(data[0]) + "/" + id).with(jwt().jwt(t -> t.subject("crew"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locationPath").value("Block A"));
        create(data, "crew", "CLEANLINESS", "MEDIUM", "").andExpect(status().isForbidden());
        mvc.perform(get("/estates/" + data[0] + "/work-order-assets").with(jwt().jwt(t -> t.subject("crew"))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/access/context").with(jwt().jwt(t -> t.subject("crew"))))
                .andExpect(jsonPath("$.estates[0].canViewWorkOrders").value(true))
                .andExpect(jsonPath("$.estates[0].canCreateWorkOrders").value(false));
    }

    @ParameterizedTest
    @ValueSource(strings = {"MEMBER", "COUNCIL", "RESIDENT"})
    void otherMembershipsCannotReadOrCreate(String role) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        member(data[0], "other", role);
        create(data, "other", "CLEANLINESS", "MEDIUM", "").andExpect(status().isForbidden());
        mvc.perform(get(path(data[0])).with(jwt().jwt(t -> t.subject("other")))).andExpect(status().isForbidden());
    }

    @Test
    void unknownEstateIsHiddenAndResidentMembershipOverridesOwnership() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        create(data, "stranger", "CLEANLINESS", "MEDIUM", "").andExpect(status().isNotFound());
        member(data[0], owner, "RESIDENT");
        create(data, owner, "CLEANLINESS", "MEDIUM", "").andExpect(status().isForbidden());
    }

    @Test
    void safetyRequiresUrgentAndSourceFieldsMustMatch() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        create(data, owner, "SAFETY", "LOW", "").andExpect(status().isBadRequest());
        create(data, owner, "UNKNOWN", "LOW", "").andExpect(status().isBadRequest());
        create(data, owner, "CLEANLINESS", "LOW", ",\"sourceReportId\":\"" + UUID.randomUUID() + "\"")
                .andExpect(status().isBadRequest());
        assertEquals(0, db.fetchCount(org.jooq.impl.DSL.table("\"WorkOrder\"")));
    }

    @Test
    void foreignAssetIsHiddenAndInactiveLocationConflictsWithoutSaving() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        var foreign = new DeviceTestData(db).estateWithAsset(owner);
        create(data, owner, "CLEANLINESS", "LOW", ",\"assetId\":\"" + foreign[2] + "\"")
                .andExpect(status().isNotFound());
        db.execute("update \"Location\" set \"deactivatedAt\" = now() where id = ?", data[1]);
        create(data, owner, "CLEANLINESS", "LOW", "").andExpect(status().isConflict());
    }

    @Test
    void inactiveEstatesKeepHistoryButRejectNewOrders() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        create(data, owner, "CLEANLINESS", "LOW", "").andExpect(status().isCreated());
        db.execute("update \"Estate\" set \"deactivatedAt\" = now() where id = ?", data[0]);
        create(data, owner, "CLEANLINESS", "LOW", "").andExpect(status().isConflict());
        mvc.perform(get(path(data[0])).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1));
    }

    private ResultActions create(UUID[] data, String user, String category, String priority, String extra)
            throws Exception {
        return mvc.perform(post(path(data[0]))
                .with(jwt().jwt(t -> t.subject(user)))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"description":"  Water pooling  ","locationId":"%s","category":"%s",
                         "priority":"%s","source":"MANUAL"%s}
                        """.formatted(data[1], category, priority, extra)));
    }

    @Test
    void severalOrdersCanShareAReportWithoutChangingItAndStalePlacementIsRejected() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        member(data[0], owner, "MANAGER");
        var report = UUID.randomUUID();
        db.execute(
                "insert into \"IssueReport\" (id, \"estateId\", \"locationId\", \"submittedByUserId\", title, description, \"updatedAt\") values (?, ?, ?, 'resident', 'Leak', 'Water pooling', now())",
                report,
                data[0],
                data[1]);
        var before = db.fetchOne("select * from \"IssueReport\" where id = ?", report)
                .intoMap();
        for (int index = 1; index <= 2; index++) {
            reportOrder(data, owner, report, data[1])
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.reference").value(data[0] + "-W000" + index))
                    .andExpect(jsonPath("$.sourceReportId").value(report.toString()));
        }
        assertEquals(
                before,
                db.fetchOne("select * from \"IssueReport\" where id = ?", report)
                        .intoMap());
        reportOrder(data, owner, report, UUID.randomUUID()).andExpect(status().isConflict());
        reportOrder(data, owner, UUID.randomUUID(), data[1]).andExpect(status().isNotFound());
        assertEquals(2, db.fetchCount(org.jooq.impl.DSL.table("\"WorkOrder\"")));
    }

    @Test
    void ownershipAloneCannotConvertPrivateReports() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        reportOrder(data, owner, UUID.randomUUID(), data[1]).andExpect(status().isForbidden());
    }

    @Test
    void referencesSurviveCodeChangesAndPaginationHasNoDuplicates() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String first = JsonPath.read(
                create(data, owner, "CLEANLINESS", "LOW", "")
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
        db.execute("update \"Estate\" set code = 'NEW-CODE' where id = ?", data[0]);
        create(data, owner, "CLEANLINESS", "LOW", "")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reference").value("NEW-CODE-W0002"));
        var firstPage = mvc.perform(get(path(data[0])).param("limit", "1").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].reference").value("NEW-CODE-W0002"))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String cursor = JsonPath.read(firstPage, "$.nextCursor");
        mvc.perform(get(path(data[0]))
                        .param("limit", "1")
                        .param("cursor", cursor)
                        .with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(first))
                .andExpect(jsonPath("$.nextCursor").isEmpty());
        mvc.perform(get(path(data[0]) + "/" + first).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(jsonPath("$.reference").value(data[0] + "-W0001"));
        mvc.perform(get(path(data[0])).param("cursor", "broken").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isBadRequest());
        mvc.perform(get(path(data[0])).param("limit", "0").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void managerPickerIsLimitedSearchesLiterallyAndOmitsInactiveEquipment() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        member(data[0], "picker-manager", "MANAGER");
        String url = "/estates/" + data[0] + "/work-order-assets";
        mvc.perform(get(url).with(jwt().jwt(t -> t.subject("picker-manager"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(data[2].toString()))
                .andExpect(jsonPath("$.items[0].serialNumber").doesNotExist());
        mvc.perform(get(url).param("q", "%").with(jwt().jwt(t -> t.subject("picker-manager"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));
        db.execute(
                "update \"Asset\" set \"retiredOn\" = current_date, \"retirementReason\" = 'Retired' where id = ?",
                data[2]);
        mvc.perform(get(url).with(jwt().jwt(t -> t.subject("picker-manager"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));
        create(data, owner, "EQUIPMENT_FAULT", "LOW", ",\"assetId\":\"" + data[2] + "\"")
                .andExpect(status().isConflict());
    }

    @Test
    void manualSourcesRequireDescriptionsAndInspectionReferences() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        for (String source : new String[] {"INSPECTION", "MAINTENANCE_RECOMMENDATION"}) {
            String body = "{\"description\":\"Check this\",\"locationId\":\"" + data[1]
                    + "\",\"category\":\"CLEANLINESS\",\"priority\":\"HIGH\",\"source\":\"" + source + "\"";
            mvc.perform(post(path(data[0]))
                            .with(jwt().jwt(t -> t.subject(owner)))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body + "}"))
                    .andExpect(status().isBadRequest());
            mvc.perform(post(path(data[0]))
                            .with(jwt().jwt(t -> t.subject(owner)))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body + ",\"sourceReference\":\"Inspection on 22 October\"}"))
                    .andExpect(status().isCreated());
        }
        mvc.perform(post(path(data[0]))
                        .with(jwt().jwt(t -> t.subject(owner)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"description\":\"   \",\"locationId\":\"" + data[1]
                                + "\",\"category\":\"CLEANLINESS\",\"priority\":\"LOW\",\"source\":\"MANUAL\"}"))
                .andExpect(status().isBadRequest());
    }

    private ResultActions reportOrder(UUID[] data, String user, UUID report, UUID expectedLocation) throws Exception {
        return mvc.perform(post(path(data[0]))
                .with(jwt().jwt(t -> t.subject(user)))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                {"description":"Water pooling","locationId":"%s","category":"CLEANLINESS","priority":"HIGH",
                "source":"RESIDENT_REPORT","sourceReportId":"%s","expectedSourceLocationId":"%s"}
                """.formatted(data[1], report, expectedLocation)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"estate", "location", "asset", "asset-location", "membership", "demotion", "report"})
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void queuedCreationRechecksStateAfterTheEstateLockWait(String change) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        try {
            member(data[0], "queued-manager", "MANAGER");
            var report = UUID.randomUUID();
            db.execute(
                    "insert into \"IssueReport\" (id,\"estateId\",\"locationId\",\"submittedByUserId\",title,description,\"updatedAt\") values (?,?,?,'resident','Leak','Leak',now())",
                    report,
                    data[0],
                    data[1]);
            var alternative = UUID.randomUUID();
            db.execute(
                    "insert into \"Location\" (id,\"estateId\",type,name,\"updatedAt\") values (?,?,'BLOCK','Block B',now())",
                    alternative,
                    data[0]);
            try (var requests = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
                var pending = db.transactionResult(configuration -> {
                    var locked = org.jooq.impl.DSL.using(configuration);
                    locked.fetch("select id from \"Estate\" where id=? for update", data[0]);
                    var blocker = locked.fetchValue("select pg_backend_pid()", Integer.class);
                    var request = requests.submit(() -> {
                        var result = change.equals("report")
                                ? reportOrder(data, "queued-manager", report, data[1])
                                : create(
                                        data,
                                        "queued-manager",
                                        "CLEANLINESS",
                                        "LOW",
                                        change.startsWith("asset") ? ",\"assetId\":\"" + data[2] + "\"" : "");
                        return result.andReturn().getResponse().getStatus();
                    });
                    boolean blocked = false;
                    var deadline = java.time.Instant.now().plusSeconds(5);
                    while (!request.isDone() && java.time.Instant.now().isBefore(deadline)) {
                        blocked = Boolean.TRUE.equals(locked.fetchOne(
                                        "select exists(select 1 from pg_stat_activity where ? = any(pg_blocking_pids(pid)))",
                                        blocker)
                                .get(0, Boolean.class));
                        if (blocked) break;
                    }
                    org.junit.jupiter.api.Assertions.assertTrue(blocked, "Creation must wait for the estate mutation");
                    switch (change) {
                        case "estate" ->
                            locked.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", data[0]);
                        case "location" ->
                            locked.execute("update \"Location\" set \"deactivatedAt\"=now() where id=?", data[1]);
                        case "asset" ->
                            locked.execute("update \"Asset\" set \"deactivatedAt\"=now() where id=?", data[2]);
                        case "asset-location" ->
                            locked.execute("update \"Asset\" set \"locationId\"=? where id=?", alternative, data[2]);
                        case "membership" ->
                            locked.execute(
                                    "delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='queued-manager'",
                                    data[0]);
                        case "demotion" ->
                            locked.execute(
                                    "update \"EstateUser\" set role='CREW' where \"estateId\"=? and \"userId\"='queued-manager'",
                                    data[0]);
                        case "report" ->
                            locked.execute(
                                    "update \"IssueReport\" set \"locationId\"=? where id=?", alternative, report);
                        default -> throw new IllegalArgumentException(change);
                    }
                    return request;
                });
                int expected = change.equals("membership")
                        ? 404
                        : change.equals("demotion") ? 403 : change.equals("asset-location") ? 400 : 409;
                assertEquals(expected, pending.get(10, java.util.concurrent.TimeUnit.SECONDS));
                assertEquals(0, db.fetchCount(org.jooq.impl.DSL.table("\"WorkOrder\"")));
            }
        } finally {
            cleanup(data[0]);
        }
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentValidOrdersForOneReportBothSucceedWithDistinctReferences() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        try {
            member(data[0], owner, "MANAGER");
            var report = UUID.randomUUID();
            db.execute(
                    "insert into \"IssueReport\" (id,\"estateId\",\"locationId\",\"submittedByUserId\",title,description,\"updatedAt\") values (?,?,?,'resident','Leak','Leak',now())",
                    report,
                    data[0],
                    data[1]);
            var ready = new java.util.concurrent.CountDownLatch(2);
            var start = new java.util.concurrent.CountDownLatch(1);
            try (var requests = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
                var futures = java.util.stream.IntStream.range(0, 2)
                        .mapToObj(index -> requests.submit(() -> {
                            ready.countDown();
                            if (!start.await(5, java.util.concurrent.TimeUnit.SECONDS))
                                throw new IllegalStateException("Requests did not start");
                            return reportOrder(data, owner, report, data[1])
                                    .andExpect(status().isCreated())
                                    .andReturn()
                                    .getResponse()
                                    .getContentAsString();
                        }))
                        .toList();
                try {
                    org.junit.jupiter.api.Assertions.assertTrue(ready.await(5, java.util.concurrent.TimeUnit.SECONDS));
                } finally {
                    start.countDown();
                }
                String first =
                        JsonPath.read(futures.get(0).get(10, java.util.concurrent.TimeUnit.SECONDS), "$.reference");
                String second =
                        JsonPath.read(futures.get(1).get(10, java.util.concurrent.TimeUnit.SECONDS), "$.reference");
                org.junit.jupiter.api.Assertions.assertNotEquals(first, second);
                assertEquals(2, db.fetchCount(org.jooq.impl.DSL.table("\"WorkOrder\"")));
            }
        } finally {
            cleanup(data[0]);
        }
    }

    private void cleanup(UUID estate) {
        db.execute("delete from \"WorkOrderCompletion\" where \"estateId\"=?", estate);
        db.execute("delete from \"WorkOrderStatusEvent\" where \"estateId\"=?", estate);
        db.execute("delete from \"WorkOrder\" where \"estateId\"=?", estate);
        db.execute("delete from \"IssueReport\" where \"estateId\"=?", estate);
        db.execute("delete from \"Asset\" where \"estateId\"=?", estate);
        db.execute("delete from \"Location\" where \"estateId\"=?", estate);
        db.execute("delete from \"EstateUser\" where \"estateId\"=?", estate);
        db.execute("delete from \"Estate\" where id=?", estate);
    }

    private void member(UUID estate, String user, String role) {
        db.execute("insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, ?, ?)", estate, user, role);
    }

    private static String path(UUID estate) {
        return "/estates/" + estate + "/work-orders";
    }
}
