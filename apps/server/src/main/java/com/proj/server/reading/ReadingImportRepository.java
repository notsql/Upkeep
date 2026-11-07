package com.proj.server.reading;

import static com.proj.server.db.tables.Asset.ASSET;
import static com.proj.server.db.tables.Devicereading.DEVICEREADING;
import static com.proj.server.db.tables.Importedreading.IMPORTEDREADING;
import static com.proj.server.db.tables.Manualreading.MANUALREADING;
import static com.proj.server.db.tables.Readingimportbatch.READINGIMPORTBATCH;
import static com.proj.server.db.tables.Readingimportrow.READINGIMPORTROW;

import com.proj.server.db.tables.records.ImportedreadingRecord;
import com.proj.server.db.tables.records.ReadingimportbatchRecord;
import com.proj.server.db.tables.records.ReadingimportrowRecord;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class ReadingImportRepository {
    static final JsonMapper JSON = JsonMapper.builder().build();
    private final DSLContext db;

    public ReadingImportRepository(DSLContext db) {
        // Never copy CSV measurements or issue reports into DEBUG SQL/result logs.
        this.db = DSL.using(db.configuration()
                .derive(org.jooq.conf.SettingsTools.clone(db.settings()).withExecuteLogging(false)));
    }

    Optional<ReadingimportbatchRecord> submission(UUID estate, String user, UUID id) {
        return db.selectFrom(READINGIMPORTBATCH)
                .where(
                        READINGIMPORTBATCH.ESTATEID.eq(estate),
                        READINGIMPORTBATCH.UPLOADERUSERID.eq(user),
                        READINGIMPORTBATCH.SUBMISSIONID.eq(id))
                .fetchOptional();
    }

    ReadingimportbatchRecord batch(UUID estate, UUID id) {
        return db.selectFrom(READINGIMPORTBATCH)
                .where(READINGIMPORTBATCH.ESTATEID.eq(estate), READINGIMPORTBATCH.ID.eq(id))
                .fetchOptional()
                .orElseThrow(() -> ReadingImportParser.error(404, "Import batch not found."));
    }

    List<com.proj.server.db.tables.records.AssetRecord> assets(UUID estate, String mode, Collection<String> lookups) {
        var result = new ArrayList<com.proj.server.db.tables.records.AssetRecord>();
        var values = new ArrayList<>(lookups);
        for (int i = 0; i < values.size(); i += 512) {
            var chunk = values.subList(i, Math.min(i + 512, values.size()));
            var condition = mode.equals("asset_id")
                    ? ASSET.ID.in(chunk.stream().map(UUID::fromString).toList())
                    : ASSET.REFERENCE.in(chunk);
            result.addAll(db.selectFrom(ASSET)
                    .where(ASSET.ESTATEID.eq(estate), condition)
                    .fetch());
        }
        return result;
    }

    record Key(UUID asset, String metric, java.time.Instant time) {}

    List<ImportedreadingRecord> existing(UUID estate, Collection<Key> wanted) {
        var result = new ArrayList<ImportedreadingRecord>();
        var keys = new ArrayList<>(wanted);
        for (int i = 0; i < keys.size(); i += 512) {
            var chunk = keys.subList(i, Math.min(i + 512, keys.size())).stream()
                    .map(key -> DSL.row(key.asset(), key.metric(), key.time().atOffset(ZoneOffset.UTC)))
                    .toList();
            result.addAll(db.selectFrom(IMPORTEDREADING)
                    .where(
                            IMPORTEDREADING.ESTATEID.eq(estate),
                            DSL.row(IMPORTEDREADING.ASSETID, IMPORTEDREADING.METRIC, IMPORTEDREADING.MEASUREDAT)
                                    .in(chunk))
                    .fetch());
        }
        return result;
    }

    record Origin(
            UUID id,
            UUID asset,
            String metric,
            java.math.BigDecimal value,
            OffsetDateTime time,
            ReadingSource source) {}

    List<Origin> origins(UUID estate, ReadingSource source, Collection<UUID> wanted) {
        var result = new ArrayList<Origin>();
        var ids = new ArrayList<>(wanted);
        for (int i = 0; i < ids.size(); i += 512) {
            var chunk = ids.subList(i, Math.min(i + 512, ids.size()));
            switch (source) {
                case SENSOR ->
                    result.addAll(db.selectFrom(DEVICEREADING)
                            .where(DEVICEREADING.ESTATEID.eq(estate), DEVICEREADING.ID.in(chunk))
                            .fetch(r -> new Origin(
                                    r.getId(),
                                    r.getAssetid(),
                                    r.getMetric(),
                                    r.getValue(),
                                    r.getMeasuredat(),
                                    source)));
                case MANUAL ->
                    result.addAll(db.selectFrom(MANUALREADING)
                            .where(MANUALREADING.ESTATEID.eq(estate), MANUALREADING.ID.in(chunk))
                            .fetch(r -> new Origin(
                                    r.getId(),
                                    r.getAssetid(),
                                    r.getMetric(),
                                    r.getValue(),
                                    r.getMeasuredat(),
                                    source)));
                case IMPORT ->
                    result.addAll(db.selectFrom(IMPORTEDREADING)
                            .where(IMPORTEDREADING.ESTATEID.eq(estate), IMPORTEDREADING.ID.in(chunk))
                            .fetch(r -> new Origin(
                                    r.getId(),
                                    r.getAssetid(),
                                    r.getMetric(),
                                    r.getValue(),
                                    r.getMeasuredat(),
                                    source)));
            }
        }
        return result;
    }

    ReadingimportbatchRecord create(
            UUID estate,
            String user,
            String name,
            String filename,
            String hash,
            int size,
            ReadingImportOptions options,
            OffsetDateTime now) {
        var record = db.newRecord(READINGIMPORTBATCH);
        record.setId(UUID.randomUUID());
        record.setEstateid(estate);
        record.setSubmissionid(options.submissionId());
        record.setSourcelabel(options.sourceLabel());
        record.setOriginalfilename(filename);
        record.setFilehash(hash);
        record.setSizebytes(size);
        record.setMapping(json(options));
        record.setParserversion(ReadingImportParser.VERSION);
        record.setUploaderuserid(user);
        record.setUploadername(name);
        record.setCreatedat(now);
        record.setStatus("COMPLETED");
        record.setTotalrows(0);
        record.setImportedrows(0);
        record.setDuplicaterows(0);
        record.setInvalidrows(0);
        record.setWarningrows(0);
        record.store();
        return record;
    }

    void persist(
            ReadingimportbatchRecord batch,
            List<ImportedreadingRecord> readings,
            List<ReadingImportRowResponse> outcomes) {
        for (int i = 0; i < readings.size(); i += 512)
            db.insertInto(IMPORTEDREADING)
                    .columns(IMPORTEDREADING.fields())
                    .valuesOfRecords(readings.subList(i, Math.min(i + 512, readings.size())))
                    .execute();
        for (int i = 0; i < outcomes.size(); i += 512) {
            var records = outcomes.subList(i, Math.min(i + 512, outcomes.size())).stream()
                    .map(row -> {
                        var record = db.newRecord(READINGIMPORTROW);
                        record.setBatchid(batch.getId());
                        record.setRecordnumber(row.recordNumber());
                        record.setStartinglinenumber(row.startingLineNumber());
                        record.setOutcome(row.outcome().name());
                        record.setReadingid(row.readingId());
                        record.setSource(
                                row.source() == null ? null : row.source().name());
                        record.setAssetid(row.assetId());
                        record.setMetric(row.metric());
                        record.setMeasuredat(row.measuredAt());
                        record.setValuetext(row.valueText());
                        record.setOrigin(json(row.origin()));
                        record.setIssues(json(row.issues()));
                        return record;
                    })
                    .toList();
            db.insertInto(READINGIMPORTROW)
                    .columns(READINGIMPORTROW.fields())
                    .valuesOfRecords(records)
                    .execute();
        }
        batch.setTotalrows(outcomes.size());
        batch.setImportedrows(readings.size());
        batch.setDuplicaterows((int) outcomes.stream()
                .filter(row -> row.outcome() == ReadingImportOutcome.DUPLICATE)
                .count());
        batch.setInvalidrows((int) outcomes.stream()
                .filter(row -> row.outcome() == ReadingImportOutcome.INVALID)
                .count());
        batch.setWarningrows((int) outcomes.stream()
                .filter(row ->
                        row.issues().stream().anyMatch(issue -> issue.code().equals("OUT_OF_RANGE")))
                .count());
        batch.store();
    }

    ImportedreadingRecord reading(
            UUID estate,
            UUID asset,
            UUID batch,
            String metric,
            java.math.BigDecimal value,
            OffsetDateTime time,
            OffsetDateTime now) {
        var row = db.newRecord(IMPORTEDREADING);
        row.setId(UUID.randomUUID());
        row.setEstateid(estate);
        row.setAssetid(asset);
        row.setBatchid(batch);
        row.setMetric(metric);
        row.setValue(value);
        row.setMeasuredat(time);
        row.setRecordedat(now);
        return row;
    }

    ReadingImportBatchPage list(UUID estate, int page, int size) {
        var condition = READINGIMPORTBATCH.ESTATEID.eq(estate);
        var rows = db.selectFrom(READINGIMPORTBATCH)
                .where(condition)
                .orderBy(READINGIMPORTBATCH.CREATEDAT.desc(), READINGIMPORTBATCH.ID.desc())
                .limit(size)
                .offset((long) page * size)
                .fetch(this::response);
        return new ReadingImportBatchPage(rows, page, size, db.fetchCount(READINGIMPORTBATCH, condition));
    }

    ReadingImportRowPage rows(UUID batch, int page, int size, ReadingImportOutcome outcome) {
        var condition = READINGIMPORTROW.BATCHID.eq(batch);
        if (outcome != null) condition = condition.and(READINGIMPORTROW.OUTCOME.eq(outcome.name()));
        return new ReadingImportRowPage(
                db.selectFrom(READINGIMPORTROW)
                        .where(condition)
                        .orderBy(READINGIMPORTROW.RECORDNUMBER)
                        .limit(size)
                        .offset((long) page * size)
                        .fetch(this::row),
                page,
                size,
                db.fetchCount(READINGIMPORTROW, condition));
    }

    void revert(ReadingimportbatchRecord batch, String user, String reason, OffsetDateTime now) {
        int removed = db.deleteFrom(IMPORTEDREADING)
                .where(IMPORTEDREADING.BATCHID.eq(batch.getId()))
                .execute();
        batch.setStatus("REVERTED");
        batch.setRemovedcount(removed);
        batch.setRollbackuserid(user);
        batch.setRollbackreason(reason);
        batch.setRollbackat(now);
        batch.store();
    }

    ReadingImportBatchResponse response(ReadingimportbatchRecord row) {
        var options = options(row);
        return new ReadingImportBatchResponse(
                row.getId(),
                row.getEstateid(),
                row.getSubmissionid(),
                row.getSourcelabel(),
                row.getOriginalfilename(),
                row.getFilehash(),
                row.getSizebytes(),
                options.mapping(),
                options.preset(),
                options.assetLookupMode(),
                row.getParserversion(),
                row.getUploaderuserid(),
                row.getUploadername(),
                utc(row.getCreatedat()),
                ReadingImportStatus.valueOf(row.getStatus()),
                row.getTotalrows(),
                row.getImportedrows(),
                row.getDuplicaterows(),
                row.getInvalidrows(),
                row.getWarningrows(),
                row.getRollbackuserid(),
                utc(row.getRollbackat()),
                row.getRollbackreason(),
                row.getRemovedcount());
    }

    ReadingImportOptions options(ReadingimportbatchRecord row) {
        return JSON.readValue(row.getMapping().data(), ReadingImportOptions.class);
    }

    private ReadingImportRowResponse row(ReadingimportrowRecord row) {
        Map<String, String> origin = row.getOrigin() == null
                ? Map.of()
                : JSON.readValue(row.getOrigin().data(), new TypeReference<Map<String, String>>() {});
        return new ReadingImportRowResponse(
                row.getRecordnumber(),
                row.getStartinglinenumber(),
                ReadingImportOutcome.valueOf(row.getOutcome()),
                row.getReadingid(),
                row.getSource() == null ? null : ReadingSource.valueOf(row.getSource()),
                row.getAssetid(),
                row.getMetric(),
                utc(row.getMeasuredat()),
                row.getValuetext(),
                origin,
                Arrays.asList(JSON.readValue(row.getIssues().data(), ReadingImportIssue[].class)));
    }

    static JSONB json(Object value) {
        return JSONB.valueOf(JSON.writeValueAsString(value));
    }

    private static OffsetDateTime utc(OffsetDateTime time) {
        return time == null ? null : time.withOffsetSameInstant(ZoneOffset.UTC);
    }
}
