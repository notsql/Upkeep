package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
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
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class WorkOrderReviewIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    com.proj.server.workos.WorkOSService workOS;

    @MockitoSpyBean
    com.proj.server.workorder.WorkOrderRepository repository;

    private final String owner = "review-owner-" + UUID.randomUUID();

    @Test
    void createdAuditUsesAnAvailableCreatorNameForNewAndPreviouslyUnnamedEvents() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, false);
        org.mockito.Mockito.when(workOS.findDisplayName(owner)).thenReturn(java.util.Optional.of("Alex Tan"));
        mvc.perform(get(base(data, id) + "/status-history").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].changedByName").value("Alex Tan"))
                .andExpect(jsonPath("$[0].changedByUserId").value(owner));
    }

    @ParameterizedTest
    @ValueSource(strings = {"ASC", "DESC"})
    void priorityTiesShowOldestFirstAcrossPagesAndRejectOldPriorityCursors(String direction) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String first = create(data, false);
        String second = create(data, false);
        String third = create(data, false);
        db.execute("update \"WorkOrder\" set \"createdAt\"='2026-10-01'::timestamptz where id=?::uuid", first);
        db.execute("update \"WorkOrder\" set \"createdAt\"='2026-10-02'::timestamptz where id=?::uuid", second);
        db.execute("update \"WorkOrder\" set \"createdAt\"='2026-10-02'::timestamptz where id=?::uuid", third);
        var ties = new java.util.ArrayList<>(java.util.List.of(second, third));
        ties.sort(java.util.Comparator.reverseOrder());
        String cursor = null;
        for (var expected : java.util.List.of(first, ties.get(0), ties.get(1))) {
            var request = get(list(data))
                    .with(jwt().jwt(t -> t.subject(owner)))
                    .param("sortBy", "PRIORITY")
                    .param("direction", direction)
                    .param("priority", "MEDIUM")
                    .param("limit", "1");
            if (cursor != null) request.param("cursor", cursor);
            String body = mvc.perform(request)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[0].id").value(expected))
                    .andReturn()
                    .getResponse()
                    .getContentAsString();
            cursor = JsonPath.read(body, "$.nextCursor");
        }
        assertNull(cursor);
        String old = java.util.Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                        ("v2|PRIORITY|" + direction + "|" + first).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        mvc.perform(get(list(data))
                        .with(jwt().jwt(t -> t.subject(owner)))
                        .param("sortBy", "PRIORITY")
                        .param("direction", direction)
                        .param("cursor", old))
                .andExpect(status().isBadRequest());
    }

    @Test
    void correctionPreservesCanonicalIdentityClosureAndAssetHistoryAndRecordsBeforeAndAfter() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = close(data, true);
        String before = detail(data, id);
        String completionId = JsonPath.read(before, "$.completion.id");
        String closedAt = JsonPath.read(before, "$.completion.completedAt");
        member(data[0], "manager", "MANAGER");
        member(data[0], "crew", "CREW");
        org.mockito.Mockito.when(workOS.findDisplayName("manager")).thenReturn(java.util.Optional.of("Alex Tan"));
        var assetBefore =
                db.fetchOne("select * from \"Asset\" where id=?", data[2]).intoMap();
        correct(data, id, "manager", 2, "Corrected parts invoice", "\"partsCost\":\"0\",\"downtimeMinutes\":0")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.version").value(3))
                .andExpect(jsonPath("$.completion.id").value(completionId))
                .andExpect(jsonPath("$.completion.completedAt").value(closedAt))
                .andExpect(jsonPath("$.completion.completedByUserId").value(owner))
                .andExpect(jsonPath("$.completion.findings").value("Corrected findings"))
                .andExpect(jsonPath("$.completion.labourCost").isEmpty())
                .andExpect(jsonPath("$.completion.partsCost").value("0.00"))
                .andExpect(jsonPath("$.completion.totalCost").isEmpty())
                .andExpect(jsonPath("$.completion.downtimeMinutes").value(0))
                .andExpect(jsonPath("$.completion.editedByName").value("Alex Tan"));
        mvc.perform(get(base(data, id) + "/completion-revisions").with(jwt().jwt(t -> t.subject("crew"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].before.findings").value("Original findings"))
                .andExpect(jsonPath("$[0].before.labourCost").value("12.30"))
                .andExpect(jsonPath("$[0].after.findings").value("Corrected findings"))
                .andExpect(jsonPath("$[0].correctionReason").value("Corrected parts invoice"))
                .andExpect(jsonPath("$[0].changedByName").value("Alex Tan"))
                .andExpect(jsonPath("$[0].fromVersion").value(2))
                .andExpect(jsonPath("$[0].version").value(3));
        mvc.perform(get(base(data, id) + "/status-history").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(jsonPath("$.length()").value(3));
        mvc.perform(get(assetHistory(data)).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].completion.id").value(completionId))
                .andExpect(jsonPath("$[0].completion.findings").value("Corrected findings"));
        mvc.perform(get(assetHistory(data)).with(jwt().jwt(t -> t.subject("manager"))))
                .andExpect(status().isNotFound());
        assertEquals(
                assetBefore,
                db.fetchOne("select * from \"Asset\" where id=?", data[2]).intoMap());
        assertEquals(0, db.fetchCount(org.jooq.impl.DSL.table("\"AssetEvent\"")));
    }

    @Test
    void identicalLatestRetryAndUnchangedSubmissionDoNotCreateDuplicateCorrectionsButOlderConflicts() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = close(data, false);
        correct(data, id, owner, 2, "Fix", "\"labourCost\":\"0\"").andExpect(status().isOk());
        correct(data, id, owner, 2, "Fix", "\"labourCost\":\"0.00\"")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(3));
        correct(data, id, owner, 3, "No change", "\"labourCost\":\"0\"")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(3));
        correct(data, id, owner, 2, "Other edit", "\"labourCost\":\"1\"").andExpect(status().isConflict());
        correct(data, id, owner, 3, "Second fix", "\"labourCost\":\"1\"").andExpect(status().isOk());
        correct(data, id, owner, 2, "Fix", "\"labourCost\":\"0\"").andExpect(status().isConflict());
        mvc.perform(get(base(data, id) + "/completion-revisions").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(jsonPath("$.length()").value(2));
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREW", "RESIDENT", "COUNCIL", "foreign", "inactive", "revoked"})
    void correctionRechecksMembershipAndLifecycleBeforeAnyReplay(String role) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = close(data, false);
        correct(data, id, owner, 2, "Fix", "\"partsCost\":\"0\"").andExpect(status().isOk());
        String user = "reader";
        int expected = role.equals("foreign") ? 404 : 403;
        if (role.equals("inactive")) {
            db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", data[0]);
            user = owner;
            expected = 409;
        } else if (role.equals("revoked")) {
            member(data[0], owner, "RESIDENT");
            user = owner;
        } else if (!role.equals("foreign")) member(data[0], user, role);
        correct(data, id, user, 2, "Fix", "\"partsCost\":\"0\"").andExpect(status().is(expected));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "\"correctionReason\":\" \"",
                "\"findings\":\" \"",
                "\"workPerformed\":\"\"",
                "\"labourCost\":\"-1\"",
                "\"partsCost\":\"1.001\"",
                "\"downtimeMinutes\":1.5",
                "\"expectedVersion\":2.5",
                "\"downtimeMinutes\":\"1\""
            })
    void validatesCorrectionsWithoutChangingTheSavedOutcome(String invalid) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = close(data, false);
        var mapper = new tools.jackson.databind.json.JsonMapper();
        var body = mapper.createObjectNode()
                .put("expectedVersion", 2)
                .put("findings", "Fixed")
                .put("workPerformed", "Repaired")
                .put("correctionReason", "Fix");
        body.setAll((tools.jackson.databind.node.ObjectNode) mapper.readTree("{" + invalid + "}"));
        mvc.perform(patch(base(data, id) + "/completion")
                        .with(jwt().jwt(t -> t.subject(owner)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body.toString()))
                .andExpect(status().isBadRequest());
        assertEquals("Original findings", JsonPath.read(detail(data, id), "$.completion.findings"));
    }

    @Test
    void allowsCorrectionAfterAssetRetirementButRejectsOpenAndForeignOrders() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String open = create(data, false);
        correct(data, open, owner, 0, "Fix", "\"partsCost\":\"0\"").andExpect(status().isConflict());
        correct(data, UUID.randomUUID().toString(), owner, 0, "Fix", "\"partsCost\":\"0\"")
                .andExpect(status().isNotFound());
        String closed = close(data, true);
        db.execute("update \"Asset\" set \"retiredOn\"=current_date, \"deactivatedAt\"=now() where id=?", data[2]);
        correct(data, closed, owner, 2, "Fix", "\"partsCost\":\"0\"").andExpect(status().isOk());
        var other = new DeviceTestData(db).estateWithAsset(owner);
        correct(other, closed, owner, 2, "Fix", "\"partsCost\":\"0\"").andExpect(status().isNotFound());
        mvc.perform(get(base(other, closed) + "/completion-revisions").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentCorrectionsNeverDuplicateRevisionsOrLoseADifferentOutcome(boolean identical) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        try {
            String id = close(data, false);
            var gate = new java.util.concurrent.CountDownLatch(1);
            try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
                var first = executor.submit(() -> {
                    gate.await();
                    return correct(data, id, owner, 2, "Fix", "\"partsCost\":\"0\"")
                            .andReturn()
                            .getResponse()
                            .getStatus();
                });
                var second = executor.submit(() -> {
                    gate.await();
                    return correct(
                                    data,
                                    id,
                                    owner,
                                    2,
                                    "Fix",
                                    identical ? "\"partsCost\":\"0.00\"" : "\"partsCost\":\"1\"")
                            .andReturn()
                            .getResponse()
                            .getStatus();
                });
                gate.countDown();
                var codes = new java.util.ArrayList<>(java.util.List.of(
                        first.get(10, java.util.concurrent.TimeUnit.SECONDS),
                        second.get(10, java.util.concurrent.TimeUnit.SECONDS)));
                codes.sort(java.util.Comparator.naturalOrder());
                assertEquals(identical ? java.util.List.of(200, 200) : java.util.List.of(200, 409), codes);
            }
            mvc.perform(get(base(data, id) + "/completion-revisions").with(jwt().jwt(t -> t.subject(owner))))
                    .andExpect(jsonPath("$.length()").value(1));
            assertEquals(3, JsonPath.<Integer>read(detail(data, id), "$.version"));
        } finally {
            cleanup(data[0]);
        }
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void correctionAuditFailureRollsBackTheOutcomeAndVersion() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        try {
            String id = close(data, false);
            String before = detail(data, id);
            org.mockito.Mockito.doThrow(new IllegalStateException("injected correction audit failure"))
                    .when(repository)
                    .appendRevision(
                            org.mockito.ArgumentMatchers.eq(data[0]),
                            org.mockito.ArgumentMatchers.eq(UUID.fromString(id)),
                            org.mockito.ArgumentMatchers.any());
            assertThrows(
                    jakarta.servlet.ServletException.class,
                    () -> correct(data, id, owner, 2, "Fix", "\"partsCost\":\"0\""));
            assertEquals(
                    JsonPath.<Object>read(before, "$.completion"),
                    JsonPath.<Object>read(detail(data, id), "$.completion"));
            assertEquals(2, JsonPath.<Integer>read(detail(data, id), "$.version"));
            mvc.perform(get(base(data, id) + "/completion-revisions").with(jwt().jwt(t -> t.subject(owner))))
                    .andExpect(jsonPath("$.length()").value(0));
        } finally {
            org.mockito.Mockito.reset(repository);
            cleanup(data[0]);
        }
    }

    private void cleanup(UUID estate) {
        for (String table : java.util.List.of(
                "WorkOrderCompletionRevision",
                "WorkOrderCompletion",
                "WorkOrderStatusEvent",
                "WorkOrder",
                "Asset",
                "Location",
                "EstateUser")) db.execute("delete from \"" + table + "\" where \"estateId\"=?", estate);
        db.execute("delete from \"Estate\" where id=?", estate);
    }

    private String create(UUID[] data, boolean linked) throws Exception {
        return JsonPath.read(
                mvc.perform(post(list(data))
                                .with(jwt().jwt(t -> t.subject(owner)))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("""
                {"description":"Review QA","locationId":"%s","category":"CLEANLINESS","priority":"MEDIUM","source":"MANUAL"%s}
                """.formatted(data[1], linked ? ",\"assetId\":\"" + data[2] + "\"" : "")))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(),
                "$.id");
    }

    private String close(UUID[] data, boolean linked) throws Exception {
        String id = create(data, linked);
        mvc.perform(patch(base(data, id) + "/status")
                        .with(jwt().jwt(t -> t.subject(owner)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetStatus\":\"IN_PROGRESS\",\"expectedVersion\":0}"))
                .andExpect(status().isOk());
        mvc.perform(put(base(data, id) + "/completion")
                        .with(jwt().jwt(t -> t.subject(owner)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                {"expectedVersion":1,"findings":"Original findings","workPerformed":"Original repair","labourCost":"12.30","partsCost":"4.70","downtimeMinutes":30}
                """))
                .andExpect(status().isCreated());
        return id;
    }

    private ResultActions correct(UUID[] data, String id, String user, int version, String reason, String fields)
            throws Exception {
        return mvc.perform(patch(base(data, id) + "/completion")
                .with(jwt().jwt(t -> t.subject(user)))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                {"expectedVersion":%d,"correctionReason":"%s","findings":"Corrected findings","workPerformed":"Corrected repair",%s}
                """.formatted(version, reason, fields)));
    }

    private String detail(UUID[] data, String id) throws Exception {
        return mvc.perform(get(base(data, id)).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private void member(UUID estate, String user, String role) {
        db.execute("insert into \"EstateUser\" (\"estateId\",\"userId\",role) values (?,?,?)", estate, user, role);
    }

    private static String list(UUID[] data) {
        return "/estates/" + data[0] + "/work-orders";
    }

    private static String base(UUID[] data, String id) {
        return list(data) + "/" + id;
    }

    private static String assetHistory(UUID[] data) {
        return "/estates/" + data[0] + "/assets/" + data[2] + "/work-order-completions";
    }
}
