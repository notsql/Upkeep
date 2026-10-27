package com.proj.server.asset;

import static com.proj.server.estate.EstatePermissionCode.EDIT_DOCUMENTS;
import static com.proj.server.estate.EstatePermissionCode.VIEW_DOCUMENTS;

import com.proj.server.db.tables.records.DocumentRecord;
import com.proj.server.document.DocumentPageResponse;
import com.proj.server.document.DocumentRepository;
import com.proj.server.document.DocumentResponse;
import com.proj.server.document.DocumentType;
import com.proj.server.estate.EstatePermissions;
import com.proj.server.estate.EstateRepository;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AssetDocumentService {
    private final AssetDocumentRepository links;
    private final DocumentRepository documents;
    private final EstateRepository estates;

    public AssetDocumentService(AssetDocumentRepository links, DocumentRepository documents, EstateRepository estates) {
        this.links = links;
        this.documents = documents;
        this.estates = estates;
    }

    private EstatePermissions.Authority authorize(UUID estate, String user, boolean write) {
        // Resolve live membership under the same estate lock as document deletion
        // and work-order association writes, then reuse ordinary asset ownership.
        var access = links.authority(estate, user, write);
        if (estates.findOwned(estate, user, false).isEmpty())
            throw error(HttpStatus.FORBIDDEN, "Asset-editing authority is required.");
        if (write) access.requireActive();
        else access.require(VIEW_DOCUMENTS);
        return access;
    }

    private DocumentRecord document(UUID estate, UUID id, boolean lock) {
        var document = documents.find(estate, id, lock);
        if (document.getDeletedat() != null) throw error(HttpStatus.NOT_FOUND, "Document not found.");
        return document;
    }

    public DocumentAssetResponse association(UUID estate, UUID id, String user) {
        authorize(estate, user, false);
        return response(document(estate, id, false));
    }

    @Transactional
    public DocumentAssetResponse change(UUID estate, UUID id, String user, ChangeDocumentAssetRequest request) {
        authorize(estate, user, true);
        var document = document(estate, id, true);
        if (document.getAssetassociationversion().intValue() != request.expectedAssociationVersion())
            throw error(HttpStatus.CONFLICT, "The association changed. Refresh and review before saving.");
        if (request.assetId() != null) links.asset(estate, request.assetId());
        if (Objects.equals(document.getAssetid(), request.assetId())) return response(document);
        if (document.getAssetid() != null && request.assetId() != null)
            throw error(HttpStatus.CONFLICT, "Unlink the document before selecting another asset.");
        documents.requireCompatibleWorkOrder(estate, document.getWorkorderid(), request.assetId());
        links.change(document, request.assetId(), user, OffsetDateTime.now(ZoneOffset.UTC));
        return response(document(estate, id, false));
    }

    public DocumentPageResponse attachments(UUID estate, UUID asset, String user, String cursor, Integer limit) {
        var access = authorize(estate, user, false);
        links.asset(estate, asset);
        int size = limit == null ? 25 : limit;
        if (size < 1 || size > 100) throw badCursor();
        OffsetDateTime before = null;
        UUID beforeId = null;
        if (cursor != null) {
            try {
                String[] parts =
                        new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8).split("\\|", -1);
                if (parts.length != 6
                        || !parts[0].equals("v1")
                        || !parts[1].equals("asset-documents")
                        || !parts[2].equals(estate.toString())
                        || !parts[3].equals(asset.toString())) throw badCursor();
                before = OffsetDateTime.parse(parts[4]);
                beforeId = UUID.fromString(parts[5]);
            } catch (IllegalArgumentException | java.time.format.DateTimeParseException invalid) {
                throw badCursor();
            }
        }
        var rows = links.attachments(estate, asset, before, beforeId, size + 1);
        var page = rows.stream().limit(size).toList();
        String next = rows.size() > size
                ? Base64.getUrlEncoder()
                        .withoutPadding()
                        .encodeToString(("v1|asset-documents|" + estate + "|" + asset + "|"
                                        + page.getLast().getCreatedat() + "|"
                                        + page.getLast().getId())
                                .getBytes(StandardCharsets.UTF_8))
                : null;
        return new DocumentPageResponse(
                page.stream()
                        .map(row -> new DocumentResponse(
                                row.getId(),
                                row.getEstateid(),
                                DocumentType.valueOf(row.getDocumenttype()),
                                row.getOriginalfilename(),
                                row.getContenttype(),
                                row.getSizebytes(),
                                row.getCreatedat(),
                                access.has(EDIT_DOCUMENTS)
                                        && (access.manager() || user.equals(row.getUploadedbyuserid()))))
                        .toList(),
                next);
    }

    private DocumentAssetResponse response(DocumentRecord document) {
        var asset = document.getAssetid() == null ? null : links.asset(document.getEstateid(), document.getAssetid());
        return new DocumentAssetResponse(
                document.getId(),
                document.getAssetid(),
                asset == null ? null : asset.getReference(),
                asset == null ? null : asset.getName(),
                document.getAssetassociationversion(),
                document.getAssetassociationchangedat());
    }

    private static ResponseStatusException badCursor() {
        return error(HttpStatus.BAD_REQUEST, "Invalid asset document pagination cursor or limit.");
    }

    private static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }
}
