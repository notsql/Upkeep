package com.proj.server;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.web.servlet.ResultActions;

/** ID-25 contract tests: use existing uploads and HTTP JSON ahead of DTO/schema generation. */
class AssetDocumentsIntegrationTests extends DocumentTestSupport {
    private final List<UUID> associationEstates = new ArrayList<>();

    @Override
    UUID estate(String owner) {
        UUID estate = super.estate(owner);
        associationEstates.add(estate);
        return estate;
    }

    @AfterEach
    void removeAssociationFixturesBeforeDocumentSupportRemovesEstates() {
        // All records belong to this test in disposable Testcontainers Postgres.
        for (UUID estate : associationEstates) {
            for (String table : List.of(
                    "DocumentWorkOrderEvent", "Document", "WorkOrderStatusEvent", "WorkOrder", "Asset", "Location")) {
                db.execute("delete from \"" + table + "\" where \"estateId\"=?", estate);
            }
        }
    }

    @Test
    void ordinaryUploadLinksByUuidAndAppearsOnAssetAfterFreshReadWithoutChangingEquipmentOrFile() throws Exception {
        UUID document = id(upload("crew", "invoice.pdf"));
        UUID asset = asset(estateId, "TT-A0001");
        var equipment = db.fetchOne("select * from \"Asset\" where id=?", asset).intoMap();
        String key = storageKey(document);
        byte[] bytes = STORAGE.objects.get(key).bytes();
        mvc.perform(as("owner", get(association(document))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentId").value(document.toString()))
                .andExpect(jsonPath("$.assetId").isEmpty())
                .andExpect(jsonPath("$.changedAt").isEmpty())
                .andExpect(jsonPath("$.associationVersion").value(0));
        associate(document, asset, 0, "owner")
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.assetId").value(asset.toString()))
                .andExpect(jsonPath("$.assetReference").value("TT-A0001"))
                .andExpect(jsonPath("$.assetName").value("Water pump"))
                .andExpect(jsonPath("$.associationVersion").value(1))
                .andExpect(jsonPath("$.changedAt").isNotEmpty())
                .andExpect(jsonPath("$.changedByUserId").doesNotExist());
        mvc.perform(as("owner", get(association(document))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.assetId").value(asset.toString()));
        mvc.perform(as("owner", get(attachments(asset))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.items[0].id").value(document.toString()))
                .andExpect(jsonPath("$.items[0].originalFilename").value("invoice.pdf"))
                .andExpect(jsonPath("$.items[0].documentType").value("INVOICE"))
                .andExpect(jsonPath("$.items[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$.items[0].storageKey").doesNotExist());
        mvc.perform(as("owner", get(downloadPath(document))))
                .andExpect(status().isOk())
                .andExpect(content().bytes(bytes));
        assertEquals(key, storageKey(document));
        assertEquals(
                equipment,
                db.fetchOne("select * from \"Asset\" where id=?", asset).intoMap());
        assertEquals(
                0,
                db.fetchCount(db.selectFrom(com.proj.server.db.tables.Assetevent.ASSETEVENT)
                        .where(com.proj.server.db.tables.Assetevent.ASSETEVENT.ASSETID.eq(asset))));
    }

    @Test
    void unlinkRetainsTheUploadAndExistingWorkOrderAndNeedsNoCorrectionReason() throws Exception {
        UUID document = id(upload("crew", "service-report.pdf"));
        UUID asset = asset(estateId, "TT-A0001");
        UUID order = order(asset);
        workOrderLink(document, order).andExpect(status().isOk());
        var work = db.fetchOne("select * from \"WorkOrder\" where id=?", order).intoMap();
        associate(document, asset, 0, "owner").andExpect(status().isOk());
        associate(document, null, 1, "owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assetId").isEmpty())
                .andExpect(jsonPath("$.assetReference").isEmpty())
                .andExpect(jsonPath("$.assetName").isEmpty())
                .andExpect(jsonPath("$.changedAt").isNotEmpty())
                .andExpect(jsonPath("$.associationVersion").value(2));
        mvc.perform(as("owner", get(attachments(asset))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(as("owner", get(association(document))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assetId").isEmpty());
        mvc.perform(as("owner", get(documents() + "/" + document + "/work-order")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workOrderId").value(order.toString()))
                .andExpect(jsonPath("$.associationVersion").value(1));
        mvc.perform(as("crew", get(downloadPath(document)))).andExpect(status().isOk());
        assertTrue(STORAGE.objects.containsKey(storageKey(document)));
        assertEquals(
                work,
                db.fetchOne("select * from \"WorkOrder\" where id=?", order).intoMap());
    }

    @Test
    void directReassignmentIsRejectedUntilExplicitUnlinkAndSameVersionNoOpsPreserveChangeTime() throws Exception {
        UUID document = id(upload("owner", "invoice.pdf"));
        UUID first = asset(estateId, "TT-A0001");
        UUID second = asset(estateId, "TT-A0002");
        associate(document, null, 0, "owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.associationVersion").value(0))
                .andExpect(jsonPath("$.changedAt").isEmpty());
        var linked = body(associate(document, first, 0, "owner").andExpect(status().isOk()));
        associate(document, first, 1, "owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.associationVersion").value(1))
                .andExpect(jsonPath("$.changedAt").value(linked.get("changedAt").asText()));
        associate(document, second, 1, "owner").andExpect(status().isConflict());
        mvc.perform(as("owner", get(association(document))))
                .andExpect(jsonPath("$.assetId").value(first.toString()));
        var unlinked = body(associate(document, null, 1, "owner").andExpect(status().isOk()));
        associate(document, null, 2, "owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.associationVersion").value(2))
                .andExpect(
                        jsonPath("$.changedAt").value(unlinked.get("changedAt").asText()));
        associate(document, second, 2, "owner").andExpect(status().isOk());
        associate(document, null, 1, "owner").andExpect(status().isConflict());
        associate(document, second, 2, "owner").andExpect(status().isConflict());
        mvc.perform(as("owner", get(association(document))))
                .andExpect(jsonPath("$.assetId").value(second.toString()))
                .andExpect(jsonPath("$.associationVersion").value(3));
    }

    @Test
    void retirementAndRelocationPreserveLinksAndRetiredAssetsStillAllowLinkAndUnlink() throws Exception {
        UUID document = id(upload("owner", "invoice.pdf"));
        UUID asset = asset(estateId, "TT-A0001");
        associate(document, asset, 0, "owner").andExpect(status().isOk());
        UUID movedTo = location(estateId, "BLOCK", null, "Block B", null);
        db.execute("update \"Asset\" set \"locationId\"=?, \"deactivatedAt\"=now() where id=?", movedTo, asset);
        mvc.perform(as("owner", get(attachments(asset))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(document.toString()));
        var retired = db.fetchOne("select * from \"Asset\" where id=?", asset).intoMap();
        associate(document, null, 1, "owner").andExpect(status().isOk());
        associate(document, asset, 2, "owner").andExpect(status().isOk());
        assertEquals(
                retired,
                db.fetchOne("select * from \"Asset\" where id=?", asset).intoMap());
    }

    @ParameterizedTest
    @ValueSource(strings = {"manager", "crew", "resident", "member"})
    void documentEditingOrUploaderRightsDoNotGrantAssetAssociationAuthority(String user) throws Exception {
        UUID document = id(upload("crew", "invoice.pdf"));
        UUID asset = asset(estateId, "TT-A0001");
        associate(document, asset, 0, user).andExpect(status().isForbidden());
        associate(document, asset, 0, "owner").andExpect(status().isOk());
        associate(document, null, 1, user).andExpect(status().isForbidden());
        mvc.perform(as(user, get(association(document)))).andExpect(status().isForbidden());
        mvc.perform(as(user, get(attachments(asset)))).andExpect(status().isForbidden());
    }

    @Test
    void documentOnlyCustomRoleCannotReadAssetMetadataOrMutateAssociations() throws Exception {
        grant("member", "VIEW_ESTATE", "VIEW_DOCUMENTS", "EDIT_DOCUMENTS");
        UUID document = id(upload("member", "invoice.pdf"));
        UUID asset = asset(estateId, "TT-A0001");
        associate(document, asset, 0, "member").andExpect(status().isForbidden());
        mvc.perform(as("member", get(attachments(asset)))).andExpect(status().isForbidden());
    }

    @Test
    void storageOutageDoesNotPreventDatabaseOnlyLinkAndUnlinkActions() throws Exception {
        UUID document = id(upload("owner", "invoice.pdf"));
        UUID asset = asset(estateId, "TT-A0001");
        STORAGE.unavailable = true;
        associate(document, asset, 0, "owner").andExpect(status().isOk());
        mvc.perform(as("owner", get(attachments(asset))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(document.toString()));
        associate(document, null, 1, "owner").andExpect(status().isOk());
        STORAGE.unavailable = false;
        mvc.perform(as("owner", get(downloadPath(document)))).andExpect(status().isOk());
    }

    @Test
    void currentOwnershipIsRecheckedAfterTheUserHasReviewedTheAssociation() throws Exception {
        UUID document = id(upload("owner", "invoice.pdf"));
        UUID asset = asset(estateId, "TT-A0001");
        associate(document, asset, 0, "owner").andExpect(status().isOk());
        db.execute("update \"Estate\" set \"ownerUserId\"='new-owner' where id=?", estateId);
        // The former owner retains the fixture's MANAGER membership: the estate
        // remains accessible, but asset-editing authority has been revoked.
        associate(document, null, 1, "owner").andExpect(status().isForbidden());
        mvc.perform(as("new-owner", get(association(document))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assetId").value(asset.toString()));
    }

    @Test
    void inactiveEstatesKeepHistoricalReadsButRejectBothAssociationWrites() throws Exception {
        UUID document = id(upload("owner", "invoice.pdf"));
        UUID asset = asset(estateId, "TT-A0001");
        associate(document, asset, 0, "owner").andExpect(status().isOk());
        inactive();
        associate(document, null, 1, "owner").andExpect(status().isConflict());
        associate(document, asset, 1, "owner").andExpect(status().isConflict());
        mvc.perform(as("owner", get(association(document)))).andExpect(status().isOk());
        mvc.perform(as("owner", get(attachments(asset))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(document.toString()));
    }

    @Test
    void missingForeignAndDeletedRecordsCannotBeLinkedAndDeletionHidesAttachments() throws Exception {
        UUID document = id(upload("owner", "invoice.pdf"));
        UUID asset = asset(estateId, "TT-A0001");
        UUID foreignEstate = estate("owner");
        UUID foreignAsset = asset(foreignEstate, "TT-A0001");
        associate(document, foreignAsset, 0, "owner").andExpect(status().isNotFound());
        associate(document, UUID.randomUUID(), 0, "owner").andExpect(status().isNotFound());
        associate(UUID.randomUUID(), asset, 0, "owner").andExpect(status().isNotFound());
        mvc.perform(as("owner", get(attachments(foreignAsset)))).andExpect(status().isNotFound());
        send("owner", put("/estates/" + foreignEstate + "/documents/" + document + "/asset"), change(foreignAsset, 0))
                .andExpect(status().isNotFound());
        associate(document, asset, 0, "outsider").andExpect(status().isNotFound());
        associate(document, asset, 0, "owner").andExpect(status().isOk());
        mvc.perform(as("owner", delete(documents() + "/" + document))).andExpect(status().isNoContent());
        mvc.perform(as("owner", get(attachments(asset))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        associate(document, asset, 1, "owner").andExpect(status().isNotFound());
        associate(document, null, 1, "owner").andExpect(status().isNotFound());
        mvc.perform(as("owner", get(association(document)))).andExpect(status().isNotFound());
        mvc.perform(as("owner", get(downloadPath(document)))).andExpect(status().isNotFound());
        assertNotNull(db.fetchOne("select id from \"Document\" where id=?", document));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "{}",
                "{\"assetId\":null}",
                "{\"expectedAssociationVersion\":0}",
                "{\"assetId\":null,\"expectedAssociationVersion\":null}",
                "{\"assetId\":null,\"expectedAssociationVersion\":-1}",
                "{\"assetId\":null,\"expectedAssociationVersion\":0.5}",
                "{\"assetId\":\"not-a-uuid\",\"expectedAssociationVersion\":0}"
            })
    void malformedRequestsCannotAccidentallyRemoveAnExistingAssociation(String request) throws Exception {
        UUID document = id(upload("owner", "invoice.pdf"));
        UUID asset = asset(estateId, "TT-A0001");
        associate(document, asset, 0, "owner").andExpect(status().isOk());
        mvc.perform(as("owner", put(association(document)))
                        .contentType("application/json")
                        .content(request))
                .andExpect(status().isBadRequest());
        mvc.perform(as("owner", get(association(document))))
                .andExpect(jsonPath("$.assetId").value(asset.toString()))
                .andExpect(jsonPath("$.associationVersion").value(1));
    }

    @Test
    void malformedPathIdentifiersAreBadRequests() throws Exception {
        mvc.perform(as("owner", get(documents() + "/not-a-uuid/asset"))).andExpect(status().isBadRequest());
        mvc.perform(as("owner", get(path() + "/assets/not-a-uuid/documents"))).andExpect(status().isBadRequest());
    }

    @Test
    void anAssetCanHaveManyDocumentsWithNewestFirstPaginationBoundToItsEstateAndAsset() throws Exception {
        UUID asset = asset(estateId, "TT-A0001");
        UUID other = asset(estateId, "TT-A0002");
        UUID oldest = id(upload("owner", "old.pdf"));
        UUID first = id(upload("owner", "one.pdf"));
        UUID second = id(upload("owner", "two.pdf"));
        db.execute("update \"Document\" set \"createdAt\"='2026-01-01T00:00:00Z' where id=?", oldest);
        db.execute("update \"Document\" set \"createdAt\"='2026-02-01T00:00:00Z' where id in (?, ?)", first, second);
        for (UUID document : List.of(oldest, first, second)) {
            associate(document, asset, 0, "owner").andExpect(status().isOk());
        }
        var page = body(mvc.perform(as("owner", get(attachments(asset)).param("limit", "1")))
                .andExpect(status().isOk()));
        String cursor = page.get("nextCursor").asText();
        var next = body(mvc.perform(
                        as("owner", get(attachments(asset)).param("limit", "1").param("cursor", cursor)))
                .andExpect(status().isOk()));
        assertEquals(
                Set.of(first.toString(), second.toString()),
                Set.of(
                        page.get("items").get(0).get("id").asText(),
                        next.get("items").get(0).get("id").asText()));
        mvc.perform(as(
                        "owner",
                        get(attachments(asset))
                                .param("limit", "1")
                                .param("cursor", next.get("nextCursor").asText())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(oldest.toString()))
                .andExpect(jsonPath("$.nextCursor").isEmpty());
        mvc.perform(as("owner", get(attachments(other)).param("cursor", cursor)))
                .andExpect(status().isBadRequest());
        UUID foreign = estate("owner");
        UUID foreignAsset = asset(foreign, "TT-A0001");
        mvc.perform(as(
                        "owner",
                        get("/estates/" + foreign + "/assets/" + foreignAsset + "/documents")
                                .param("cursor", cursor)))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "101", "1.5", "invalid"})
    void rejectsInvalidAttachmentPageLimits(String limit) throws Exception {
        UUID asset = asset(estateId, "TT-A0001");
        mvc.perform(as("owner", get(attachments(asset)).param("limit", limit))).andExpect(status().isBadRequest());
    }

    @Test
    void rejectsMalformedAttachmentCursors() throws Exception {
        UUID asset = asset(estateId, "TT-A0001");
        mvc.perform(as("owner", get(attachments(asset)).param("cursor", "invalid")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void bothLinkingOrdersRejectDifferentWorkOrderAssetsWithoutChangingEitherAssociation() throws Exception {
        UUID first = asset(estateId, "TT-A0001");
        UUID second = asset(estateId, "TT-A0002");
        UUID order = order(first);
        UUID document = id(upload("owner", "invoice.pdf"));
        workOrderLink(document, order).andExpect(status().isOk());
        associate(document, second, 0, "owner").andExpect(status().isConflict());
        mvc.perform(as("owner", get(association(document))))
                .andExpect(jsonPath("$.assetId").isEmpty())
                .andExpect(jsonPath("$.associationVersion").value(0));
        UUID reverse = id(upload("owner", "reverse.pdf"));
        associate(reverse, second, 0, "owner").andExpect(status().isOk());
        workOrderLink(reverse, order).andExpect(status().isConflict());
        mvc.perform(as("owner", get(documents() + "/" + reverse + "/work-order")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workOrderId").isEmpty())
                .andExpect(jsonPath("$.associationVersion").value(0));
        associate(document, first, 0, "owner").andExpect(status().isOk());
    }

    @Test
    void workOrdersWithoutAnAssetStayUnassignedWhenTheirDocumentIsLinked() throws Exception {
        UUID asset = asset(estateId, "TT-A0001");
        UUID order = order(null);
        UUID document = id(upload("owner", "invoice.pdf"));
        workOrderLink(document, order).andExpect(status().isOk());
        associate(document, asset, 0, "owner").andExpect(status().isOk());
        assertNull(db.fetchOne("select \"assetId\" from \"WorkOrder\" where id=?", order)
                .get(0));
    }

    @Test
    void concurrentAssetSelectionsHaveOneWinnerAndOneVersionIncrement() throws Exception {
        UUID document = id(upload("owner", "invoice.pdf"));
        UUID first = asset(estateId, "TT-A0001");
        UUID second = asset(estateId, "TT-A0002");
        assertEquals(
                List.of(200, 409),
                race(
                        () -> associate(document, first, 0, "owner")
                                .andReturn()
                                .getResponse()
                                .getStatus(),
                        () -> associate(document, second, 0, "owner")
                                .andReturn()
                                .getResponse()
                                .getStatus()));
        var result = body(mvc.perform(as("owner", get(association(document)))).andExpect(status().isOk()));
        assertTrue(Set.of(first.toString(), second.toString())
                .contains(result.get("assetId").asText()));
        assertEquals(1, result.get("associationVersion").asInt());
    }

    @Test
    void concurrentAssetAndWorkOrderLinksCannotCreateAMismatch() throws Exception {
        UUID document = id(upload("owner", "invoice.pdf"));
        UUID first = asset(estateId, "TT-A0001");
        UUID second = asset(estateId, "TT-A0002");
        UUID order = order(first);
        assertEquals(
                List.of(200, 409),
                race(
                        () -> associate(document, second, 0, "owner")
                                .andReturn()
                                .getResponse()
                                .getStatus(),
                        () -> workOrderLink(document, order)
                                .andReturn()
                                .getResponse()
                                .getStatus()));
        var assetLink =
                body(mvc.perform(as("owner", get(association(document)))).andExpect(status().isOk()));
        var workLink = body(mvc.perform(as("owner", get(documents() + "/" + document + "/work-order")))
                .andExpect(status().isOk()));
        assertTrue(
                assetLink.get("assetId").isNull() || workLink.get("workOrderId").isNull());
    }

    @Test
    void failedUnlinkPreservesThePreviousAssociationVersionAndAttribution() throws Exception {
        UUID document = id(upload("owner", "invoice.pdf"));
        UUID asset = asset(estateId, "TT-A0001");
        var before = body(associate(document, asset, 0, "owner").andExpect(status().isOk()));
        try {
            db.execute("alter table \"Document\" add constraint asset_document_test_failure check (id <> '" + document
                    + "'::uuid or \"assetAssociationVersion\"=1)");
            associate(document, null, 1, "owner").andExpect(status().isInternalServerError());
            assertEquals(
                    before,
                    body(mvc.perform(as("owner", get(association(document)))).andExpect(status().isOk())));
        } finally {
            db.execute("alter table \"Document\" drop constraint if exists asset_document_test_failure");
        }
    }

    UUID asset(UUID estate, String reference) {
        UUID location = location(estate, "BLOCK", null, "Block " + reference, null);
        UUID asset = UUID.randomUUID();
        db.execute(
                "insert into \"Asset\" (id, \"estateId\", \"locationId\", reference, name, category, \"updatedAt\") "
                        + "values (?, ?, ?, ?, 'Water pump', 'PUMP', now())",
                asset,
                estate,
                location,
                reference);
        return asset;
    }

    UUID order(UUID asset) throws Exception {
        UUID location = asset == null
                ? location(estateId, "BLOCK", null, "Work block", null)
                : db.fetchOne("select \"locationId\" from \"Asset\" where id=?", asset)
                        .get(0, UUID.class);
        var request = new LinkedHashMap<String, Object>();
        request.put("source", "MANUAL");
        request.put("description", "Test work");
        request.put("locationId", location);
        request.put("assetId", asset);
        request.put("category", "EQUIPMENT_FAULT");
        request.put("priority", "MEDIUM");
        return id(body(send("owner", post(path() + "/work-orders"), request).andExpect(status().isCreated())));
    }

    String association(UUID document) {
        return documents() + "/" + document + "/asset";
    }

    String attachments(UUID asset) {
        return path() + "/assets/" + asset + "/documents";
    }

    Map<String, Object> change(UUID asset, int version) {
        var request = new LinkedHashMap<String, Object>();
        request.put("assetId", asset);
        request.put("expectedAssociationVersion", version);
        return request;
    }

    ResultActions associate(UUID document, UUID asset, int version, String user) throws Exception {
        return send(user, put(association(document)), change(asset, version));
    }

    ResultActions workOrderLink(UUID document, UUID order) throws Exception {
        return send(
                "owner",
                put(documents() + "/" + document + "/work-order"),
                Map.of("workOrderId", order, "expectedAssociationVersion", 0));
    }

    List<Integer> race(Callable<Integer> first, Callable<Integer> second) throws Exception {
        var gate = new CountDownLatch(1);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var a = pool.submit(() -> {
                gate.await();
                return first.call();
            });
            var b = pool.submit(() -> {
                gate.await();
                return second.call();
            });
            gate.countDown();
            return java.util.stream.Stream.of(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS))
                    .sorted()
                    .toList();
        }
    }
}
