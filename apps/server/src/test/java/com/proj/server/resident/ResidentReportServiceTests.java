package com.proj.server.resident;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.proj.server.routing.RoutingRepository;
import com.proj.server.storage.InMemoryObjectStorage;
import com.proj.server.storage.StorageUnavailableException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

class ResidentReportServiceTests {
    private final ResidentReportRepository reports = mock(ResidentReportRepository.class);
    private final InMemoryObjectStorage storage = new InMemoryObjectStorage();
    private final ImageUploads images = new ImageUploads(storage, new ResidentImageValidator());
    private final TransactionTemplate transactions = mock(TransactionTemplate.class);
    private final RoutingRepository routing = mock(RoutingRepository.class);
    private final ResidentReportService service = new ResidentReportService(
            reports, images, transactions, mock(com.proj.server.report.DuplicateService.class), routing);
    private final UUID estateId = UUID.randomUUID();
    private final UUID locationId = UUID.randomUUID();
    private final UUID reportId = UUID.randomUUID();

    @Test
    void rejectsAFiftyOneCharacterTitleBeforeLookingUpTheEstate() {
        var error = assertThrows(
                ResidentReportException.class,
                () -> service.create(
                        "resident-a",
                        UUID.randomUUID(),
                        null,
                        "x".repeat(51),
                        "Description",
                        UUID.randomUUID(),
                        List.of()));
        assertEquals(HttpStatus.BAD_REQUEST, error.status());
        verifyNoInteractions(reports, transactions);
    }

    @Test
    void rejectsBlankAndOverFiftyCharacterTitlesBeforeAnyPersistenceOrUpload() {
        var locationId = UUID.randomUUID();
        for (var title : new String[] {null, "", "   ", "x".repeat(51), "  " + "x".repeat(51) + "  "}) {
            var error = assertThrows(
                    ResidentReportException.class,
                    () -> service.create(
                            "resident-a", UUID.randomUUID(), null, title, "Description", locationId, List.of()));
            assertEquals(HttpStatus.BAD_REQUEST, error.status());
            assertEquals("Enter a title in 1 to 50 characters.", error.getMessage());
        }
        verifyNoInteractions(reports, transactions);
    }

    @Test
    void acceptsAndTrimsAFiftyCharacterTitleBeforeSaving() {
        var estate = new ResidentContextResponse.EstateLabel(estateId, "Maple Estate");
        var title = "x".repeat(50);
        var now = OffsetDateTime.now();
        var detail = new IssueReportDetailResponse(
                UUID.randomUUID(), title, "Description", "Maple Estate", null, "SUBMITTED", now, now, List.of());
        when(reports.activeAssignment("resident-a", estateId, false)).thenReturn(Optional.of(estate));
        when(reports.activeAssignment("resident-a", estateId, true)).thenReturn(Optional.of(estate));
        when(reports.activeReportLocation(estateId, locationId)).thenReturn(true);
        when(reports.detail(eq("resident-a"), any())).thenReturn(Optional.of(detail));
        when(transactions.execute(any())).thenAnswer(call -> {
            TransactionCallback<IssueReportDetailResponse> callback = call.getArgument(0);
            return callback.doInTransaction(null);
        });

        assertEquals(
                detail,
                service.create(
                        "resident-a", estateId, null, "  " + title + "  ", "Description", locationId, List.of()));
        verify(reports).create(any(), eq("resident-a"), eq(estateId), eq(locationId), eq(title), eq("Description"));
        assertTrue(storage.objects.isEmpty());
    }

    @Test
    void anImageSlotIsATenMinuteSignedUploadUnderANewReportsKeyForAnAssignedResident() {
        assigned();

        var slot = service.imageSlot("resident-a", estateId, null, "image/png", 1_000);

        assertNotNull(slot.reportId());
        assertTrue(slot.objectKey().startsWith("reports/" + slot.reportId() + "/"));
        assertTrue(slot.uploadUrl().contains("contentType=image%2Fpng"));
        assertEquals(ResidentImageValidator.MAX_BYTES, slot.maxBytes());
        var minutes = java.time.Duration.between(java.time.Instant.now(), slot.expiresAt())
                .toMinutes();
        assertTrue(minutes >= 9 && minutes <= 10);
        var second = service.imageSlot("resident-a", estateId, slot.reportId(), "image/jpeg", 1_000);
        assertEquals(slot.reportId(), second.reportId());
        assertNotEquals(slot.objectKey(), second.objectKey());
    }

    @Test
    void anImageSlotRefusesUnassignedResidentsOtherTypesAndOversizedFiles() {
        when(reports.activeAssignment("resident-a", estateId, false)).thenReturn(Optional.empty());
        assertEquals(HttpStatus.FORBIDDEN, slotError("image/png", 10).status());
        assigned();
        assertEquals(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE, slotError("image/gif", 10).status());
        assertEquals(
                HttpStatus.PAYLOAD_TOO_LARGE,
                slotError("image/png", 5L * 1024 * 1024 + 1).status());
    }

    @Test
    void anImageSlotIsUnavailableWhileStorageIsOff() {
        assigned();
        storage.unavailable = true;
        assertThrows(
                StorageUnavailableException.class,
                () -> service.imageSlot("resident-a", estateId, null, "image/png", 10));
    }

    @Test
    void creatingWithAnUploadedImageStoresARowAndACleanCopy() throws Exception {
        assignedAndSaving();
        var key = "reports/" + reportId + "/" + UUID.randomUUID();
        storage.upload(key, png(2, 2), "image/png");

        service.create("resident-a", estateId, reportId, "Leak", "Water", locationId, List.of(key));

        verify(reports).create(eq(reportId), eq("resident-a"), eq(estateId), eq(locationId), eq("Leak"), eq("Water"));
        verify(reports).addImage(any(), eq(reportId), eq(key), eq("image/png"), anyInt());
        assertNotNull(javax.imageio.ImageIO.read(
                new java.io.ByteArrayInputStream(storage.objects.get(key).bytes())));
    }

    @Test
    void aKeyWithNoObjectBehindItIsRejectedAndNothingIsWritten() {
        assignedAndSaving();
        var key = "reports/" + reportId + "/" + UUID.randomUUID();

        var error = createError(key);

        assertEquals(HttpStatus.BAD_REQUEST, error.status());
        verify(reports, never()).create(any(), any(), any(), any(), any(), any());
    }

    @Test
    void aKeyOutsideThisReportIsRejectedAndTheObjectIsLeftAlone() throws Exception {
        assignedAndSaving();
        var foreign = "reports/" + UUID.randomUUID() + "/" + UUID.randomUUID();
        storage.upload(foreign, png(2, 2), "image/png");

        assertEquals(HttpStatus.BAD_REQUEST, createError(foreign).status());
        assertTrue(storage.objects.containsKey(foreign));
        assertEquals(
                HttpStatus.BAD_REQUEST,
                createError("documents/" + estateId + "/x").status());
        verify(reports, never()).create(any(), any(), any(), any(), any(), any());
    }

    @Test
    void aKeyAlreadyConfirmedIsRejectedAndStaysWithItsReport() throws Exception {
        assignedAndSaving();
        var key = "reports/" + reportId + "/" + UUID.randomUUID();
        storage.upload(key, png(2, 2), "image/png");
        when(reports.hasStorageKey(key)).thenReturn(true);

        assertEquals(HttpStatus.BAD_REQUEST, createError(key).status());
        assertTrue(storage.objects.containsKey(key));
    }

    @Test
    void anObjectOfTheWrongTypeOrSizeOrUnreadablePixelsIsDeletedAndNoRowWritten() throws Exception {
        assignedAndSaving();
        var gif = "reports/" + reportId + "/" + UUID.randomUUID();
        storage.upload(gif, png(2, 2), "image/gif");
        assertEquals(HttpStatus.UNSUPPORTED_MEDIA_TYPE, createError(gif).status());
        assertFalse(storage.objects.containsKey(gif));

        var huge = "reports/" + reportId + "/" + UUID.randomUUID();
        storage.upload(huge, new byte[(int) ResidentImageValidator.MAX_BYTES + 1], "image/png");
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, createError(huge).status());
        assertFalse(storage.objects.containsKey(huge));

        var broken = "reports/" + reportId + "/" + UUID.randomUUID();
        storage.upload(broken, new byte[] {1, 2, 3}, "image/png");
        assertEquals(HttpStatus.BAD_REQUEST, createError(broken).status());
        assertFalse(storage.objects.containsKey(broken));

        var wide = "reports/" + reportId + "/" + UUID.randomUUID();
        storage.upload(wide, png(4033, 1), "image/png");
        assertEquals(HttpStatus.BAD_REQUEST, createError(wide).status());
        assertFalse(storage.objects.containsKey(wide));
        verify(reports, never()).create(any(), any(), any(), any(), any(), any());
    }

    @Test
    void aFailedCommitDeletesTheUploadedObjects() throws Exception {
        assignedAndSaving();
        org.mockito.Mockito.doThrow(new IllegalStateException("database down"))
                .when(transactions)
                .execute(any());
        var key = "reports/" + reportId + "/" + UUID.randomUUID();
        storage.upload(key, png(2, 2), "image/png");

        assertThrows(
                IllegalStateException.class,
                () -> service.create("resident-a", estateId, reportId, "Leak", "Water", locationId, List.of(key)));
        assertFalse(storage.objects.containsKey(key));
    }

    @Test
    void anImageLinkIsAFiveMinuteSignedDownload() {
        var image = UUID.randomUUID();
        when(reports.image("resident-a", reportId, image))
                .thenReturn(Optional.of(new ResidentReportRepository.StoredImage("reports/x/y", "image/png")));

        var link = service.image("resident-a", reportId, image);

        assertTrue(link.url().startsWith("memory://download/reports/x/y"));
        var minutes = java.time.Duration.between(java.time.Instant.now(), link.expiresAt())
                .toMinutes();
        assertTrue(minutes >= 4 && minutes <= 5);
    }

    @Test
    void theSweepDeletesOnlyUnconfirmedObjectsOlderThanADay() throws Exception {
        var old = "reports/" + reportId + "/old";
        var kept = "reports/" + reportId + "/kept";
        var fresh = "reports/" + reportId + "/fresh";
        var document = "documents/" + estateId + "/old";
        for (var key : List.of(old, kept, fresh, document)) storage.upload(key, png(1, 1), "image/png");
        var yesterday = java.time.Instant.now().minus(java.time.Duration.ofHours(25));
        for (var key : List.of(old, kept, document)) storage.age(key, yesterday);
        when(reports.hasStorageKey(kept)).thenReturn(true);

        service.cleanupOrphans();

        assertFalse(storage.objects.containsKey(old));
        assertTrue(storage.objects.containsKey(kept));
        assertTrue(storage.objects.containsKey(fresh));
        assertTrue(storage.objects.containsKey(document));
    }

    private ResidentReportException slotError(String type, long size) {
        return assertThrows(
                ResidentReportException.class, () -> service.imageSlot("resident-a", estateId, null, type, size));
    }

    private ResidentReportException createError(String key) {
        return assertThrows(
                ResidentReportException.class,
                () -> service.create("resident-a", estateId, reportId, "Leak", "Water", locationId, List.of(key)));
    }

    private void assigned() {
        when(reports.activeAssignment("resident-a", estateId, false))
                .thenReturn(Optional.of(new ResidentContextResponse.EstateLabel(estateId, "Maple Estate")));
    }

    private void assignedAndSaving() {
        var estate = new ResidentContextResponse.EstateLabel(estateId, "Maple Estate");
        var now = OffsetDateTime.now();
        when(reports.activeAssignment("resident-a", estateId, false)).thenReturn(Optional.of(estate));
        when(reports.activeAssignment("resident-a", estateId, true)).thenReturn(Optional.of(estate));
        when(reports.activeReportLocation(estateId, locationId)).thenReturn(true);
        when(reports.detail(eq("resident-a"), any()))
                .thenReturn(Optional.of(new IssueReportDetailResponse(
                        reportId, "Leak", "Water", "Maple Estate", null, "SUBMITTED", now, now, List.of())));
        when(transactions.execute(any())).thenAnswer(call -> {
            TransactionCallback<IssueReportDetailResponse> callback = call.getArgument(0);
            return callback.doInTransaction(null);
        });
    }

    private static byte[] png(int width, int height) throws Exception {
        var output = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(
                new java.awt.image.BufferedImage(width, height, java.awt.image.BufferedImage.TYPE_INT_RGB),
                "png",
                output);
        return output.toByteArray();
    }

    @Test
    void listCountsEveryStatusAcrossAllPagesWithAssignedAsInProgressAndClosedAsResolved() {
        var estateId = UUID.randomUUID();
        when(reports.list("resident-a", estateId, null, null, 2)).thenReturn(List.of());
        when(reports.statusCounts("resident-a", estateId))
                .thenReturn(Map.of("SUBMITTED", 3, "ASSIGNED", 2, "IN_PROGRESS", 1, "CLOSED", 4));

        var page = service.list("resident-a", estateId, null, 1);

        assertEquals(new ResidentReportPageResponse.ReportCounts(3, 3, 4), page.counts());
    }
}
