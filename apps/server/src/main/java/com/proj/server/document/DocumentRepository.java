package com.proj.server.document;

import static com.proj.server.db.tables.Document.DOCUMENT;
import static com.proj.server.db.tables.Workorder.WORKORDER;

import com.proj.server.db.tables.records.DocumentRecord;
import com.proj.server.estate.EstatePermissionCode;
import com.proj.server.estate.EstatePermissions;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class DocumentRepository {
    private final DSLContext db;

    public DocumentRepository(DSLContext db) {
        this.db = db;
    }

    public EstatePermissions.Authority authority(
            UUID estate, String user, EstatePermissionCode permission, boolean lock) {
        var authority = EstatePermissions.authority(db, estate, user, lock);
        authority.require(permission);
        return authority;
    }

    public DocumentRecord insert(
            UUID estate,
            UUID id,
            DocumentType type,
            String user,
            DocumentValidator.ValidatedDocument file,
            String key) {
        return db.insertInto(DOCUMENT)
                .set(DOCUMENT.ID, id)
                .set(DOCUMENT.ESTATEID, estate)
                .set(DOCUMENT.DOCUMENTTYPE, type.name())
                .set(DOCUMENT.ORIGINALFILENAME, file.filename())
                .set(DOCUMENT.CONTENTTYPE, file.contentType())
                .set(DOCUMENT.SIZEBYTES, file.bytes().length)
                .set(DOCUMENT.STORAGEKEY, key)
                .set(DOCUMENT.UPLOADEDBYUSERID, user)
                .returning()
                .fetchOne();
    }

    public DocumentRecord find(UUID estate, UUID id, boolean lock) {
        var query = db.selectFrom(DOCUMENT).where(DOCUMENT.ID.eq(id).and(DOCUMENT.ESTATEID.eq(estate)));
        var row = lock ? query.forUpdate().fetchOne() : query.fetchOne();
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found.");
        return row;
    }

    public List<DocumentRecord> list(
            UUID estate, String filename, DocumentType documentType, OffsetDateTime before, UUID id, int limit) {
        var condition = DOCUMENT.ESTATEID.eq(estate).and(DOCUMENT.DELETEDAT.isNull());
        if (!filename.isEmpty()) condition = condition.and(DOCUMENT.ORIGINALFILENAME.containsIgnoreCase(filename));
        if (documentType != null) condition = condition.and(DOCUMENT.DOCUMENTTYPE.eq(documentType.name()));
        if (before != null)
            condition = condition.and(DOCUMENT.CREATEDAT
                    .lt(before)
                    .or(DOCUMENT.CREATEDAT.eq(before).and(DOCUMENT.ID.lt(id))));
        return db.selectFrom(DOCUMENT)
                .where(condition)
                .orderBy(DOCUMENT.CREATEDAT.desc(), DOCUMENT.ID.desc())
                .limit(limit)
                .fetch();
    }

    public void markDeleted(UUID id, String user) {
        db.update(DOCUMENT)
                .set(DOCUMENT.DELETEDAT, OffsetDateTime.now())
                .set(DOCUMENT.DELETEDBYUSERID, user)
                .where(DOCUMENT.ID.eq(id).and(DOCUMENT.DELETEDAT.isNull()))
                .execute();
    }

    public void storageRemoved(UUID id) {
        db.update(DOCUMENT)
                .set(DOCUMENT.STORAGEDELETEDAT, OffsetDateTime.now())
                .where(DOCUMENT.ID.eq(id).and(DOCUMENT.DELETEDAT.isNotNull()).and(DOCUMENT.STORAGEDELETEDAT.isNull()))
                .execute();
    }

    public List<DocumentRecord> pendingDeletion() {
        return db.selectFrom(DOCUMENT)
                .where(DOCUMENT.DELETEDAT.isNotNull().and(DOCUMENT.STORAGEDELETEDAT.isNull()))
                .orderBy(DOCUMENT.DELETEDAT, DOCUMENT.ID)
                .limit(100)
                .fetch();
    }

    public boolean references(String key) {
        return db.fetchExists(DOCUMENT, DOCUMENT.STORAGEKEY.eq(key));
    }

    /** Call under the shared estate lock for either association's write. */
    public void requireCompatibleWorkOrder(UUID estate, UUID order, UUID asset) {
        if (order == null) return;
        var work = db.selectFrom(WORKORDER)
                .where(WORKORDER.ID.eq(order).and(WORKORDER.ESTATEID.eq(estate)))
                .fetchOptional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Work order not found."));
        if (asset != null && work.getAssetid() != null && !asset.equals(work.getAssetid()))
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT, "The document and work order must concern the same asset.");
    }
}
