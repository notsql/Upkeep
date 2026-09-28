package com.proj.server.asset;

import static com.proj.server.db.tables.Assetassessment.ASSETASSESSMENT;

import com.proj.server.db.tables.records.AssetassessmentRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/** Insert and read only. Assessments are never updated or deleted (decision 0017). */
@Repository
public class AssetAssessmentRepository {
    private final DSLContext db;

    public AssetAssessmentRepository(DSLContext db) {
        this.db = db;
    }

    /** Current condition first: latest assessment date, then the most recently recorded. */
    public List<AssetassessmentRecord> listForAsset(UUID assetId) {
        return db.selectFrom(ASSETASSESSMENT)
                .where(ASSETASSESSMENT.ASSETID.eq(assetId))
                .orderBy(ASSETASSESSMENT.ASSESSEDON.desc(), ASSETASSESSMENT.CREATEDAT.desc(), ASSETASSESSMENT.ID)
                .fetch();
    }

    public AssetassessmentRecord create(
            UUID estateId,
            UUID assetId,
            CreateAssetAssessmentRequest request,
            String recordedByUserId,
            String recordedByName) {
        return db.insertInto(ASSETASSESSMENT)
                .set(ASSETASSESSMENT.ID, UUID.randomUUID())
                .set(ASSETASSESSMENT.ESTATEID, estateId)
                .set(ASSETASSESSMENT.ASSETID, assetId)
                .set(ASSETASSESSMENT.CONDITION, request.condition().name())
                .set(ASSETASSESSMENT.ASSESSEDON, request.assessedOn())
                .set(ASSETASSESSMENT.NOTES, request.notes())
                .set(ASSETASSESSMENT.RECORDEDBYUSERID, recordedByUserId)
                .set(ASSETASSESSMENT.RECORDEDBYNAME, recordedByName)
                .set(ASSETASSESSMENT.CREATEDAT, OffsetDateTime.now(ZoneOffset.UTC))
                .returning()
                .fetchSingle();
    }
}
