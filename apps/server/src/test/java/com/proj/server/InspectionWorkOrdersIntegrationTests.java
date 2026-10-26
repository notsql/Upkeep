package com.proj.server;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

class InspectionWorkOrdersIntegrationTests extends InspectionTestSupport {
    @ParameterizedTest
    @ValueSource(strings = {"OWNER", "MANAGER"})
    void failureIsSavedBeforeHandoffAndOneLinkedOrderResolvesFollowUp(String role) throws Exception {
        var data = asset();
        String user = role.equals("OWNER") ? OWNER : "responder";
        if (!role.equals("OWNER")) member(data[0], user, role);
        var result = save(data, user, "FAIL")
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String inspectionId = id(result);
        // Refreshing after cancellation still exposes the failure; no order is auto-created.
        assertEquals(0, count("WorkOrder", data[0]));
        read(inspections(data) + "/" + inspectionId, user)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("FAIL"))
                .andExpect(jsonPath("$.workOrder").isEmpty());
        var order = convert(data, user, inspectionId, data[1])
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("OPEN"))
                .andExpect(jsonPath("$.source").value("INSPECTION"))
                .andExpect(jsonPath("$.sourceInspectionId").value(inspectionId))
                .andExpect(jsonPath("$.assetId").value(data[2].toString()))
                .andExpect(jsonPath("$.locationId").value(data[1].toString()))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String reference = JsonPath.read(order, "$.reference");
        for (String url : List.of(inspections(data) + "/" + inspectionId, inspections(data))) {
            String prefix = url.equals(inspections(data)) ? "$.items[0]" : "$";
            read(url, user)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath(prefix + ".outcome").value("FAIL"))
                    .andExpect(jsonPath(prefix + ".workOrder.id").value(id(order)))
                    .andExpect(jsonPath(prefix + ".workOrder.reference").value(reference));
        }
        convert(data, user, inspectionId, data[1])
                .andExpect(status().isConflict())
                .andExpect(content().string(containsString(reference)));
        assertEquals(1, count("WorkOrder", data[0]));
    }

    @Test
    void passCannotBeConvertedAndAnInvalidOrderLeavesTheFailureSaved() throws Exception {
        var data = asset();
        String pass = id(saved(data, "PASS"));
        convert(data, OWNER, pass, data[1]).andExpect(status().isBadRequest());
        String fail = id(saved(data, "FAIL"));
        mvc.perform(post(orderPath(data))
                        .with(jwt().jwt(t -> t.subject(OWNER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(orderBody(data, fail, data[1]).replace("EQUIPMENT_FAULT", "SAFETY")))
                .andExpect(status().isBadRequest());
        assertEquals(0, count("WorkOrder", data[0]));
        read(inspections(data) + "/" + fail, OWNER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workOrder").isEmpty())
                .andExpect(jsonPath("$.outcome").value("FAIL"));
    }

    @Test
    void forgedSourcesAndAssetsCannotCrossEstatesEvenWithOwnershipOfBoth() throws Exception {
        var data = asset();
        var foreign = asset();
        String fail = id(saved(data, "FAIL"));
        String foreignFail = id(saved(foreign, "FAIL"));
        convert(data, OWNER, foreignFail, data[1]).andExpect(status().isNotFound());
        convert(data, OWNER, UUID.randomUUID().toString(), data[1]).andExpect(status().isNotFound());
        var wrongAsset = new UUID[] {data[0], data[1], new DeviceTestData(db).asset(data[0], data[1])};
        convert(wrongAsset, OWNER, fail, data[1]).andExpect(status().isBadRequest());
        convert(new UUID[] {data[0], data[1], foreign[2]}, OWNER, fail, data[1]).andExpect(status().isNotFound());
        assertEquals(0, count("WorkOrder", data[0]));
    }

    @ParameterizedTest
    @ValueSource(strings = {"MANUAL", "RESIDENT_REPORT", "MAINTENANCE_RECOMMENDATION", "MIXED"})
    void sourceIdsCannotBeMixedOrAttachedToAnUnrelatedSource(String source) throws Exception {
        var data = asset();
        String fail = id(saved(data, "FAIL"));
        String body = orderBody(data, fail, data[1]);
        body = source.equals("MIXED")
                ? body.replace(
                        "\"sourceInspectionId\":",
                        "\"sourceReportId\":\"" + UUID.randomUUID() + "\",\"sourceInspectionId\":")
                : body.replace("INSPECTION", source);
        mvc.perform(post(orderPath(data))
                        .with(jwt().jwt(t -> t.subject(OWNER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
        assertEquals(0, count("WorkOrder", data[0]));
    }

    @Test
    void movedAssetsRequireReviewOfTheCurrentLocationAndNeverRewriteTheInspection() throws Exception {
        var data = asset();
        String fail = id(saved(data, "FAIL"));
        var originalLocation = data[1];
        var current = location(data[0], "Block B");
        db.execute("update \"Asset\" set \"locationId\"=? where id=?", current, data[2]);
        convert(data, OWNER, fail, originalLocation).andExpect(status().isConflict());
        data[1] = current;
        convert(data, OWNER, fail, originalLocation).andExpect(status().isConflict());
        convert(data, OWNER, fail, current)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.locationId").value(current.toString()));
        read(inspections(data) + "/" + fail, OWNER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locationId").value(originalLocation.toString()))
                .andExpect(jsonPath("$.locationPath").value("Block A"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"retirement", "revocation", "inactive-estate"})
    void lossOfWriteAuthorityDuringHandoffKeepsTheFailureWithoutAnOrder(String change) throws Exception {
        var data = asset();
        member(data[0], "manager", "MANAGER");
        String fail = id(saved(data, "FAIL"));
        switch (change) {
            case "retirement" ->
                db.execute(
                        "update \"Asset\" set \"deactivatedAt\"=now(),\"retiredOn\"=current_date,\"retirementReason\"='Retired' where id=?",
                        data[2]);
            case "revocation" ->
                db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='manager'", data[0]);
            case "inactive-estate" -> db.execute("update \"Estate\" set \"deactivatedAt\"=now() where id=?", data[0]);
            default -> throw new IllegalArgumentException(change);
        }
        convert(data, "manager", fail, data[1]).andExpect(status().is(change.equals("revocation") ? 404 : 409));
        read(inspections(data) + "/" + fail, OWNER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("FAIL"))
                .andExpect(jsonPath("$.workOrder").isEmpty());
        assertEquals(0, count("WorkOrder", data[0]));
    }

    @Test
    void completingALinkedOrderDoesNotChangeTheHistoricalFail() throws Exception {
        var data = asset();
        String fail = id(saved(data, "FAIL"));
        String orderId = id(convert(data, OWNER, fail, data[1])
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString());
        mvc.perform(patch(orderPath(data) + "/" + orderId + "/status")
                        .with(jwt().jwt(t -> t.subject(OWNER)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetStatus\":\"IN_PROGRESS\",\"expectedVersion\":0}"))
                .andExpect(status().isOk());
        mvc.perform(
                        put(orderPath(data) + "/" + orderId + "/completion")
                                .with(jwt().jwt(t -> t.subject(OWNER)))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"expectedVersion\":1,\"findings\":\"Worn seal\",\"workPerformed\":\"Replaced seal\"}"))
                .andExpect(status().isCreated());
        read(inspections(data) + "/" + fail, OWNER)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("FAIL"))
                .andExpect(jsonPath("$.workOrder.id").value(orderId));
        saved(data, "PASS");
        assertEquals(2, count("AssetInspectionResult", data[0]));
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentConversionsCreateExactlyOneWorkOrderAndReturnAConflictToTheLoser() throws Exception {
        var data = asset();
        try {
            String fail = id(saved(data, "FAIL"));
            var ready = new CountDownLatch(2);
            var start = new CountDownLatch(1);
            try (var requests = Executors.newVirtualThreadPerTaskExecutor()) {
                var futures = java.util.stream.IntStream.range(0, 2)
                        .mapToObj(i -> requests.submit(() -> {
                            ready.countDown();
                            assertTrue(start.await(5, TimeUnit.SECONDS));
                            return convert(data, OWNER, fail, data[1])
                                    .andReturn()
                                    .getResponse();
                        }))
                        .toList();
                try {
                    assertTrue(ready.await(5, TimeUnit.SECONDS));
                } finally {
                    start.countDown();
                }
                var responses = List.of(
                        futures.get(0).get(10, TimeUnit.SECONDS), futures.get(1).get(10, TimeUnit.SECONDS));
                assertEquals(
                        List.of(201, 409),
                        responses.stream().map(r -> r.getStatus()).sorted().toList());
                assertEquals(1, count("WorkOrder", data[0]));
                read(inspections(data) + "/" + fail, OWNER)
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.workOrder.id").isString());
            }
        } finally {
            cleanup(data[0]);
        }
    }

    private ResultActions convert(UUID[] data, String user, String inspection, UUID observedLocation) throws Exception {
        return mvc.perform(post(orderPath(data))
                .with(jwt().jwt(t -> t.subject(user)))
                .contentType(MediaType.APPLICATION_JSON)
                .content(orderBody(data, inspection, observedLocation)));
    }

    private static String orderPath(UUID[] data) {
        return "/estates/" + data[0] + "/work-orders";
    }

    private static String orderBody(UUID[] data, String inspection, UUID observedLocation) {
        return """
                {"description":"Repair seal","locationId":"%s","assetId":"%s","category":"EQUIPMENT_FAULT",
                "priority":"HIGH","source":"INSPECTION","sourceInspectionId":"%s","expectedSourceLocationId":"%s"}
                """.formatted(data[1], data[2], inspection, observedLocation);
    }
}
