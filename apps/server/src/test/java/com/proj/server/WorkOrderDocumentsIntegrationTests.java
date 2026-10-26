package com.proj.server;

import static com.proj.server.db.tables.Document.DOCUMENT;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.proj.server.document.DocumentStore;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.ResultActions;

class WorkOrderDocumentsIntegrationTests extends CustomEstateRoleTestSupport {
    @MockitoBean
    DocumentStore storage;

    @BeforeEach
    void associationMembers() {
        member(estateId, "crew", "CREW");
        member(estateId, "resident", "RESIDENT");
    }

    @Test
    void unlinkedDocumentCanAttachToClosedWorkWithoutChangingOutcomeOrStatusAndSupportsCrewReads() throws Exception {
        UUID document = document(estateId, "crew");
        UUID order = order();
        send(
                        "owner",
                        patch(path() + "/work-orders/" + order + "/status"),
                        Map.of("targetStatus", "IN_PROGRESS", "expectedVersion", 0))
                .andExpect(status().isOk());
        send(
                        "owner",
                        put(path() + "/work-orders/" + order + "/completion"),
                        Map.of(
                                "expectedVersion",
                                1,
                                "findings",
                                "Original finding",
                                "workPerformed",
                                "Repair",
                                "labourCost",
                                "12.50",
                                "partsCost",
                                "0",
                                "downtimeMinutes",
                                0))
                .andExpect(status().isCreated());
        var before =
                db.fetchOne("select * from \"WorkOrder\" where id=?", order).intoMap();
        var completion = db.fetchOne("select * from \"WorkOrderCompletion\" where \"workOrderId\"=?", order)
                .intoMap();
        mvc.perform(as("manager", get(association(document))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.documentId").value(document.toString()))
                .andExpect(jsonPath("$.workOrderId").isEmpty())
                .andExpect(jsonPath("$.associationVersion").value(0))
                .andExpect(header().string("Cache-Control", "private, no-store"));
        associate(document, order, 0, null, "manager")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workOrderId").value(order.toString()))
                .andExpect(jsonPath("$.associationVersion").value(1));
        mvc.perform(as("crew", get(attachments(order))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(document.toString()))
                .andExpect(jsonPath("$.items[0].originalFilename").value("invoice.pdf"))
                .andExpect(jsonPath("$.items[0].storageKey").doesNotExist());
        mvc.perform(as("crew", get(association(document) + "/history")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].toWorkOrderId").value(order.toString()))
                .andExpect(jsonPath("$.items[0].fromWorkOrderId").isEmpty())
                .andExpect(jsonPath("$.items[0].associationVersion").value(1));
        assertEquals(
                before,
                db.fetchOne("select * from \"WorkOrder\" where id=?", order).intoMap());
        assertEquals(
                completion,
                db.fetchOne("select * from \"WorkOrderCompletion\" where \"workOrderId\"=?", order)
                        .intoMap());
    }

    @Test
    void changingAndRemovingRequireReasonsRetainAuditAndNeverDuplicateNoOpWrites() throws Exception {
        UUID document = document(estateId, "owner");
        UUID first = order();
        UUID second = order();
        associate(document, first, 0, null, "owner").andExpect(status().isOk());
        associate(document, first, 1, null, "owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.associationVersion").value(1));
        associate(document, second, 1, "  ", "owner").andExpect(status().isBadRequest());
        associate(document, second, 1, "Wrong job selected", "owner")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.associationVersion").value(2));
        associate(document, first, 1, "Stale edit", "manager").andExpect(status().isConflict());
        mvc.perform(as("crew", get(attachments(first))))
                .andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(as("crew", get(attachments(second))))
                .andExpect(jsonPath("$.items.length()").value(1));
        associate(document, null, 2, null, "manager").andExpect(status().isBadRequest());
        associate(document, null, 2, "Not relevant to this job", "manager")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workOrderId").isEmpty())
                .andExpect(jsonPath("$.associationVersion").value(3));
        mvc.perform(as("owner", get(association(document) + "/history")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.items[1].correctionReason").value("Wrong job selected"))
                .andExpect(jsonPath("$.items[2].fromWorkOrderId").value(second.toString()))
                .andExpect(jsonPath("$.items[2].toWorkOrderId").isEmpty());
        assertNull(db.fetchOne("select \"deletedAt\" from \"Document\" where id=?", document)
                .get(0));
    }

    @ParameterizedTest
    @ValueSource(strings = {"crew", "resident", "member"})
    void documentEditOrUploaderRightsAloneCannotChangeAnAssociation(String user) throws Exception {
        UUID document = document(estateId, user);
        UUID order = order();
        associate(document, order, 0, null, user)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @ParameterizedTest
    @ValueSource(strings = {"member", "resident"})
    void documentOnlyOrResidentMembershipCannotReadWorkOrderAttachments(String user) throws Exception {
        UUID document = document(estateId, "owner");
        UUID order = order();
        mvc.perform(as(user, get(association(document))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").isNotEmpty());
        mvc.perform(as(user, get(attachments(order))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    @Test
    void foreignDeletedAndInactiveDocumentsCannotBeLinkedAndDeletedAttachmentsDisappear() throws Exception {
        UUID document = document(estateId, "crew");
        UUID order = order();
        UUID foreignEstate = estate("owner");
        UUID foreignDocument = document(foreignEstate, "owner");
        associate(foreignDocument, order, 0, null, "owner").andExpect(status().isNotFound());
        associate(document, UUID.randomUUID(), 0, null, "owner").andExpect(status().isNotFound());
        associate(document, order, 0, null, "owner").andExpect(status().isOk());
        mvc.perform(as("crew", delete(path() + "/documents/" + document))).andExpect(status().isNoContent());
        mvc.perform(as("owner", get(attachments(order))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(as("owner", get(association(document)))).andExpect(status().isNotFound());
        associate(document, order, 1, "Deleted", "owner").andExpect(status().isNotFound());
        assertEquals(
                1,
                db.fetchOne("select count(*) from \"DocumentWorkOrderEvent\" where \"documentId\"=?", document)
                        .get(0, Integer.class));
        UUID available = document(estateId, "owner");
        inactive();
        associate(available, order, 0, null, "owner").andExpect(status().isConflict());
        mvc.perform(as("crew", get(attachments(order)))).andExpect(status().isOk());
    }

    @Test
    void missingIdentityCannotReadOrMutateAssociations() throws Exception {
        UUID document = document(estateId, "owner");
        mvc.perform(get(association(document))).andExpect(status().isUnauthorized());
        mvc.perform(put(association(document))).andExpect(status().isUnauthorized());
    }

    @Test
    void omittingTargetCannotAccidentallyUnlinkAnExistingDocument() throws Exception {
        UUID document = document(estateId, "owner");
        UUID order = order();
        associate(document, order, 0, null, "owner").andExpect(status().isOk());
        send(
                        "owner",
                        put(association(document)),
                        Map.of("expectedAssociationVersion", 1, "correctionReason", "Missing target field"))
                .andExpect(status().isBadRequest());
        mvc.perform(as("owner", get(association(document))))
                .andExpect(jsonPath("$.workOrderId").value(order.toString()));
    }

    @Test
    void attachmentAndHistoryPaginationAreBoundToTheirEstateRecordAndKind() throws Exception {
        UUID first = document(estateId, "owner");
        UUID second = document(estateId, "owner");
        UUID order = order();
        UUID other = order();
        associate(first, order, 0, null, "owner").andExpect(status().isOk());
        associate(second, order, 0, null, "owner").andExpect(status().isOk());
        var page = body(mvc.perform(as("crew", get(attachments(order)).param("limit", "1")))
                .andExpect(status().isOk()));
        String cursor = page.get("nextCursor").asText();
        var next = body(mvc.perform(
                        as("crew", get(attachments(order)).param("limit", "1").param("cursor", cursor)))
                .andExpect(status().isOk()));
        assertNotEquals(
                page.get("items").get(0).get("id"), next.get("items").get(0).get("id"));
        assertTrue(next.get("nextCursor").isNull());
        mvc.perform(as("crew", get(attachments(other)).param("cursor", cursor))).andExpect(status().isBadRequest());
        mvc.perform(as("crew", get(association(first) + "/history").param("cursor", cursor)))
                .andExpect(status().isBadRequest());
        associate(first, other, 1, "Correct job", "owner").andExpect(status().isOk());
        var history =
                body(mvc.perform(as("crew", get(association(first) + "/history").param("limit", "1")))
                        .andExpect(status().isOk()));
        assertEquals(1, history.get("items").get(0).get("associationVersion").asInt());
        String historyCursor = history.get("nextCursor").asText();
        mvc.perform(as(
                        "crew",
                        get(association(first) + "/history").param("limit", "1").param("cursor", historyCursor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].associationVersion").value(2));
        mvc.perform(as("crew", get(association(second) + "/history").param("cursor", historyCursor)))
                .andExpect(status().isBadRequest());
        mvc.perform(as("crew", get(attachments(order)).param("limit", "101"))).andExpect(status().isBadRequest());
        mvc.perform(as("crew", get(association(first) + "/history").param("cursor", "invalid")))
                .andExpect(status().isBadRequest());
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(
            propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void concurrentSelectionsHaveOneWinnerAndOneAuditEntry() throws Exception {
        UUID document = document(estateId, "owner");
        UUID first = order();
        UUID second = order();
        try (var pool = java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var gate = new java.util.concurrent.CountDownLatch(1);
            var a = pool.submit(() -> {
                gate.await();
                return associate(document, first, 0, null, "owner")
                        .andReturn()
                        .getResponse()
                        .getStatus();
            });
            var b = pool.submit(() -> {
                gate.await();
                return associate(document, second, 0, null, "manager")
                        .andReturn()
                        .getResponse()
                        .getStatus();
            });
            gate.countDown();
            assertEquals(
                    java.util.Set.of(200, 409),
                    java.util.Set.of(
                            a.get(30, java.util.concurrent.TimeUnit.SECONDS),
                            b.get(30, java.util.concurrent.TimeUnit.SECONDS)));
            assertEquals(
                    1,
                    db.fetchOne("select count(*) from \"DocumentWorkOrderEvent\" where \"documentId\"=?", document)
                            .get(0, Integer.class));
        } finally {
            removeCommittedAssociationFixtures();
        }
    }

    @Test
    @org.springframework.transaction.annotation.Transactional(
            propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    void failedAssociationUpdateRollsBackItsAuditToo() throws Exception {
        UUID document = document(estateId, "owner");
        UUID order = order();
        try {
            db.execute("alter table \"Document\" add constraint id26_test_failure check (id <> '" + document
                    + "'::uuid or \"workOrderAssociationVersion\"=0)");
            associate(document, order, 0, null, "owner").andExpect(status().isInternalServerError());
            assertEquals(
                    0,
                    db.fetchOne("select count(*) from \"DocumentWorkOrderEvent\" where \"documentId\"=?", document)
                            .get(0, Integer.class));
            mvc.perform(as("owner", get(association(document))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.workOrderId").isEmpty())
                    .andExpect(jsonPath("$.associationVersion").value(0));
        } finally {
            db.execute("alter table \"Document\" drop constraint if exists id26_test_failure");
            removeCommittedAssociationFixtures();
        }
    }

    void removeCommittedAssociationFixtures() {
        for (String table : java.util.List.of(
                "DocumentWorkOrderEvent", "Document", "WorkOrderStatusEvent", "WorkOrder", "Location", "EstateUser"))
            db.execute("delete from \"" + table + "\" where \"estateId\"=?", estateId);
        db.execute("delete from \"Estate\" where id=?", estateId);
    }

    UUID document(UUID estate, String uploader) {
        UUID id = UUID.randomUUID();
        db.insertInto(DOCUMENT)
                .set(DOCUMENT.ID, id)
                .set(DOCUMENT.ESTATEID, estate)
                .set(DOCUMENT.DOCUMENTTYPE, "INVOICE")
                .set(DOCUMENT.ORIGINALFILENAME, "invoice.pdf")
                .set(DOCUMENT.CONTENTTYPE, "application/pdf")
                .set(DOCUMENT.SIZEBYTES, 100)
                .set(DOCUMENT.STORAGEKEY, "documents/" + estate + "/" + id)
                .set(DOCUMENT.UPLOADEDBYUSERID, uploader)
                .execute();
        return id;
    }

    UUID order() throws Exception {
        UUID location = location(estateId, "BLOCK", null, "Block " + UUID.randomUUID(), null);
        return id(body(send(
                        "owner",
                        post(path() + "/work-orders"),
                        Map.of(
                                "source",
                                "MANUAL",
                                "description",
                                "Test work",
                                "locationId",
                                location,
                                "category",
                                "EQUIPMENT_FAULT",
                                "priority",
                                "MEDIUM"))
                .andExpect(status().isCreated())));
    }

    String association(UUID document) {
        return path() + "/documents/" + document + "/work-order";
    }

    String attachments(UUID order) {
        return path() + "/work-orders/" + order + "/documents";
    }

    ResultActions associate(UUID document, UUID order, int version, String reason, String user) throws Exception {
        var request = new LinkedHashMap<String, Object>();
        request.put("workOrderId", order);
        request.put("expectedAssociationVersion", version);
        request.put("correctionReason", reason);
        return send(user, put(association(document)), request);
    }
}
