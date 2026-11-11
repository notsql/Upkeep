package com.proj.server.document;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.proj.server.db.tables.records.DocumentRecord;
import com.proj.server.db.tables.records.EstateRecord;
import com.proj.server.estate.EstatePermissions;
import com.proj.server.storage.InMemoryObjectStorage;
import com.proj.server.storage.StorageUnavailableException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.web.server.ResponseStatusException;

/** The document upload, confirm and download steps against the in-memory storage fake (decision 0050). */
class DocumentServiceTests {
    private static final byte[] PDF = "%PDF-1.4\n%%EOF\n".getBytes(StandardCharsets.US_ASCII);
    private final DocumentRepository repository = mock(DocumentRepository.class);
    private final InMemoryObjectStorage storage = new InMemoryObjectStorage();
    private final DocumentService service =
            new DocumentService(repository, new DocumentValidator(), storage, mock(PlatformTransactionManager.class));
    private final UUID estate = UUID.randomUUID();

    @BeforeEach
    void manager() {
        var authority = new EstatePermissions.Authority(new EstateRecord(), "MANAGER", null, true, Set.of());
        when(repository.authority(eq(estate), eq("manager"), any(), anyBoolean()))
                .thenReturn(authority);
        when(repository.insert(eq(estate), any(), any(), any(), any(), any())).thenAnswer(call -> {
            var row = new DocumentRecord();
            row.setId(call.getArgument(1));
            row.setEstateid(estate);
            row.setDocumenttype(call.<DocumentType>getArgument(2).name());
            row.setOriginalfilename(
                    call.<DocumentValidator.ValidatedDocument>getArgument(4).filename());
            row.setContenttype("application/pdf");
            row.setSizebytes(PDF.length);
            row.setCreatedat(OffsetDateTime.now());
            row.setUploadedbyuserid("manager");
            return row;
        });
    }

    @Test
    void anUploadSlotIsATenMinuteSignedPutUnderThisEstatesDocuments() {
        var slot = service.uploadSlot(estate, "manager", "invoice.pdf", "application/pdf", PDF.length);

        assertTrue(slot.objectKey().matches("documents/" + estate + "/[0-9a-f-]{36}"));
        assertTrue(slot.uploadUrl().startsWith("memory://upload/" + slot.objectKey()));
        assertTrue(slot.uploadUrl().contains("maxBytes=5000000"));
        assertEquals("application/pdf", slot.contentType());
        assertEquals(5_000_000, slot.maxBytes());
        var minutes = Duration.between(Instant.now(), slot.expiresAt()).toMinutes();
        assertTrue(minutes >= 9 && minutes <= 10);
    }

    @Test
    void anUploadSlotRefusesOtherTypesAndOversizedFiles() {
        assertEquals(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                slotError("notes.txt", "text/plain", 10).getStatusCode());
        assertEquals(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                slotError("invoice.pdf", "image/png", 10).getStatusCode());
        assertEquals(
                HttpStatus.PAYLOAD_TOO_LARGE,
                slotError("invoice.pdf", "application/pdf", 5_000_001).getStatusCode());
    }

    @Test
    void anUploadSlotIsUnavailableWhileStorageIsOff() {
        storage.unavailable = true;
        assertThrows(
                StorageUnavailableException.class,
                () -> service.uploadSlot(estate, "manager", "invoice.pdf", "application/pdf", 10));
    }

    @Test
    void confirmingAnUploadedFileWritesARowWithTheIdFromTheKey() {
        var slot = service.uploadSlot(estate, "manager", "invoice.pdf", "application/pdf", PDF.length);
        storage.upload(slot.objectKey(), PDF, "application/pdf");

        var created = service.upload(estate, "manager", DocumentType.INVOICE, slot.objectKey(), "invoice.pdf");

        assertEquals(slot.objectKey(), "documents/" + estate + "/" + created.id());
        verify(repository)
                .insert(
                        eq(estate),
                        eq(created.id()),
                        eq(DocumentType.INVOICE),
                        eq("manager"),
                        any(),
                        eq(slot.objectKey()));
    }

    @Test
    void aKeyWithNoObjectIsRejectedAndNoRowIsWritten() {
        var key = "documents/" + estate + "/" + UUID.randomUUID();
        assertEquals(HttpStatus.BAD_REQUEST, createError(key, "invoice.pdf").getStatusCode());
        verify(repository, never()).insert(any(), any(), any(), any(), any(), any());
    }

    @Test
    void aKeyOutsideThisEstateIsRejectedAndTheObjectIsLeftAlone() {
        var foreign = "documents/" + UUID.randomUUID() + "/" + UUID.randomUUID();
        storage.upload(foreign, PDF, "application/pdf");

        assertEquals(HttpStatus.BAD_REQUEST, createError(foreign, "invoice.pdf").getStatusCode());
        assertTrue(storage.objects.containsKey(foreign));
        verify(repository, never()).insert(any(), any(), any(), any(), any(), any());
    }

    @Test
    void aKeyAlreadyConfirmedIsRejectedAndStaysWithItsRow() {
        var key = "documents/" + estate + "/" + UUID.randomUUID();
        storage.upload(key, PDF, "application/pdf");
        when(repository.references(key)).thenReturn(true);

        assertEquals(HttpStatus.BAD_REQUEST, createError(key, "invoice.pdf").getStatusCode());
        assertTrue(storage.objects.containsKey(key));
    }

    @Test
    void anObjectThatBreaksTheLimitsIsDeletedAndNoRowIsWritten() {
        var big = "documents/" + estate + "/" + UUID.randomUUID();
        storage.upload(big, new byte[5_000_001], "application/pdf");
        assertEquals(
                HttpStatus.PAYLOAD_TOO_LARGE, createError(big, "invoice.pdf").getStatusCode());
        assertFalse(storage.objects.containsKey(big));

        var wrongType = "documents/" + estate + "/" + UUID.randomUUID();
        storage.upload(wrongType, PDF, "text/plain");
        assertEquals(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                createError(wrongType, "invoice.pdf").getStatusCode());
        assertFalse(storage.objects.containsKey(wrongType));

        var fake = "documents/" + estate + "/" + UUID.randomUUID();
        storage.upload(fake, "not a pdf".getBytes(StandardCharsets.US_ASCII), "application/pdf");
        assertEquals(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                createError(fake, "invoice.pdf").getStatusCode());
        assertFalse(storage.objects.containsKey(fake));
        verify(repository, never()).insert(any(), any(), any(), any(), any(), any());
    }

    @Test
    void aFailedCommitDeletesTheObject() {
        var key = "documents/" + estate + "/" + UUID.randomUUID();
        storage.upload(key, PDF, "application/pdf");
        when(repository.insert(eq(estate), any(), any(), any(), any(), any()))
                .thenThrow(new IllegalStateException("database down"));

        assertThrows(
                IllegalStateException.class,
                () -> service.upload(estate, "manager", DocumentType.INVOICE, key, "invoice.pdf"));
        assertFalse(storage.objects.containsKey(key));
    }

    @Test
    void aDownloadIsAFiveMinuteLinkThatSavesUnderTheOriginalName() {
        var id = UUID.randomUUID();
        var row = new DocumentRecord();
        row.setId(id);
        row.setStoragekey("documents/" + estate + "/" + id);
        row.setOriginalfilename("Lift invoice.pdf");
        row.setContenttype("application/pdf");
        when(repository.find(estate, id, false)).thenReturn(row);

        var link = service.download(estate, id, "manager");

        assertTrue(link.url().startsWith("memory://download/documents/" + estate + "/" + id));
        assertTrue(link.url().contains("contentType=application%2Fpdf"));
        assertTrue(link.url().contains("disposition=attachment"), link.url());
        assertTrue(link.url().contains("Lift+invoice.pdf"), link.url());
        var minutes = Duration.between(Instant.now(), link.expiresAt()).toMinutes();
        assertTrue(minutes >= 4 && minutes <= 5);
    }

    private ResponseStatusException slotError(String name, String type, long size) {
        return assertThrows(
                ResponseStatusException.class, () -> service.uploadSlot(estate, "manager", name, type, size));
    }

    private ResponseStatusException createError(String key, String name) {
        return assertThrows(
                ResponseStatusException.class,
                () -> service.upload(estate, "manager", DocumentType.INVOICE, key, name));
    }
}
