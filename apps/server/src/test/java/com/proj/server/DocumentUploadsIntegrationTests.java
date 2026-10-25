package com.proj.server;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;

/** Acceptance tests use the agreed HTTP surface and a private, local storage boundary. */
class DocumentUploadsIntegrationTests extends DocumentTestSupport {
    static Stream<Arguments> supportedFiles() throws Exception {
        return Stream.of(
                Arguments.of("INVOICE", "invoice.pdf", "application/pdf", pdf()),
                Arguments.of("SERVICE_REPORT", "service.PDF", "application/pdf", pdf()),
                Arguments.of("INVOICE", "invoice.jpg", "image/jpeg", image("jpg", 2, 3)),
                Arguments.of("SERVICE_REPORT", "service.JPEG", "image/jpeg", image("jpg", 2, 3)),
                Arguments.of("INVOICE", "invoice.png", "image/png", image("png", 2, 3)),
                Arguments.of("SERVICE_REPORT", "service.PNG", "image/png", image("png", 2, 3)));
    }

    @ParameterizedTest
    @MethodSource("supportedFiles")
    void storesSupportedFilesWithoutChangingTheirBytes(String type, String name, String mediaType, byte[] bytes)
            throws Exception {
        var file = new MockMultipartFile("file", name, mediaType, bytes);
        var response = mvc.perform(as("crew", submission(type, file)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.estateId").value(estateId.toString()))
                .andExpect(jsonPath("$.documentType").value(type))
                .andExpect(jsonPath("$.originalFilename").value(name))
                .andExpect(jsonPath("$.contentType").value(mediaType))
                .andExpect(jsonPath("$.sizeBytes").value(bytes.length))
                .andExpect(jsonPath("$.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.canDelete").value(true))
                .andExpect(jsonPath("$.storageKey").doesNotExist())
                .andExpect(jsonPath("$.uploadedByUserId").doesNotExist());
        var document = id(body(response));
        String key = storageKey(document);

        assertEquals("documents/" + estateId + "/" + document, key);
        assertArrayEquals(bytes, STORAGE.objects.get(key).bytes());
        assertEquals(
                "crew",
                db.fetchOne("select \"uploadedByUserId\" from \"Document\" where id=?", document)
                        .get(0, String.class));
        response.andExpect(header().string("Location", endsWith(downloadPath(document))));
        mvc.perform(as("member", get(downloadPath(document))))
                .andExpect(status().isOk())
                .andExpect(content().bytes(bytes))
                .andExpect(header().string("Content-Type", mediaType))
                .andExpect(
                        header().string("Content-Disposition", allOf(startsWith("attachment;"), containsString(name))))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", "private, no-store"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "member", "crew"})
    void eachAgreedPresetRoleCanUploadListAndDownload(String user) throws Exception {
        var document = upload(user, user + ".pdf");

        mvc.perform(as(user, get(documents())))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "private, no-store"))
                .andExpect(jsonPath("$.items[0].id").value(document.get("id").asText()));
        mvc.perform(as(user, get(downloadPath(id(document))))).andExpect(status().isOk());
    }

    @ParameterizedTest
    @ValueSource(strings = {"resident", "legacy-member"})
    void estateMembershipWithoutDocumentAuthorityIsInsufficient(String user) throws Exception {
        mvc.perform(as(user, submission("INVOICE", pdfFile("invoice.pdf")))).andExpect(status().isForbidden());
        mvc.perform(as(user, get(documents()))).andExpect(status().isForbidden());
        assertTrue(STORAGE.objects.isEmpty());
    }

    @Test
    void aManagerInAnotherEstateCannotAccessThisEstatesFiles() throws Exception {
        var foreign = estate("foreign-owner");
        member(foreign, "foreign-manager", "MANAGER");
        var document = upload("crew", "private.pdf");

        mvc.perform(as("foreign-manager", get(documents()))).andExpect(status().isNotFound());
        mvc.perform(as("foreign-manager", submission("INVOICE", pdfFile("foreign.pdf"))))
                .andExpect(status().isNotFound());
        mvc.perform(as("foreign-manager", get(downloadPath(id(document))))).andExpect(status().isNotFound());
        mvc.perform(as("foreign-manager", delete(documents() + "/" + id(document))))
                .andExpect(status().isNotFound());
        assertEquals(1, STORAGE.objects.size());
    }

    @Test
    void foreignDocumentIdsCannotBeReadOrDeletedThroughAnAuthorizedEstate() throws Exception {
        upload("crew", "local.pdf");
        var foreign = estate("foreign-owner");
        var foreignDocument = body(mvc.perform(as(
                        "foreign-owner",
                        multipart("/estates/" + foreign + "/documents")
                                .param("documentType", "INVOICE")
                                .file(pdfFile("foreign.pdf"))))
                .andExpect(status().isCreated()));

        mvc.perform(as("manager", get(downloadPath(id(foreignDocument))))).andExpect(status().isNotFound());
        mvc.perform(as("manager", delete(documents() + "/" + id(foreignDocument))))
                .andExpect(status().isNotFound());
        mvc.perform(as("manager", get(documents()).param("filename", "foreign")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        assertEquals(2, STORAGE.objects.size());
    }

    @Test
    void missingIdentityCannotUploadListDownloadOrDelete() throws Exception {
        mvc.perform(submission("INVOICE", pdfFile("invoice.pdf"))).andExpect(status().isUnauthorized());
        mvc.perform(get(documents())).andExpect(status().isUnauthorized());
        mvc.perform(get(downloadPath(UUID.randomUUID()))).andExpect(status().isUnauthorized());
        mvc.perform(delete(documents() + "/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
    }

    @Test
    void sameEstateResidentMembershipDoesNotAcquireAuthorityFromOwnership() throws Exception {
        db.execute(
                "insert into \"EstateUser\" (\"estateId\", \"userId\", role) values (?, 'owner', 'RESIDENT') on conflict (\"estateId\", \"userId\") do update set role='RESIDENT'",
                estateId);

        mvc.perform(as("owner", get(documents()))).andExpect(status().isForbidden());
        mvc.perform(as("owner", submission("INVOICE", pdfFile("invoice.pdf")))).andExpect(status().isForbidden());
    }

    @Test
    void exactlyFiveMillionBytesAreAcceptedAndOneMoreByteIsRejected() throws Exception {
        var bytes = Arrays.copyOf(pdf(), 5_000_001);
        Arrays.fill(bytes, pdf().length, bytes.length, (byte) ' ');

        mvc.perform(as(
                        "crew",
                        submission(
                                "INVOICE",
                                new MockMultipartFile(
                                        "file", "limit.pdf", "application/pdf", Arrays.copyOf(bytes, 5_000_000)))))
                .andExpect(status().isCreated());
        mvc.perform(as(
                        "crew",
                        submission("INVOICE", new MockMultipartFile("file", "large.pdf", "application/pdf", bytes))))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.message", containsString("5 MB")));
        assertEquals(1, STORAGE.objects.size());
        assertEquals(1, documentList("crew").get("items").size());
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "OTHER"})
    void invalidDocumentTypesDoNotSaveAFile(String type) throws Exception {
        mvc.perform(as("crew", submission(type, pdfFile("invoice.pdf")))).andExpect(status().isBadRequest());
        assertTrue(STORAGE.objects.isEmpty());
    }

    @Test
    void missingTypeMissingFileMultipleFilesAndUnexpectedFilePartsAreRejected() throws Exception {
        mvc.perform(as("crew", submission(null, pdfFile("invoice.pdf")))).andExpect(status().isBadRequest());
        mvc.perform(as("crew", submission("INVOICE"))).andExpect(status().isBadRequest());
        mvc.perform(as("crew", submission("INVOICE", pdfFile("a.pdf"), pdfFile("b.pdf"))))
                .andExpect(status().isBadRequest());
        mvc.perform(as(
                        "crew",
                        submission(
                                "INVOICE",
                                pdfFile("a.pdf"),
                                new MockMultipartFile("extra", "b.pdf", "application/pdf", pdf()))))
                .andExpect(status().isBadRequest());
        assertTrue(STORAGE.objects.isEmpty());
    }

    static Stream<Arguments> unsupportedFiles() throws Exception {
        return Stream.of(
                Arguments.of("invoice.exe", "application/pdf", pdf()),
                Arguments.of("invoice.pdf", "text/plain", pdf()),
                Arguments.of("invoice.pdf", "application/pdf", "plain text".getBytes(StandardCharsets.UTF_8)),
                Arguments.of("invoice.pdf", "application/pdf", image("png", 1, 1)),
                Arguments.of("invoice.png", "image/png", image("jpg", 1, 1)),
                Arguments.of("invoice.svg", "image/svg+xml", "<svg/>".getBytes(StandardCharsets.UTF_8)),
                Arguments.of("invoice.heic", "image/heic", new byte[] {1, 2, 3}),
                Arguments.of("invoice.pdf", null, pdf()));
    }

    @ParameterizedTest
    @MethodSource("unsupportedFiles")
    void rejectsUnsupportedOrMismatchedFormats(String filename, String type, byte[] bytes) throws Exception {
        mvc.perform(as("crew", submission("INVOICE", new MockMultipartFile("file", filename, type, bytes))))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertTrue(STORAGE.objects.isEmpty());
    }

    @Test
    void emptyFilesUnreadableImagesAndExcessivePixelCountsAreRejected() throws Exception {
        mvc.perform(as(
                        "crew",
                        submission(
                                "INVOICE", new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]))))
                .andExpect(status().isBadRequest());
        var truncatedPng = Arrays.copyOf(image("png", 1, 1), 24);
        mvc.perform(as(
                        "crew",
                        submission("INVOICE", new MockMultipartFile("file", "broken.png", "image/png", truncatedPng))))
                .andExpect(status().isBadRequest());
        mvc.perform(as(
                        "crew",
                        submission(
                                "SERVICE_REPORT",
                                new MockMultipartFile("file", "large.png", "image/png", image("png", 5000, 2500)))))
                .andExpect(status().isBadRequest());
        assertTrue(STORAGE.objects.isEmpty());
    }

    @Test
    void portraitPhotosWithinThePixelBudgetAreAccepted() throws Exception {
        mvc.perform(as(
                        "crew",
                        submission(
                                "SERVICE_REPORT",
                                new MockMultipartFile("file", "portrait.png", "image/png", image("png", 3024, 4032)))))
                .andExpect(status().isCreated());
    }

    @Test
    void filenamesAreDisplayMetadataAndCannotSelectStoragePathsOrForgeTheUploader() throws Exception {
        var document = body(mvc.perform(as(
                        "crew",
                        submission("INVOICE", pdfFile("../../invoice.pdf")).param("uploadedByUserId", "owner")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.originalFilename").value("invoice.pdf")));

        assertEquals("documents/" + estateId + "/" + id(document), storageKey(id(document)));
        assertEquals(
                "crew",
                db.fetchOne("select \"uploadedByUserId\" from \"Document\" where id=?", id(document))
                        .get(0, String.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "bad\r\nname.pdf"})
    void invalidFilenamesDoNotSaveAFile(String filename) throws Exception {
        mvc.perform(as("crew", submission("INVOICE", pdfFile(filename)))).andExpect(status().isBadRequest());
        assertTrue(STORAGE.objects.isEmpty());
    }

    @Test
    void filenameLengthBoundaryIsEnforced() throws Exception {
        mvc.perform(as("crew", submission("INVOICE", pdfFile("a".repeat(251) + ".pdf"))))
                .andExpect(status().isCreated());
        mvc.perform(as("crew", submission("INVOICE", pdfFile("a".repeat(252) + ".pdf"))))
                .andExpect(status().isBadRequest());
        assertEquals(1, STORAGE.objects.size());
    }

    @Test
    void identicalFilenamesRemainIndependentDocuments() throws Exception {
        var first = upload("crew", "invoice.pdf");
        var second = upload("crew", "invoice.pdf");

        assertNotEquals(id(first), id(second));
        assertEquals(2, STORAGE.objects.size());
        assertEquals(2, documentList("crew").get("items").size());
    }

    @Test
    void storageFailureReturnsAnErrorWithoutIndexedMetadata() throws Exception {
        STORAGE.unavailable = true;

        mvc.perform(as("crew", submission("INVOICE", pdfFile("invoice.pdf"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").isNotEmpty());
        assertEquals(0, documentList("crew").get("items").size());
        assertTrue(STORAGE.objects.isEmpty());
    }

    @Test
    void revokedMembershipDuringUploadPreventsTheMetadataCommitAndCleansTheObject() throws Exception {
        STORAGE.afterWrite.set(() -> revoke("crew"));

        mvc.perform(as("crew", submission("INVOICE", pdfFile("invoice.pdf")))).andExpect(status().isNotFound());
        assertTrue(STORAGE.objects.isEmpty());
        assertEquals(0, documentList("manager").get("items").size());
    }

    @Test
    void estateDeactivationDuringUploadPreventsTheMetadataCommitAndCleansTheObject() throws Exception {
        STORAGE.afterWrite.set(this::inactive);

        mvc.perform(as("crew", submission("INVOICE", pdfFile("invoice.pdf")))).andExpect(status().isConflict());
        assertTrue(STORAGE.objects.isEmpty());
        assertEquals(0, documentList("manager").get("items").size());
    }

    @Test
    void metadataInsertFailureCleansStagedStorageWithoutReportingSuccess() throws Exception {
        upload("crew", "existing.pdf");
        db.execute(
                "alter table \"Document\" add constraint document_test_write_failure check (\"documentType\" <> 'SERVICE_REPORT') not valid");

        mvc.perform(as("crew", submission("SERVICE_REPORT", pdfFile("report.pdf"))))
                .andExpect(status().isInternalServerError());
        assertEquals(1, STORAGE.objects.size());
        assertEquals(1, documentList("crew").get("items").size());
    }

    @ParameterizedTest
    @CsvSource({"invoice,April Invoice.PDF", "'  INVOICE  ',April Invoice.PDF", "report,Lift report.pdf"})
    void filenameSearchUsesTrimmedCaseInsensitiveSubstrings(String search, String expected) throws Exception {
        upload("crew", "April Invoice.PDF");
        upload("crew", "Lift report.pdf");

        mvc.perform(as("crew", get(documents()).param("filename", search)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].originalFilename", contains(expected)));
    }

    @Test
    void wildcardCharactersAreLiteralAndBlankSearchMeansNoFilter() throws Exception {
        upload("crew", "100%_complete.pdf");
        upload("crew", "100XXcomplete.pdf");

        for (String search : List.of("%", "_")) {
            mvc.perform(as("crew", get(documents()).param("filename", search)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items[*].originalFilename", contains("100%_complete.pdf")));
        }
        for (String search : List.of("\\", "' OR 1=1 --", "no match")) {
            mvc.perform(as("crew", get(documents()).param("filename", search)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items").isEmpty());
        }
        mvc.perform(as("crew", get(documents()).param("filename", "   ")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)));
        mvc.perform(as("crew", get(documents()).param("filename", "x".repeat(256))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void searchFiltersBeforePaginationAndBindsTheCursorToTheSearchAndEstate() throws Exception {
        upload("crew", "match-old.pdf");
        upload("crew", "match-new.pdf");
        upload("crew", "unrelated.pdf");
        var first = body(mvc.perform(
                        as("crew", get(documents()).param("filename", "match").param("limit", "1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].originalFilename").value("match-new.pdf")));
        String cursor = first.get("nextCursor").asText();

        mvc.perform(as(
                        "crew",
                        get(documents())
                                .param("filename", "match")
                                .param("limit", "1")
                                .param("cursor", cursor)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].originalFilename").value("match-old.pdf"))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
        mvc.perform(as("crew", get(documents()).param("filename", "unrelated").param("cursor", cursor)))
                .andExpect(status().isBadRequest());
        var foreign = estate("crew");
        mvc.perform(as(
                        "crew",
                        get("/estates/" + foreign + "/documents")
                                .param("filename", "match")
                                .param("cursor", cursor)))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "101", "-1", "invalid"})
    void invalidPageSizesAreRejected(String limit) throws Exception {
        mvc.perform(as("crew", get(documents()).param("limit", limit))).andExpect(status().isBadRequest());
    }

    @Test
    void defaultPagesAreBoundedAndEqualTimestampsUseDescendingIds() throws Exception {
        var ids = new java.util.ArrayList<String>();
        for (int i = 0; i < 27; i++)
            ids.add(upload("crew", "invoice-" + i + ".pdf").get("id").asText());
        db.execute("update \"Document\" set \"createdAt\"='2026-10-01T00:00:00Z' where \"estateId\"=?", estateId);
        var expected = ids.stream().sorted(java.util.Comparator.reverseOrder()).toList();

        mvc.perform(as("crew", get(documents())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(25)))
                .andExpect(jsonPath("$.items[0].id").value(expected.getFirst()))
                .andExpect(jsonPath("$.nextCursor").isNotEmpty());
        mvc.perform(as("crew", get(documents()).param("limit", "100")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].id", contains(expected.toArray())))
                .andExpect(jsonPath("$.nextCursor").value(nullValue()));
        mvc.perform(as("crew", get(documents()).param("cursor", "not-a-cursor")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void inactiveEstatesKeepHistoricalReadsAndDeletionButRejectUploads() throws Exception {
        var document = upload("crew", "history.pdf");
        inactive();

        mvc.perform(as("crew", get(documents()))).andExpect(status().isOk()).andExpect(jsonPath("$.items", hasSize(1)));
        mvc.perform(as("crew", get(downloadPath(id(document))))).andExpect(status().isOk());
        mvc.perform(as("crew", submission("INVOICE", pdfFile("new.pdf")))).andExpect(status().isConflict());
        mvc.perform(as("crew", delete(documents() + "/" + id(document)))).andExpect(status().isNoContent());
    }

    @ParameterizedTest
    @ValueSource(strings = {"owner", "manager", "crew"})
    void onlyTheUploaderOrAnEstateManagerCanRemoveAFile(String caller) throws Exception {
        var document = upload("crew", "invoice.pdf");
        String key = storageKey(id(document));

        mvc.perform(as(caller, delete(documents() + "/" + id(document)))).andExpect(status().isNoContent());
        assertEquals(0, documentList("manager").get("items").size());
        mvc.perform(as("manager", get(downloadPath(id(document))))).andExpect(status().isNotFound());
        assertNotNull(db.fetchValue("select \"deletedAt\" from \"Document\" where id=?", id(document)));
        assertEquals(
                caller,
                db.fetchOne("select \"deletedByUserId\" from \"Document\" where id=?", id(document))
                        .get(0, String.class));
        runCleanup();
        assertFalse(STORAGE.objects.containsKey(key));
    }

    @ParameterizedTest
    @ValueSource(strings = {"member", "second-crew"})
    void otherCouncilAndCrewMembersCannotDeleteSomeoneElsesUpload(String caller) throws Exception {
        var document = upload("crew", "invoice.pdf");

        mvc.perform(as(caller, get(documents())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].canDelete").value(false));
        mvc.perform(as(caller, delete(documents() + "/" + id(document)))).andExpect(status().isForbidden());
        mvc.perform(as("manager", get(documents())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].canDelete").value(true));
        assertEquals(1, documentList("crew").get("items").size());
        assertEquals(1, STORAGE.objects.size());
    }

    @Test
    void revokedUploadersCannotUseAnOldDeleteControl() throws Exception {
        var document = upload("crew", "invoice.pdf");
        revoke("crew");

        mvc.perform(as("crew", delete(documents() + "/" + id(document)))).andExpect(status().isNotFound());
        assertEquals(1, documentList("manager").get("items").size());
    }

    @Test
    void deletionRemovesSearchResultsAndRetriesStorageFailureWithoutLosingItsAudit() throws Exception {
        var document = upload("crew", "invoice.pdf");
        String key = storageKey(id(document));
        STORAGE.deletionUnavailable = true;

        mvc.perform(as("crew", delete(documents() + "/" + id(document)))).andExpect(status().isNoContent());
        mvc.perform(as("manager", get(documents()).param("filename", "invoice")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
        assertTrue(STORAGE.objects.containsKey(key));
        mvc.perform(as("manager", get(downloadPath(id(document))))).andExpect(status().isNotFound());
        STORAGE.deletionUnavailable = false;
        runCleanup();
        assertFalse(STORAGE.objects.containsKey(key));
        assertNotNull(db.fetchValue("select \"storageDeletedAt\" from \"Document\" where id=?", id(document)));
        mvc.perform(as("manager", delete(documents() + "/" + id(document)))).andExpect(status().isNoContent());
        assertEquals(
                "crew",
                db.fetchOne("select \"deletedByUserId\" from \"Document\" where id=?", id(document))
                        .get(0, String.class));
    }

    @Test
    void failedDeletionCommitLeavesTheVisibleDocumentAndStoredBytesIntact() throws Exception {
        var document = upload("crew", "invoice.pdf");
        String key = storageKey(id(document));
        db.execute(
                "alter table \"Document\" add constraint document_test_write_failure check (\"deletedAt\" is null) not valid");

        mvc.perform(as("crew", delete(documents() + "/" + id(document)))).andExpect(status().isInternalServerError());
        assertTrue(STORAGE.objects.containsKey(key));
        assertEquals(1, documentList("crew").get("items").size());
        mvc.perform(as("crew", get(downloadPath(id(document))))).andExpect(status().isOk());
    }

    @Test
    void concurrentAuthorizedDeletesKeepOneOriginalAuditActor() throws Exception {
        var document = upload("crew", "invoice.pdf");
        var start = new CountDownLatch(1);
        try (var workers = Executors.newVirtualThreadPerTaskExecutor()) {
            var attempts = Stream.of("crew", "manager")
                    .map(caller -> workers.submit(() -> {
                        start.await();
                        return mvc.perform(as(caller, delete(documents() + "/" + id(document))))
                                .andReturn()
                                .getResponse()
                                .getStatus();
                    }))
                    .toList();
            start.countDown();
            for (var attempt : attempts) assertEquals(204, attempt.get());
        }
        assertTrue(List.of("crew", "manager")
                .contains(db.fetchOne("select \"deletedByUserId\" from \"Document\" where id=?", id(document))
                        .get(0, String.class)));
        assertEquals(0, documentList("manager").get("items").size());
    }

    @Test
    void orphanCleanupRemovesOnlyOldUnreferencedDocumentObjects() throws Exception {
        var document = upload("crew", "kept.pdf");
        String referenced = storageKey(id(document));
        String oldOrphan = "documents/" + estateId + "/" + UUID.randomUUID();
        String recentOrphan = "documents/" + estateId + "/" + UUID.randomUUID();
        var yesterday = Instant.now().minus(25, ChronoUnit.HOURS);
        ageObject(referenced, yesterday);
        STORAGE.objects.put(oldOrphan, new DocumentR2Stub.StoredObject(pdf(), "application/pdf", yesterday));
        STORAGE.objects.put(recentOrphan, new DocumentR2Stub.StoredObject(pdf(), "application/pdf", Instant.now()));
        STORAGE.objects.put(
                "reports/keep-private-image", new DocumentR2Stub.StoredObject(new byte[] {1}, "image/png", yesterday));

        runCleanup();

        assertFalse(STORAGE.objects.containsKey(oldOrphan));
        assertTrue(STORAGE.objects.containsKey(recentOrphan));
        assertTrue(STORAGE.objects.containsKey(referenced));
        assertTrue(STORAGE.objects.containsKey("reports/keep-private-image"));
    }
}
