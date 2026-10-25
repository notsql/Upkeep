package com.proj.server.document;

import static com.proj.server.estate.EstatePermissionCode.EDIT_DOCUMENTS;
import static com.proj.server.estate.EstatePermissionCode.VIEW_DOCUMENTS;

import com.proj.server.db.tables.records.DocumentRecord;
import com.proj.server.estate.EstatePermissions;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class DocumentService {
    private final DocumentRepository repository;
    private final DocumentValidator validator;
    private final DocumentStore store;
    private final TransactionTemplate transactions;
    private String cleanupCursor;

    public DocumentService(
            DocumentRepository repository,
            DocumentValidator validator,
            DocumentStore store,
            PlatformTransactionManager manager) {
        this.repository = repository;
        this.validator = validator;
        this.store = store;
        this.transactions = new TransactionTemplate(manager);
    }

    public DocumentResponse upload(UUID estate, String user, DocumentType type, MultipartFile file) {
        repository.authority(estate, user, EDIT_DOCUMENTS, false).requireActive();
        var validated = validator.validate(file);
        UUID id = UUID.randomUUID();
        String key = "documents/" + estate + "/" + id;
        try {
            store.upload(key, validated);
            return transactions.execute(transaction -> {
                var access = repository.authority(estate, user, EDIT_DOCUMENTS, true);
                access.requireActive();
                return response(repository.insert(estate, id, type, user, validated, key), access, user);
            });
        } catch (RuntimeException error) {
            store.delete(key);
            throw error;
        }
    }

    public DocumentPageResponse list(UUID estate, String user, String filename, String cursor, Integer limit) {
        var access = repository.authority(estate, user, VIEW_DOCUMENTS, false);
        String search = filename == null ? "" : filename.trim();
        int size = limit == null ? 25 : limit;
        if (search.length() > 255 || size < 1 || size > 100) throw invalidPage();
        OffsetDateTime before = null;
        UUID beforeId = null;
        String binding = estate + "\n"
                + Base64.getUrlEncoder().withoutPadding().encodeToString(search.getBytes(StandardCharsets.UTF_8))
                + "\n";
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
        var rows = repository.list(estate, search, before, beforeId, size + 1);
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

    public Content download(UUID estate, UUID id, String user) {
        repository.authority(estate, user, VIEW_DOCUMENTS, false);
        var row = repository.find(estate, id, false);
        if (row.getDeletedat() != null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found.");
        return new Content(row.getOriginalfilename(), row.getContenttype(), store.read(row.getStoragekey()));
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
            if (store.delete(row.getStoragekey())) repository.storageRemoved(row.getId());
        } catch (RuntimeException ignored) {
            // The committed deletion marker remains available to the next scheduled retry.
        }
    }

    @Scheduled(fixedDelay = 3_600_000, initialDelay = 3_600_000)
    public synchronized void cleanup() {
        for (var row : repository.pendingDeletion()) removeStorage(row);
        var cutoff = Instant.now().minus(24, ChronoUnit.HOURS);
        try {
            for (int page = 0; page < 5; page++) {
                var objects = store.list(cleanupCursor);
                for (var object : objects.contents()) {
                    if (object.lastModified().isBefore(cutoff) && !repository.references(object.key()))
                        store.delete(object.key());
                }
                cleanupCursor = objects.nextContinuationToken();
                if (cleanupCursor == null) return;
            }
        } catch (ResponseStatusException ignored) {
            // Missing configuration or a provider outage is retried on the next sweep.
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

    public record Content(String filename, String contentType, byte[] bytes) {}
}
