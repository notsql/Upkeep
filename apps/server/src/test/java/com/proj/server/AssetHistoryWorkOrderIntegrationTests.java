package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;

/** Complete real API workflows so timeline tests cannot invent an unsupported order status. */
class AssetHistoryWorkOrderIntegrationTests extends AssetHistoryTestSupport {
    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager"})
    void completingALinkedWorkOrderAddsItsCanonicalOutcomeToOwnerAndCouncilHistory(String actor) throws Exception {
        var order = createOrder(true);
        assertTrue(page("owner", history(assetId)).path("items").isEmpty());
        start(actor, order);
        assertTrue(page("member", history(assetId)).path("items").isEmpty());
        var closed = body(send(actor, put(orderPath(order) + "/completion"), outcome(1))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("CLOSED")));
        var completed = closed.path("completion");

        for (var reader : List.of("owner", "member")) {
            var result = body(read(reader, get(history(assetId)))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Cache-Control", "private, no-store"))
                    .andExpect(jsonPath("$.items.length()").value(1)));
            var entry = result.path("items").get(0);
            assertEquals("WORK_ORDER_COMPLETED", entry.path("kind").asText());
            assertEquals(completed.path("id"), entry.path("sourceId"));
            assertEquals(order.path("id"), entry.path("details").path("workOrderId"));
            assertEquals("Work order completed", entry.path("title").asText());
            assertEquals(
                    "Replaced seal", entry.path("details").path("workPerformed").asText());
            assertEquals("12.30", entry.path("details").path("totalCost").asText());
            assertEquals(
                    timestamp(completed.path("completedAt")).toInstant(),
                    timestamp(entry.path("occurredAt")).toInstant());
            assertEquals(
                    reader.equals("owner"),
                    entry.path("details").path("canViewWorkOrder").asBoolean());
        }
    }

    @Test
    void completionReplayAndCorrectionRetainOneHistoryEntryAtItsOriginalCompletionDate() throws Exception {
        var order = createOrder(true);
        start("owner", order);
        var closed = body(
                send("owner", put(orderPath(order) + "/completion"), outcome(1)).andExpect(status().isCreated()));
        var before = body(read("owner", get(history(assetId)))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.items.length()").value(1)))
                .path("items")
                .get(0);
        send("owner", put(orderPath(order) + "/completion"), outcome(1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.completion.id")
                        .value(closed.path("completion").path("id").asText()));

        var correction = new HashMap<>(outcome(2));
        correction.put("correctionReason", "Corrected the work description");
        correction.put("workPerformed", "Replaced seal and tested pump");
        send("manager", patch(orderPath(order) + "/completion"), correction).andExpect(status().isOk());
        var day = timestamp(closed.path("completion").path("completedAt"))
                .atZoneSameInstant(ZoneId.of("Asia/Singapore"))
                .toLocalDate()
                .toString();
        var after = body(read("member", get(history(assetId)).param("from", day).param("to", day))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.items.length()").value(1)))
                .path("items")
                .get(0);
        assertEquals(before.path("id"), after.path("id"));
        assertEquals(before.path("occurredAt"), after.path("occurredAt"));
        assertEquals(
                "Replaced seal and tested pump",
                after.path("details").path("workPerformed").asText());
        assertFalse(after.path("details").path("editedAt").isNull());
    }

    @Test
    void completingAnOrderWithoutAnAssetDoesNotInventHistoryForAssetsAtItsLocation() throws Exception {
        var order = createOrder(false);
        start("owner", order);
        send("owner", put(orderPath(order) + "/completion"), outcome(1))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("CLOSED"));
        assertTrue(page("owner", history(assetId)).path("items").isEmpty());
    }

    @Test
    void rejectedCompletionDoesNotAddAHistoryEntry() throws Exception {
        var order = createOrder(true);
        send("owner", put(orderPath(order) + "/completion"), outcome(0)).andExpect(status().isConflict());
        assertTrue(page("member", history(assetId)).path("items").isEmpty());
    }

    private JsonNode createOrder(boolean linked) throws Exception {
        var request = new HashMap<String, Object>();
        request.put("description", "Repair pump");
        request.put("locationId", locationId);
        request.put("category", "EQUIPMENT_FAULT");
        request.put("priority", "MEDIUM");
        request.put("source", "MANUAL");
        if (linked) request.put("assetId", assetId);
        return body(send("owner", post(path() + "/work-orders"), request).andExpect(status().isCreated()));
    }

    private void start(String actor, JsonNode order) throws Exception {
        send(actor, patch(orderPath(order) + "/status"), Map.of("expectedVersion", 0, "targetStatus", "IN_PROGRESS"))
                .andExpect(status().isOk());
    }

    private String orderPath(JsonNode order) {
        return path() + "/work-orders/" + order.path("id").asText();
    }

    private static Map<String, Object> outcome(int version) {
        return Map.of(
                "expectedVersion",
                version,
                "findings",
                "Worn seal",
                "workPerformed",
                "Replaced seal",
                "labourCost",
                "12.30",
                "partsCost",
                "0",
                "downtimeMinutes",
                0);
    }
}
