package com.proj.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.proj.server.document.DocumentStore;
import com.proj.server.workorder.WorkOrderStatus;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;

/** Tests the agreed HTTP contract before history DTOs and generated API types exist. */
abstract class AssetHistoryTestSupport extends CustomEstateRoleTestSupport {
    static final String RECORDED_AT = "2026-10-15T04:00:00Z";

    @MockitoBean
    DocumentStore storage;

    UUID assetId;
    UUID locationId;

    @BeforeEach
    void historyAssetAndReaders() {
        locationId = location(estateId, "BLOCK", null, "Block A", null);
        assetId = asset(estateId, locationId, "E-A0001", "Water pump");
        member(estateId, "crew", "CREW");
        member(estateId, "resident", "RESIDENT");
        member(estateId, "legacy-member", "MEMBER");
    }

    UUID asset(UUID estate, UUID location, String reference, String name) {
        var id = UUID.randomUUID();
        db.execute("""
                insert into "Asset" (id, "estateId", "locationId", reference, name, category, "updatedAt")
                values (?, ?, ?, ?, ?, 'PUMP', now())
                """, id, estate, location, reference, name);
        return id;
    }

    UUID maintenance(UUID id, UUID asset, String type, String date) {
        db.execute("""
                insert into "AssetEvent"
                (id, "estateId", "assetId", type, "occurredOn", notes, "recordedByUserId", "createdAt")
                values (?, ?, ?, ?, ?::date, 'Replaced worn seal', 'owner', ?::timestamptz)
                """, id, estateId, asset, type, date, RECORDED_AT);
        return id;
    }

    UUID assessment(String origin, String date) {
        var id = UUID.randomUUID();
        db.execute(
                """
                insert into "AssetAssessment"
                (id, "estateId", "assetId", condition, "assessedOn", notes, "recordedByUserId", "recordedByName", "createdAt")
                values (?, ?, ?, 'NEEDS_ATTENTION', ?::date, 'Vibration increased', ?, ?, ?::timestamptz)
                """,
                id,
                estateId,
                assetId,
                date,
                origin.equals("ANOMALY_MODEL") ? "system:anomaly-model" : "owner",
                origin.equals("ANOMALY_MODEL") ? "Anomaly detection" : "Casey Doe",
                RECORDED_AT);
        return id;
    }

    UUID inspection(String date) {
        var id = UUID.randomUUID();
        db.execute("""
                insert into "AssetInspectionResult"
                (id, "estateId", "assetId", "locationId", "locationPath", outcome, "inspectedOn", notes, "recordedByUserId", "createdAt")
                values (?, ?, ?, ?, 'Block A', 'FAIL', ?::date, 'Seal leaking', 'owner', ?::timestamptz)
                """, id, estateId, assetId, locationId, date, RECORDED_AT);
        return id;
    }

    UUID workOrder(UUID estate, UUID asset, UUID location) {
        var id = UUID.randomUUID();
        db.execute("""
                insert into "WorkOrder"
                (id, "estateId", reference, description, "locationId", "assetId", category, priority, source, "createdByUserId", "updatedAt")
                values (?, ?, ?, 'Repair pump', ?, ?, 'EQUIPMENT_FAULT', 'MEDIUM', 'MANUAL', 'owner', now())
                """, id, estate, "WO-" + id, location, asset);
        return id;
    }

    UUID completion(UUID order, String time) {
        var id = UUID.randomUUID();
        db.execute("update \"WorkOrder\" set status=? where id=?", WorkOrderStatus.CLOSED.name(), order);
        db.execute("""
                insert into "WorkOrderCompletion"
                (id, "estateId", "workOrderId", findings, "workPerformed", "completedByUserId", "completedAt")
                values (?, ?, ?, 'Seal worn', 'Replaced seal', 'owner', ?::timestamptz)
                """, id, estateId, order, time);
        return id;
    }

    UUID lifecycle(String action, int version, String time) {
        var id = UUID.randomUUID();
        db.execute("""
                insert into "AssetLifecycleEvent"
                (id, "estateId", "assetId", action, "occurredAt", "actorUserId", "retiredOn", "retirementReason", "lifecycleVersion")
                values (?, ?, ?, ?, ?::timestamptz, 'owner', '2026-09-01', 'Beyond economical repair', ?)
                """, id, estateId, assetId, action, time, version);
        return id;
    }

    UUID document(String type, UUID directAsset, UUID order, String uploadedAt) {
        var id = UUID.randomUUID();
        db.execute(
                """
                insert into "Document"
                (id, "estateId", "documentType", "originalFilename", "contentType", "sizeBytes", "storageKey", "uploadedByUserId", "createdAt", "assetId", "workOrderId")
                values (?, ?, ?, 'report.pdf', 'application/pdf', ?, ?, 'owner', ?::timestamptz, ?, ?)
                """,
                id,
                estateId,
                type,
                DocumentTestSupport.pdf().length,
                "documents/" + id,
                uploadedAt,
                directAsset,
                order);
        return id;
    }

    String history(UUID asset) {
        return path() + "/assets/" + asset + "/history";
    }

    String historyAssets() {
        return path() + "/asset-history";
    }

    ResultActions read(String user, MockHttpServletRequestBuilder request) throws Exception {
        return mvc.perform(as(user, request));
    }

    JsonNode page(String user, String path) throws Exception {
        return body(read(user, get(path))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store")));
    }

    static List<String> values(JsonNode items, String field) {
        var result = new ArrayList<String>();
        for (var item : items) result.add(item.path(field).asText());
        return result;
    }

    static OffsetDateTime timestamp(JsonNode node) {
        return OffsetDateTime.parse(node.asText());
    }
}
