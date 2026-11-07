package com.proj.server.asset;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Document.DOCUMENT;

import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.db.tables.records.DocumentRecord;
import com.proj.server.estate.EstatePermissions;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
public class AssetDocumentRepository {
    private final DSLContext db;

    public AssetDocumentRepository(DSLContext db) {
        this.db = db;
    }

    EstatePermissions.Authority authority(UUID estate, String user, boolean lock) {
        return EstatePermissions.authority(db, estate, user, lock);
    }

    AssetRecord asset(UUID estate, UUID id) {
        return db.selectFrom(ASSET)
                .where(ASSET.ESTATEID.eq(estate).and(ASSET.ID.eq(id)))
                .fetchOptional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset not found."));
    }

    void change(DocumentRecord document, UUID asset, String user, OffsetDateTime now) {
        db.update(DOCUMENT)
                .set(DOCUMENT.ASSETID, asset)
                .set(DOCUMENT.ASSETASSOCIATIONVERSION, document.getAssetassociationversion() + 1)
                .set(DOCUMENT.ASSETASSOCIATIONCHANGEDBYUSERID, user)
                .set(DOCUMENT.ASSETASSOCIATIONCHANGEDAT, now)
                .where(DOCUMENT.ID.eq(document.getId()).and(DOCUMENT.ESTATEID.eq(document.getEstateid())))
                .execute();
    }

    List<DocumentRecord> attachments(UUID estate, UUID asset, OffsetDateTime before, UUID beforeId, int limit) {
        var condition =
                DOCUMENT.ESTATEID.eq(estate).and(DOCUMENT.ASSETID.eq(asset)).and(DOCUMENT.DELETEDAT.isNull());
        if (before != null)
            condition = condition.and(DOCUMENT.CREATEDAT
                    .lt(before)
                    .or(DOCUMENT.CREATEDAT.eq(before).and(DOCUMENT.ID.lt(beforeId))));
        return db.selectFrom(DOCUMENT)
                .where(condition)
                .orderBy(DOCUMENT.CREATEDAT.desc(), DOCUMENT.ID.desc())
                .limit(limit)
                .fetch();
    }
}
