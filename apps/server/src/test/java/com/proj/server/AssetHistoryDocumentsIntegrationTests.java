package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class AssetHistoryDocumentsIntegrationTests extends AssetHistoryTestSupport {
    @Test
    void unionsDirectAndWorkOrderDocumentsAndDeduplicatesByUuidBeforePageLimits() throws Exception {
        UUID order = workOrder(estateId, assetId, locationId);
        UUID both = document("INVOICE", assetId, order, "2026-08-01T02:00:00Z");
        UUID direct = document("INVOICE", assetId, null, "2026-07-01T02:00:00Z");
        UUID indirect = document("SERVICE_REPORT", null, order, "2026-06-01T02:00:00Z");
        UUID deleted = document("INVOICE", assetId, null, "2026-09-01T02:00:00Z");
        db.execute("update \"Document\" set \"deletedAt\"=now(), \"deletedByUserId\"='owner' where id=?", deleted);
        document("INVOICE", null, null, "2026-10-01T02:00:00Z");
        UUID other = asset(estateId, locationId, "E-A0002", "Other pump");
        UUID otherOrder = workOrder(estateId, other, locationId);
        document("SERVICE_REPORT", other, otherOrder, "2026-10-01T02:00:00Z");
        var first =
                body(read("member", get(history(assetId)).param("limit", "2")).andExpect(status().isOk()));
        assertEquals(List.of(both.toString(), direct.toString()), values(first.path("items"), "sourceId"));
        var last = body(read(
                        "member",
                        get(history(assetId))
                                .param("limit", "2")
                                .param("cursor", first.path("nextCursor").asText()))
                .andExpect(status().isOk()));
        assertEquals(List.of(indirect.toString()), values(last.path("items"), "sourceId"));
        assertTrue(last.path("nextCursor").isNull());
    }

    @Test
    void identicalFilenamesAndUploadTimesRemainDistinctInvoiceAndServiceReportEvents() throws Exception {
        UUID invoice = document("INVOICE", assetId, null, "2026-07-01T02:00:00Z");
        UUID report = document("SERVICE_REPORT", assetId, null, "2026-07-01T02:00:00Z");
        var items = page("member", history(assetId)).path("items");
        assertEquals(List.of(report.toString(), invoice.toString()), values(items, "sourceId"));
        assertEquals(List.of("Service report uploaded", "Invoice uploaded"), values(items, "title"));
        assertNotEquals(items.get(0).path("id"), items.get(1).path("id"));
        String json = items.toString();
        assertTrue(json.contains("report.pdf"));
        assertFalse(json.contains("storageKey"));
        assertFalse(json.contains("uploadedByUserId"));
        assertFalse(json.contains("documents/"));
    }

    @Test
    void linkChangesUseOriginalUploadTimeAndRetainTheDocumentUntilBothPathsAreRemoved() throws Exception {
        UUID repair = maintenance(UUID.randomUUID(), assetId, "BREAKDOWN_REPAIR", "2026-03-01");
        UUID order = workOrder(estateId, assetId, locationId);
        UUID document = document("INVOICE", null, null, "2026-01-01T02:00:00Z");
        assertEquals(
                List.of(repair.toString()),
                values(page("owner", history(assetId)).path("items"), "sourceId"));
        changeAsset(document, assetId, 0);
        send(
                        "owner",
                        put(path() + "/documents/" + document + "/work-order"),
                        Map.of("workOrderId", order, "expectedAssociationVersion", 0))
                .andExpect(status().isOk());
        var linked = page("owner", history(assetId)).path("items");
        assertEquals(List.of(repair.toString(), document.toString()), values(linked, "sourceId"));
        assertEquals(
                Instant.parse("2026-01-01T02:00:00Z"),
                timestamp(linked.get(1).path("occurredAt")).toInstant());
        changeAsset(document, null, 1);
        assertEquals(
                values(linked, "id"), values(page("owner", history(assetId)).path("items"), "id"));
        var unlink = new LinkedHashMap<String, Object>();
        unlink.put("workOrderId", null);
        unlink.put("expectedAssociationVersion", 1);
        unlink.put("correctionReason", "Uploaded against the wrong work order");
        send("owner", put(path() + "/documents/" + document + "/work-order"), unlink)
                .andExpect(status().isOk());
        assertEquals(
                List.of(repair.toString()),
                values(page("owner", history(assetId)).path("items"), "sourceId"));
        changeAsset(document, assetId, 2);
        assertEquals(
                values(linked, "id"), values(page("owner", history(assetId)).path("items"), "id"));
        assertEquals(
                1,
                db.fetchOne("select count(*) from \"AssetEvent\" where \"assetId\"=?", assetId)
                        .get(0, Integer.class));
    }

    @Test
    void reassociationRefreshesFormerAndNewAssetHistoryWithoutMovingTheUpload() throws Exception {
        UUID other = asset(estateId, locationId, "E-A0002", "Other pump");
        UUID document = document("SERVICE_REPORT", assetId, null, "2026-01-01T02:00:00Z");
        var entry = page("owner", history(assetId)).path("items").get(0);
        changeAsset(document, null, 0);
        changeAsset(document, other, 1);
        assertTrue(page("owner", history(assetId)).path("items").isEmpty());
        var moved = page("owner", history(other)).path("items").get(0);
        assertEquals(entry.path("id"), moved.path("id"));
        assertEquals(entry.path("occurredAt"), moved.path("occurredAt"));
    }

    @Test
    void deletedDocumentsDisappearFromHistoryAndCannotBeOpenedThroughAnEarlierEntry() throws Exception {
        UUID document = document("INVOICE", assetId, null, "2026-01-01T02:00:00Z");
        assertEquals(
                List.of(document.toString()),
                values(page("member", history(assetId)).path("items"), "sourceId"));
        db.execute("update \"Document\" set \"deletedAt\"=now(), \"deletedByUserId\"='owner' where id=?", document);
        assertTrue(page("member", history(assetId)).path("items").isEmpty());
        read("member", get(path() + "/documents/" + document + "/content"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void metadataRemainsReadableDuringStorageOutageAndTheAuthenticatedFileCanBeRetried() throws Exception {
        UUID document = document("INVOICE", assetId, null, "2026-01-01T02:00:00Z");
        when(storage.read(anyString()))
                .thenThrow(new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE, "Document storage is temporarily unavailable."));
        assertEquals(
                List.of(document.toString()),
                values(page("member", history(assetId)).path("items"), "sourceId"));
        String contentPath = path() + "/documents/" + document + "/content";
        read("member", get(contentPath))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").isNotEmpty());
        doReturn(DocumentTestSupport.pdf()).when(storage).read(anyString());
        read("member", get(contentPath))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(content().contentType("application/pdf"))
                .andExpect(content().bytes(DocumentTestSupport.pdf()));
        assertEquals(
                List.of(document.toString()),
                values(page("member", history(assetId)).path("items"), "sourceId"));
    }

    @Test
    void contentRechecksMembershipEvenWhenTheReaderAlreadyHasTimelineMetadata() throws Exception {
        UUID document = document("INVOICE", assetId, null, "2026-01-01T02:00:00Z");
        when(storage.read(anyString())).thenReturn(DocumentTestSupport.pdf());
        page("member", history(assetId));
        String contentPath = path() + "/documents/" + document + "/content";
        read("member", get(contentPath)).andExpect(status().isOk());
        db.execute("delete from \"EstateUser\" where \"estateId\"=? and \"userId\"='member'", estateId);
        read("member", get(contentPath)).andExpect(status().isNotFound());
    }

    private void changeAsset(UUID document, UUID asset, int version) throws Exception {
        var payload = new LinkedHashMap<String, Object>();
        payload.put("assetId", asset);
        payload.put("expectedAssociationVersion", version);
        send("owner", put(path() + "/documents/" + document + "/asset"), payload)
                .andExpect(status().isOk());
    }
}
