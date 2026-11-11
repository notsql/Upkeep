package com.proj.server.document;

import static com.proj.server.estate.EstatePermissionCode.EDIT_DOCUMENTS;
import static com.proj.server.estate.EstatePermissionCode.VIEW_DOCUMENTS;

import com.proj.server.db.tables.records.DocumentRecord;
import com.proj.server.estate.EstatePermissions;
import com.proj.server.storage.ObjectStorage;
import com.proj.server.storage.SignedDownloadResponse;
import com.proj.server.storage.StorageUnavailableException;
import com.proj.server.storage.UploadSlotResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DocumentService {
    static final Duration UPLOAD_TTL = Duration.ofMinutes(10);
    static final Duration DOWNLOAD_TTL = Duration.ofMinutes(5);
    private final DocumentRepository repository;
    private final DocumentValidator validator;
    private final ObjectStorage storage;
    private final TransactionTemplate transactions;

    public DocumentService(
            DocumentRepository repository,
            DocumentValidator validator,
            ObjectStorage storage,
            PlatformTransactionManager manager) {
        this.repository = repository;
        this.validator = validator;
        this.storage = storage;
        this.transactions = new TransactionTemplate(manager);
    }

    /** A signed upload for one file; the browser PUTs it straight to storage, then calls {@link #upload}. */
    public UploadSlotResponse uploadSlot(UUID estate, String user, String fileName, String contentType, long size) {
        repository.authority(estate, user, EDIT_DOCUMENTS, false).requireActive();
        var declared = validator.declared(fileName, contentType, size);
        String key = "documents/" + estate + "/" + UUID.randomUUID();
        return UploadSlotResponse.of(
                key,
                declared.contentType(),
                DocumentValidator.MAX_BYTES,
                storage.signUpload(key, declared.contentType(), DocumentValidator.MAX_BYTES, UPLOAD_TTL));
    }

    /** Confirms an uploaded file: checks it, then writes its row. The document id is the one in the key. */
    public DocumentResponse upload(UUID estate, String user, DocumentType type, String key, String fileName) {
        repository.authority(estate, user, EDIT_DOCUMENTS, false).requireActive();
        UUID id = issuedId(estate, key);
        try {
            var metadata = storage.metadata(key).orElseThrow(DocumentService::notUploaded);
            validator.declared(fileName, metadata.contentType(), metadata.size());
            var object = storage.get(key).orElseThrow(DocumentService::notUploaded);
            var validated = validator.validate(fileName, object.contentType(), object.bytes());
            return transactions.execute(transaction -> {
                var access = repository.authority(estate, user, EDIT_DOCUMENTS, true);
                access.requireActive();
                return response(repository.insert(estate, id, type, user, validated, key), access, user);
            });
        } catch (RuntimeException error) {
            storage.delete(key);
            throw error;
        }
    }

    /** The id in a key Spring issued for this estate; 400 without touching storage for any other key. */
    private UUID issuedId(UUID estate, String key) {
        String prefix = "documents/" + estate + "/";
        try {
            if (key != null && key.startsWith(prefix)) {
                var id = UUID.fromString(key.substring(prefix.length()));
                if (key.equals(prefix + id) && !repository.references(key)) return id;
            }
        } catch (IllegalArgumentException ignored) {
            // Not a key Spring issued.
        }
        throw notUploaded();
    }

    private static ResponseStatusException notUploaded() {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "The file was not uploaded properly. Choose it again and retry.");
    }

    public DocumentPageResponse list(
            UUID estate, String user, String filename, DocumentType documentType, String cursor, Integer limit) {
        var access = repository.authority(estate, user, VIEW_DOCUMENTS, false);
        String search = filename == null ? "" : filename.trim();
        int size = limit == null ? 25 : limit;
        if (search.length() > 255 || size < 1 || size > 100) throw invalidPage();
        OffsetDateTime before = null;
        UUID beforeId = null;
        String binding = estate + "\n"
                + Base64.getUrlEncoder().withoutPadding().encodeToString(search.getBytes(StandardCharsets.UTF_8))
                + "\n";
        if (documentType != null) binding += documentType.name() + "\n";
        if (cursor != null) {
            try {
                String decoded = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
                if (!decoded.startsWith(binding)) throw invalidPage();
                var parts = decoded.substring(binding.length()).split("\n", -1);
                if (parts.length != 2) throw invalidPage();
                before = OffsetDateTime.parse(parts[0]);
                beforeId = UUID.fromString(parts[1]);
            } catch (IllegalArgumentException | java.time.DateTimeException error) {
                throw invalidPage();
            }
        }
        var rows = repository.list(estate, search, documentType, before, beforeId, size + 1);
        boolean more = rows.size() > size;
        var page = rows.stream().limit(size).toList();
        String next = null;
        if (more) {
            var last = page.getLast();
            next = Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(
                            (binding + last.getCreatedat() + "\n" + last.getId()).getBytes(StandardCharsets.UTF_8));
        }
        return new DocumentPageResponse(
                page.stream().map(row -> response(row, access, user)).toList(), next);
    }

    /** A five-minute link that saves the file under its original name. */
    public SignedDownloadResponse download(UUID estate, UUID id, String user) {
        repository.authority(estate, user, VIEW_DOCUMENTS, false);
        var row = repository.find(estate, id, false);
        if (row.getDeletedat() != null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found.");
        String disposition = ContentDisposition.attachment()
                .filename(row.getOriginalfilename(), StandardCharsets.UTF_8)
                .build()
                .toString();
        return SignedDownloadResponse.of(
                storage.signDownload(row.getStoragekey(), DOWNLOAD_TTL, row.getContenttype(), disposition));
    }

    public void delete(UUID estate, UUID id, String user) {
        var row = transactions.execute(transaction -> {
            var access = repository.authority(estate, user, EDIT_DOCUMENTS, true);
            var document = repository.find(estate, id, true);
            if (!canDelete(document, access, user))
                throw new ResponseStatusException(
                        HttpStatus.FORBIDDEN, "Only the uploader or an estate Manager can delete this file.");
            if (document.getDeletedat() == null) repository.markDeleted(id, user);
            return document;
        });
        removeStorage(row);
    }

    private void removeStorage(DocumentRecord row) {
        try {
            if (storage.delete(row.getStoragekey())) repository.storageRemoved(row.getId());
        } catch (RuntimeException ignored) {
            // The committed deletion marker remains available to the next scheduled retry.
        }
    }

    @Scheduled(fixedDelay = 3_600_000, initialDelay = 3_600_000)
    public synchronized void cleanup() {
        for (var row : repository.pendingDeletion()) removeStorage(row);
        var cutoff = Instant.now().minus(24, ChronoUnit.HOURS);
        try {
            for (var object : storage.list("documents/"))
                if (object.lastModified().isBefore(cutoff) && !repository.references(object.key()))
                    storage.delete(object.key());
        } catch (StorageUnavailableException ignored) {
            // A provider outage is retried on the next sweep.
        }
    }

    private static boolean canDelete(DocumentRecord row, EstatePermissions.Authority access, String user) {
        return access.has(EDIT_DOCUMENTS) && (access.manager() || user.equals(row.getUploadedbyuserid()));
    }

    private static DocumentResponse response(DocumentRecord row, EstatePermissions.Authority access, String user) {
        return new DocumentResponse(
                row.getId(),
                row.getEstateid(),
                DocumentType.valueOf(row.getDocumenttype()),
                row.getOriginalfilename(),
                row.getContenttype(),
                row.getSizebytes(),
                row.getCreatedat(),
                canDelete(row, access, user));
    }

    private static ResponseStatusException invalidPage() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid filename search, cursor or page size.");
    }
}
