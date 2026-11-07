package com.proj.server.workorder;

import static com.proj.server.estate.EstatePermissionCode.EDIT_DOCUMENTS;
import static com.proj.server.estate.EstatePermissionCode.VIEW_DOCUMENTS;

import com.proj.server.db.tables.records.DocumentRecord;
import com.proj.server.document.DocumentPageResponse;
import com.proj.server.document.DocumentRepository;
import com.proj.server.document.DocumentResponse;
import com.proj.server.document.DocumentType;
import com.proj.server.estate.EstatePermissions;
import com.proj.server.workos.WorkOSService;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkOrderDocumentService {
    private final DocumentRepository documents;
    private final WorkOrderService orders;
    private final WorkOrderDocumentRepository links;
    private final WorkOSService identity;

    public WorkOrderDocumentService(
            DocumentRepository documents,
            WorkOrderService orders,
            WorkOrderDocumentRepository links,
            WorkOSService identity) {
        this.documents = documents;
        this.orders = orders;
        this.links = links;
        this.identity = identity;
    }

    public String actorName(String user) {
        return identity.findDisplayName(user).orElse(null);
    }

    private EstatePermissions.Authority authorize(UUID estate, String user, boolean write) {
        var access = documents.authority(estate, user, write ? EDIT_DOCUMENTS : VIEW_DOCUMENTS, write);
        if (write) access.requireManager();
        orders.authorize(estate, user, write, false);
        return access;
    }

    private DocumentRecord document(UUID estate, UUID id, boolean lock) {
        var record = documents.find(estate, id, lock);
        if (record.getDeletedat() != null) throw error(HttpStatus.NOT_FOUND, "Document not found.");
        return record;
    }

    public DocumentWorkOrderResponse association(UUID estate, UUID id, String user) {
        authorize(estate, user, false);
        return response(document(estate, id, false));
    }

    @Transactional
    public DocumentWorkOrderResponse change(
            UUID estate, UUID id, String user, String name, ChangeDocumentWorkOrderRequest request) {
        authorize(estate, user, true);
        var document = document(estate, id, true);
        if (document.getWorkorderassociationversion().intValue() != request.expectedAssociationVersion())
            throw error(HttpStatus.CONFLICT, "This document association changed. Refresh and review it before saving.");
        documents.requireCompatibleWorkOrder(estate, request.workOrderId(), document.getAssetid());
        if (Objects.equals(document.getWorkorderid(), request.workOrderId())) return response(document);
        String reason = request.correctionReason() == null
                ? null
                : request.correctionReason().trim();
        if (document.getWorkorderid() != null && (reason == null || reason.isEmpty()))
            throw error(HttpStatus.BAD_REQUEST, "Enter a reason for changing or removing the work-order link.");
        links.change(document, request.workOrderId(), user, name, reason, OffsetDateTime.now(ZoneOffset.UTC));
        return response(document(estate, id, false));
    }

    public DocumentWorkOrderEventPageResponse history(UUID estate, UUID id, String user, String cursor, Integer limit) {
        authorize(estate, user, false);
        document(estate, id, false);
        int size = pageSize(limit);
        int after = 0;
        if (cursor != null) {
            var parts = decode(cursor, "history", estate, id, 5);
            try {
                after = Integer.parseInt(parts[4]);
                if (after < 1) throw new IllegalArgumentException();
            } catch (IllegalArgumentException invalid) {
                throw badCursor();
            }
        }
        var rows = links.history(estate, id, after, size + 1);
        boolean more = rows.size() > size;
        var page = rows.stream().limit(size).toList();
        return new DocumentWorkOrderEventPageResponse(
                page,
                more
                        ? encode(
                                "history",
                                estate,
                                id,
                                String.valueOf(page.getLast().associationVersion()))
                        : null);
    }

    public DocumentPageResponse attachments(UUID estate, UUID order, String user, String cursor, Integer limit) {
        var access = authorize(estate, user, false);
        if (links.reference(estate, order) == null) throw error(HttpStatus.NOT_FOUND, "Work order not found.");
        int size = pageSize(limit);
        OffsetDateTime before = null;
        UUID beforeId = null;
        if (cursor != null) {
            var parts = decode(cursor, "attachments", estate, order, 6);
            try {
                before = OffsetDateTime.parse(parts[4]);
                beforeId = UUID.fromString(parts[5]);
            } catch (RuntimeException invalid) {
                throw badCursor();
            }
        }
        var rows = links.attachments(estate, order, before, beforeId, size + 1);
        boolean more = rows.size() > size;
        var page = rows.stream().limit(size).toList();
        String next = more
                ? encode(
                        "attachments",
                        estate,
                        order,
                        page.getLast().getCreatedat() + "|" + page.getLast().getId())
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

    private DocumentWorkOrderResponse response(DocumentRecord document) {
        var last = links.latest(document.getId());
        return new DocumentWorkOrderResponse(
                document.getId(),
                document.getWorkorderid(),
                links.reference(document.getEstateid(), document.getWorkorderid()),
                document.getWorkorderassociationversion(),
                last == null ? null : last.getChangedbyname(),
                last == null ? null : last.getChangedat());
    }

    private static int pageSize(Integer limit) {
        int size = limit == null ? 25 : limit;
        if (size < 1 || size > 100) throw badCursor();
        return size;
    }

    private static String encode(String type, UUID estate, UUID id, String position) {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(
                        ("v1|" + type + "|" + estate + "|" + id + "|" + position).getBytes(StandardCharsets.UTF_8));
    }

    private static String[] decode(String cursor, String type, UUID estate, UUID id, int length) {
        try {
            var parts = new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8).split("\\|", -1);
            if (parts.length != length
                    || !parts[0].equals("v1")
                    || !parts[1].equals(type)
                    || !parts[2].equals(estate.toString())
                    || !parts[3].equals(id.toString())) throw badCursor();
            return parts;
        } catch (IllegalArgumentException invalid) {
            throw badCursor();
        }
    }

    private static WorkOrderException badCursor() {
        return error(HttpStatus.BAD_REQUEST, "Invalid document pagination cursor or limit.");
    }

    private static WorkOrderException error(HttpStatus status, String message) {
        return new WorkOrderException(status, message);
    }
}
