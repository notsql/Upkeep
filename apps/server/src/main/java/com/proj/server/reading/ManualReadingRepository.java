package com.proj.server.reading;

import static com.proj.server.db.tables.Manualreading.MANUALREADING;

import com.proj.server.db.tables.records.ManualreadingRecord;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class ManualReadingRepository {
    private final DSLContext db;

    public ManualReadingRepository(DSLContext db) {
        this.db = db;
    }

    public Optional<ManualreadingRecord> find(UUID estate, String user, UUID submission) {
        return db.selectFrom(MANUALREADING)
                .where(
                        MANUALREADING.ESTATEID.eq(estate),
                        MANUALREADING.RECORDEDBYUSERID.eq(user),
                        MANUALREADING.SUBMISSIONID.eq(submission))
                .fetchOptional();
    }

    public ManualreadingRecord insert(
            UUID estate, String user, String name, CreateManualReadingRequest request, OffsetDateTime now) {
        return db.insertInto(MANUALREADING)
                .set(MANUALREADING.ID, UUID.randomUUID())
                .set(MANUALREADING.ESTATEID, estate)
                .set(MANUALREADING.ASSETID, request.assetId())
                .set(MANUALREADING.METRIC, request.metric().name())
                .set(MANUALREADING.VALUE, request.value())
                .set(MANUALREADING.MEASUREDAT, request.measuredAt())
                .set(MANUALREADING.RECORDEDAT, now)
                .set(MANUALREADING.RECORDEDBYUSERID, user)
                .set(MANUALREADING.RECORDEDBYNAME, name)
                .set(MANUALREADING.SUBMISSIONID, request.submissionId())
                .returning()
                .fetchSingle();
    }
}
