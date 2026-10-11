package com.proj.server.event;

import static com.proj.server.db.tables.Assetevent.ASSETEVENT;

import com.proj.server.db.tables.records.AsseteventRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/** Insert and read only. Events are never updated or deleted. */
@Repository
public class AssetEventRepository {
    private final DSLContext db;

    public AssetEventRepository(DSLContext db) {
        this.db = db;
    }

    /** Newest first: by date, then the most recently recorded. */
    public List<AsseteventRecord> listForAsset(UUID assetId) {
        return db.selectFrom(ASSETEVENT)
                .where(ASSETEVENT.ASSETID.eq(assetId))
                .orderBy(ASSETEVENT.OCCURREDON.desc(), ASSETEVENT.CREATEDAT.desc(), ASSETEVENT.ID)
                .fetch();
    }

    /** Every event of the estate's assets, oldest first, for computing forecasts in bulk. */
    public List<AsseteventRecord> listForEstate(UUID estateId) {
        return db.selectFrom(ASSETEVENT)
                .where(ASSETEVENT.ESTATEID.eq(estateId))
                .orderBy(ASSETEVENT.OCCURREDON, ASSETEVENT.CREATEDAT, ASSETEVENT.ID)
                .fetch();
    }

    public AsseteventRecord create(
            UUID estateId,
            UUID assetId,
            CreateAssetEventRequest request,
            UUID manufacturerId,
            UUID modelId,
            String recordedByUserId,
            String recordedByName) {
        return db.insertInto(ASSETEVENT)
                .set(ASSETEVENT.ID, UUID.randomUUID())
                .set(ASSETEVENT.ESTATEID, estateId)
                .set(ASSETEVENT.ASSETID, assetId)
                .set(ASSETEVENT.TYPE, request.type().name())
                .set(ASSETEVENT.OCCURREDON, request.occurredOn())
                .set(ASSETEVENT.NOTES, request.notes())
                .set(ASSETEVENT.MANUFACTURERID, manufacturerId)
                .set(ASSETEVENT.MODELID, modelId)
                .set(ASSETEVENT.RECORDEDBYUSERID, recordedByUserId)
                .set(ASSETEVENT.RECORDEDBYNAME, recordedByName)
                .set(ASSETEVENT.CREATEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .returning()
                .fetchSingle();
    }
}
