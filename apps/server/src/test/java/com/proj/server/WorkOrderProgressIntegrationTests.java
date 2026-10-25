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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://example.authkit.app")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class WorkOrderProgressIntegrationTests {
    @Autowired
    MockMvc mvc;

    @Autowired
    DSLContext db;

    @MockitoBean
    JwtDecoder decoder;

    @MockitoBean
    com.proj.server.workos.WorkOSService workOS;

    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
    com.proj.server.workorder.WorkOrderRepository repository;

    private final String owner = "progress-owner-" + UUID.randomUUID();

    @Test
    void startsUnassignedWorkWithVersionedAuditAndKeepsAStaleRequestFromOverwritingIt() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, false);
        mvc.perform(get(base(data) + "/" + id).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(jsonPath("$.version").value(0));
        progress(data, id, owner, "IN_PROGRESS", 0)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.version").value(1));
        progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isConflict());
        progress(data, id, owner, "IN_PROGRESS", 1).andExpect(status().isOk());
        mvc.perform(get(base(data) + "/" + id + "/status-history").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].toStatus").value("OPEN"))
                .andExpect(jsonPath("$[1].fromStatus").value("OPEN"))
                .andExpect(jsonPath("$[1].toStatus").value("IN_PROGRESS"))
                .andExpect(jsonPath("$[1].changedByUserId").value(owner))
                .andExpect(jsonPath("$[1].changedAt").isNotEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"ASSIGNED", "CLOSED", "UNKNOWN"})
    void preventsAssignmentAndCompletionBypass(String target) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        progress(data, create(data, false), owner, target, 0).andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"CREW", "RESIDENT", "COUNCIL", "MEMBER", "foreign"})
    void deniesProgressAndCompletionToReadOnlyOrForeignMemberships(String role) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, false);
        if (!role.equals("foreign")) member(data[0], "reader", role);
        int expected = role.equals("foreign") ? 404 : 403;
        progress(data, id, "reader", "IN_PROGRESS", 0).andExpect(status().is(expected));
        completion(data, id, "reader", 0, "\"labourCost\":\"0\",\"partsCost\":\"0\",\"downtimeMinutes\":0")
                .andExpect(status().is(expected));
    }

    @Test
    void managerCanCompleteAnAssetOrderWithoutGainingAssetRegisterAccess() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        member(data[0], "manager", "MANAGER");
        member(data[0], "crew", "CREW");
        String id = create(data, true);
        progress(data, id, "manager", "IN_PROGRESS", 0).andExpect(status().isOk());
        completion(data, id, "manager", 1, "\"labourCost\":\"12.30\",\"partsCost\":\"0\",\"downtimeMinutes\":0")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.completion.labourCost").value("12.30"))
                .andExpect(jsonPath("$.completion.partsCost").value("0.00"))
                .andExpect(jsonPath("$.completion.totalCost").value("12.30"))
                .andExpect(jsonPath("$.completion.downtimeMinutes").value(0))
                .andExpect(jsonPath("$.completion.completedByUserId").value("manager"));
        mvc.perform(get(base(data) + "/" + id).with(jwt().jwt(t -> t.subject("crew"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completion.findings").value("Worn seal"));
        mvc.perform(get("/estates/" + data[0] + "/assets/" + data[2]).with(jwt().jwt(t -> t.subject("manager"))))
                .andExpect(status().isNotFound());
        mvc.perform(get(history(data)).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].workOrderId").value(id))
                .andExpect(jsonPath("$[0].completion.totalCost").value("12.30"));
        mvc.perform(get(history(data)).with(jwt().jwt(t -> t.subject("manager"))))
                .andExpect(status().isNotFound());
        assertEquals(0, db.fetchCount(org.jooq.impl.DSL.table("\"AssetEvent\"")));
    }

    @Test
    void assetFreeCompletionPreservesUnknownCostsAndIsIdempotentAfterALostResponse() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, false);
        progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isOk());
        completion(data, id, owner, 1, "\"partsCost\":\"0\"")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.completion.labourCost").isEmpty())
                .andExpect(jsonPath("$.completion.totalCost").isEmpty())
                .andExpect(jsonPath("$.completion.downtimeMinutes").isEmpty());
        completion(data, id, owner, 1, "\"partsCost\":\"0.00\"")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2));
        completion(data, id, owner, 1, "\"partsCost\":\"1\"").andExpect(status().isConflict());
        progress(data, id, owner, "IN_PROGRESS", 2).andExpect(status().isConflict());
        assertEquals(1, db.fetchCount(org.jooq.impl.DSL.table("\"WorkOrderCompletion\"")));
        assertEquals(3, db.fetchCount(org.jooq.impl.DSL.table("\"WorkOrderStatusEvent\"")));
        mvc.perform(get(history(data)).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"-1", "1.001", "abc", "1000000000000", "1e2"})
    void rejectsInvalidMoneyWithoutClosingTheOrder(String money) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, false);
        progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isOk());
        completion(data, id, owner, 1, "\"labourCost\":\"" + money + "\"").andExpect(status().isBadRequest());
        mvc.perform(get(base(data) + "/" + id).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.version").value(1));
    }

    @Test
    void retainsClosedHistoryAndCombinesStatusCategoryPriorityAndReferenceFilters() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String closed = create(data, false);
        create(data, false);
        progress(data, closed, owner, "IN_PROGRESS", 0).andExpect(status().isOk());
        completion(data, closed, owner, 1, "\"labourCost\":\"0\"").andExpect(status().isCreated());
        mvc.perform(get(base(data))
                        .param("status", "CLOSED")
                        .param("category", "CLEANLINESS")
                        .param("priority", "MEDIUM")
                        .param("q", "W0001")
                        .param("limit", "1")
                        .with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(closed));
        mvc.perform(get(base(data)).param("status", "IN_PROGRESS").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(get(base(data)).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(jsonPath("$.items.length()").value(2));
    }

    @Test
    void completionKeepsMovedRetiredAssetHistoryAndDoesNotChangeItsCondition() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, true);
        progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isOk());
        var moved = UUID.randomUUID();
        db.execute(
                "insert into \"Location\" (id,\"estateId\",type,name,\"updatedAt\") values (?,?,'BLOCK','Block B',now())",
                moved,
                data[0]);
        db.execute(
                "update \"Asset\" set \"locationId\"=?,\"retiredOn\"=current_date,\"deactivatedAt\"=now() where id=?",
                moved,
                data[2]);
        completion(data, id, owner, 1, "\"labourCost\":\"0\"").andExpect(status().isCreated());
        assertEquals(0, db.fetchCount(org.jooq.impl.DSL.table("\"AssetAssessment\"")));
        mvc.perform(get(history(data)).with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void rejectsInactiveEstateChangesAndExposesUpdateCapabilityOnlyToActiveManagers() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, false);
        mvc.perform(get("/access/context").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(jsonPath("$.estates[0].canUpdateWorkOrders").value(true));
        db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", data[0]);
        progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isConflict());
        mvc.perform(get("/access/context").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(jsonPath("$.estates[0].canUpdateWorkOrders").value(false));
    }

    @Test
    void validatesRequiredOutcomeAndDowntimeWithoutClosing() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, false);
        progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isOk());
        completion(data, id, owner, 1, "\"downtimeMinutes\":-1").andExpect(status().isBadRequest());
        mvc.perform(put(base(data) + "/" + id + "/completion")
                        .with(jwt().jwt(t -> t.subject(owner)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                {"expectedVersion":1,"findings":"   ","workPerformed":"Repair"}
                """))
                .andExpect(status().isBadRequest());
        assertEquals(0, db.fetchCount(org.jooq.impl.DSL.table("\"WorkOrderCompletion\"")));
    }

    @Test
    void rejectsClosureBeforeStartAndRechecksAuthorizationBeforeAnIdenticalReplay() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, false);
        completion(data, id, owner, 0, "\"partsCost\":\"0\"").andExpect(status().isConflict());
        progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isOk());
        member(data[0], "manager", "MANAGER");
        completion(data, id, "manager", 1, "\"partsCost\":\"0\"").andExpect(status().isCreated());
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='manager'", data[0]);
        completion(data, id, "manager", 1, "\"partsCost\":\"0\"").andExpect(status().isNotFound());
        member(data[0], owner, "RESIDENT");
        progress(data, id, owner, "IN_PROGRESS", 2).andExpect(status().isForbidden());
        completion(data, id, owner, 1, "\"partsCost\":\"0\"").andExpect(status().isForbidden());
    }

    @Test
    void legacyCreationHistoryUsesOriginalCreatorAndTime() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, false);
        db.execute("delete from \"WorkOrderStatusEvent\" where \"workOrderId\"=?::uuid", id);
        db.execute("update \"WorkOrder\" set \"createdAt\"='2025-01-02T03:04:05Z' where id=?::uuid", id);
        mvc.perform(get(base(data) + "/" + id + "/status-history").with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].changedByUserId").value(owner))
                .andExpect(result -> assertEquals(
                        java.time.Instant.parse("2025-01-02T03:04:05Z"),
                        java.time.OffsetDateTime.parse(JsonPath.<String>read(
                                        result.getResponse().getContentAsString(), "$[0].changedAt"))
                                .toInstant()));
    }

    @Test
    void requiresIdentityAndHidesForeignOrdersAndAssets() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, false);
        mvc.perform(patch(base(data) + "/" + id + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetStatus\":\"IN_PROGRESS\",\"expectedVersion\":0}"))
                .andExpect(status().isUnauthorized());
        var other = new DeviceTestData(db).estateWithAsset(owner);
        progress(other, id, owner, "IN_PROGRESS", 0).andExpect(status().isNotFound());
        mvc.perform(get("/estates/" + other[0] + "/assets/" + data[2] + "/work-order-completions")
                        .with(jwt().jwt(t -> t.subject(owner))))
                .andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentClosuresProduceOneCanonicalOutcomeAndOneClosedAudit(boolean identical) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        try {
            String id = create(data, false);
            progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isOk());
            var gate = new java.util.concurrent.CountDownLatch(1);
            try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
                var first = executor.submit(() -> {
                    gate.await();
                    return completion(data, id, owner, 1, "\"partsCost\":\"0\"")
                            .andReturn()
                            .getResponse()
                            .getStatus();
                });
                var second = executor.submit(() -> {
                    gate.await();
                    return completion(data, id, owner, 1, identical ? "\"partsCost\":\"0.00\"" : "\"partsCost\":\"1\"")
                            .andReturn()
                            .getResponse()
                            .getStatus();
                });
                gate.countDown();
                var codes = new java.util.ArrayList<>(java.util.List.of(
                        first.get(10, java.util.concurrent.TimeUnit.SECONDS),
                        second.get(10, java.util.concurrent.TimeUnit.SECONDS)));
                codes.sort(java.util.Comparator.naturalOrder());
                assertEquals(identical ? java.util.List.of(200, 201) : java.util.List.of(201, 409), codes);
            }
            assertEquals(
                    1,
                    db.fetchOne("select count(*) from \"WorkOrderCompletion\" where \"workOrderId\"=?::uuid", id)
                            .get(0, Integer.class));
            assertEquals(
                    3,
                    db.fetchOne("select count(*) from \"WorkOrderStatusEvent\" where \"workOrderId\"=?::uuid", id)
                            .get(0, Integer.class));
        } finally {
            cleanup(data[0]);
        }
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void auditFailureRollsBackCompletionAndStatusTogether() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        try {
            String id = create(data, false);
            progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isOk());
            org.mockito.Mockito.doThrow(new IllegalStateException("injected audit failure"))
                    .when(repository)
                    .appendStatus(
                            org.mockito.ArgumentMatchers.eq(UUID.fromString(id)),
                            org.mockito.ArgumentMatchers.eq(data[0]),
                            org.mockito.ArgumentMatchers.eq(com.proj.server.workorder.WorkOrderStatus.IN_PROGRESS),
                            org.mockito.ArgumentMatchers.eq(com.proj.server.workorder.WorkOrderStatus.CLOSED),
                            org.mockito.ArgumentMatchers.anyString(),
                            org.mockito.ArgumentMatchers.nullable(String.class),
                            org.mockito.ArgumentMatchers.any(),
                            org.mockito.ArgumentMatchers.eq(2));
            assertThrows(
                    jakarta.servlet.ServletException.class,
                    () -> completion(data, id, owner, 1, "\"partsCost\":\"0\""));
            assertEquals(
                    0,
                    db.fetchOne("select count(*) from \"WorkOrderCompletion\" where \"workOrderId\"=?::uuid", id)
                            .get(0, Integer.class));
            mvc.perform(get(base(data) + "/" + id).with(jwt().jwt(t -> t.subject(owner))))
                    .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                    .andExpect(jsonPath("$.version").value(1));
        } finally {
            org.mockito.Mockito.reset(repository);
            cleanup(data[0]);
        }
    }

    @Test
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void simultaneousStartsCannotDuplicateProgressAudit() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        try {
            String id = create(data, false);
            var gate = new java.util.concurrent.CountDownLatch(1);
            try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
                java.util.concurrent.Callable<Integer> start = () -> {
                    gate.await();
                    return progress(data, id, owner, "IN_PROGRESS", 0)
                            .andReturn()
                            .getResponse()
                            .getStatus();
                };
                var first = executor.submit(start);
                var second = executor.submit(start);
                gate.countDown();
                var codes = new java.util.ArrayList<>(java.util.List.of(
                        first.get(10, java.util.concurrent.TimeUnit.SECONDS),
                        second.get(10, java.util.concurrent.TimeUnit.SECONDS)));
                codes.sort(java.util.Comparator.naturalOrder());
                assertEquals(java.util.List.of(200, 409), codes);
            }
            assertEquals(
                    2,
                    db.fetchOne("select count(*) from \"WorkOrderStatusEvent\" where \"workOrderId\"=?::uuid", id)
                            .get(0, Integer.class));
        } finally {
            cleanup(data[0]);
        }
    }

    @ParameterizedTest
    @org.junit.jupiter.params.provider.CsvSource({
        "start,membership,404",
        "close,membership,404",
        "start,estate,409",
        "close,estate,409",
        "close,demotion,403"
    })
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void rechecksAuthorityAfterWaitingForTheEstateLock(String operation, String change, int expected) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        try {
            String id = create(data, false);
            member(data[0], "queued-manager", "MANAGER");
            if (operation.equals("close"))
                progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isOk());
            try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
                var request = db.transactionResult(configuration -> {
                    var locked = org.jooq.impl.DSL.using(configuration);
                    locked.fetch("select id from \"Estate\" where id=? for update", data[0]);
                    var blocker = locked.fetchValue("select pg_backend_pid()", Integer.class);
                    var pending = executor.submit(() -> (operation.equals("close")
                                    ? completion(data, id, "queued-manager", 1, "\"partsCost\":\"0\"")
                                    : progress(data, id, "queued-manager", "IN_PROGRESS", 0))
                            .andReturn()
                            .getResponse()
                            .getStatus());
                    boolean waiting = false;
                    var deadline = java.time.Instant.now().plusSeconds(5);
                    while (!pending.isDone() && java.time.Instant.now().isBefore(deadline)) {
                        waiting = Boolean.TRUE.equals(locked.fetchOne(
                                        "select exists(select 1 from pg_stat_activity where ? = any(pg_blocking_pids(pid)))",
                                        blocker)
                                .get(0, Boolean.class));
                        if (waiting) break;
                    }
                    assertTrue(waiting, "Work-order writes must wait for the estate lock");
                    switch (change) {
                        case "membership" ->
                            locked.execute(
                                    "delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='queued-manager'",
                                    data[0]);
                        case "demotion" ->
                            locked.execute(
                                    "update \"EstateUser\" set role='CREW' where \"estateId\"=? and \"userId\"='queued-manager'",
                                    data[0]);
                        case "estate" ->
                            locked.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", data[0]);
                        default -> throw new IllegalArgumentException(change);
                    }
                    return pending;
                });
                assertEquals(expected, request.get(10, java.util.concurrent.TimeUnit.SECONDS));
                assertEquals(
                        0,
                        db.fetchOne("select count(*) from \"WorkOrderCompletion\" where \"workOrderId\"=?::uuid", id)
                                .get(0, Integer.class));
                assertEquals(
                        operation.equals("close") ? 1 : 0,
                        db.fetchOne("select version from \"WorkOrder\" where id=?::uuid", id)
                                .get(0, Integer.class));
            }
        } finally {
            cleanup(data[0]);
        }
    }

    @Test
    void closureRetainsSourceReportAndAssetStateWithoutCreatingForecastEvents() throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        member(data[0], owner, "MANAGER");
        var report = UUID.randomUUID();
        db.execute(
                "insert into \"IssueReport\" (id,\"estateId\",\"locationId\",\"submittedByUserId\",title,description,\"updatedAt\") values (?,?,?,'resident','Leak','Water pooling',now())",
                report,
                data[0],
                data[1]);
        var beforeReport =
                db.fetchOne("select * from \"IssueReport\" where id=?", report).intoMap();
        var beforeAsset =
                db.fetchOne("select * from \"Asset\" where id=?", data[2]).intoMap();
        var response = mvc.perform(post(base(data))
                        .with(jwt().jwt(t -> t.subject(owner)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
            {"description":"Repair","locationId":"%s","assetId":"%s","category":"EQUIPMENT_FAULT","priority":"MEDIUM","source":"RESIDENT_REPORT","sourceReportId":"%s","expectedSourceLocationId":"%s"}
            """.formatted(data[1], data[2], report, data[1])))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String id = JsonPath.read(response, "$.id");
        progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isOk());
        completion(data, id, owner, 1, "\"labourCost\":\"0\"").andExpect(status().isCreated());
        assertEquals(
                beforeReport,
                db.fetchOne("select * from \"IssueReport\" where id=?", report).intoMap());
        assertEquals(
                beforeAsset,
                db.fetchOne("select * from \"Asset\" where id=?", data[2]).intoMap());
        assertEquals(0, db.fetchCount(org.jooq.impl.DSL.table("\"AssetEvent\"")));
    }

    @ParameterizedTest
    @ValueSource(strings = {"version", "completion-version", "downtime"})
    void rejectsFractionalMinutesAndVersionsInsteadOfTruncatingThem(String field) throws Exception {
        var data = new DeviceTestData(db).estateWithAsset(owner);
        String id = create(data, false);
        if (field.equals("version")) {
            mvc.perform(patch(base(data) + "/" + id + "/status")
                            .with(jwt().jwt(t -> t.subject(owner)))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"targetStatus\":\"IN_PROGRESS\",\"expectedVersion\":0.5}"))
                    .andExpect(status().isBadRequest());
        } else {
            progress(data, id, owner, "IN_PROGRESS", 0).andExpect(status().isOk());
            if (field.equals("completion-version")) {
                mvc.perform(
                                put(base(data) + "/" + id + "/completion")
                                        .with(jwt().jwt(t -> t.subject(owner)))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"expectedVersion\":1.5,\"findings\":\"Worn seal\",\"workPerformed\":\"Replaced seal\"}"))
                        .andExpect(status().isBadRequest());
            } else {
                completion(data, id, owner, 1, "\"downtimeMinutes\":1.5").andExpect(status().isBadRequest());
            }
        }
        assertEquals(0, db.fetchCount(org.jooq.impl.DSL.table("\"WorkOrderCompletion\"")));
    }

    private void cleanup(UUID estate) {
        db.execute("delete from \"WorkOrderCompletion\" where \"estateId\"=?", estate);
        db.execute("delete from \"WorkOrderStatusEvent\" where \"estateId\"=?", estate);
        db.execute("delete from \"WorkOrder\" where \"estateId\"=?", estate);
        db.execute("delete from \"Asset\" where \"estateId\"=?", estate);
        db.execute("delete from \"Location\" where \"estateId\"=?", estate);
        db.execute("delete from \"EstateUser\" where \"estateId\"=?", estate);
        db.execute("delete from \"Estate\" where id=?", estate);
    }

    private String create(UUID[] data, boolean linked) throws Exception {
        var response = mvc.perform(post(base(data))
                        .with(jwt().jwt(t -> t.subject(owner)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                {"description":"Repair","locationId":"%s","category":"CLEANLINESS","priority":"MEDIUM","source":"MANUAL"%s}
                """.formatted(data[1], linked ? ",\"assetId\":\"" + data[2] + "\"" : "")))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(response, "$.id");
    }

    private ResultActions progress(UUID[] data, String id, String user, String target, int version) throws Exception {
        return mvc.perform(patch(base(data) + "/" + id + "/status")
                .with(jwt().jwt(t -> t.subject(user)))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetStatus\":\"" + target + "\",\"expectedVersion\":" + version + "}"));
    }

    private ResultActions completion(UUID[] data, String id, String user, int version, String fields) throws Exception {
        return mvc.perform(put(base(data) + "/" + id + "/completion")
                .with(jwt().jwt(t -> t.subject(user)))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                {"expectedVersion":%d,"findings":"Worn seal","workPerformed":"Replaced seal",%s}
                """.formatted(version, fields)));
    }

    private void member(UUID estate, String user, String role) {
        db.execute("insert into \"EstateUser\" (\"estateId\",\"userId\",role) values (?,?,?)", estate, user, role);
    }

    private static String base(UUID[] data) {
        return "/estates/" + data[0] + "/work-orders";
    }

    private static String history(UUID[] data) {
        return "/estates/" + data[0] + "/assets/" + data[2] + "/work-order-completions";
    }
}
