package com.proj.server.reading;

import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.db.tables.records.ImportedreadingRecord;
import com.proj.server.device.DeviceMetric;
import com.proj.server.estate.EstatePermissions;
import com.proj.server.workos.WorkOSService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ReadingImportService {
    private final DSLContext db;
    private final ReadingImportRepository repository;
    private final WorkOSService workOS;

    public ReadingImportService(DSLContext db, ReadingImportRepository repository, WorkOSService workOS) {
        this.db = db;
        this.repository = repository;
        this.workOS = workOS;
    }

    public record Submitted(ReadingImportBatchResponse batch, boolean created) {}

    void authorize(UUID estate, String user, boolean lock, boolean active) {
        var authority = EstatePermissions.authority(db, estate, user, lock);
        authority.requireManager();
        if (active) authority.requireActive();
    }

    @Transactional(timeout = 120)
    public Submitted submit(UUID estate, String user, String filename, byte[] bytes, ReadingImportOptions requested) {
        var name = workOS.findDisplayName(user)
                .map(value -> value.substring(0, Math.min(value.length(), 200)))
                .orElse(null);
        authorize(estate, user, true, true);
        var hash = hash(bytes);
        var previous = repository.submission(estate, user, requested.submissionId());
        if (previous.isPresent() && !hash.equals(previous.get().getFilehash()))
            throw ReadingImportParser.error(409, "This submission UUID was already used for different input.");
        var parsed = ReadingImportParser.parse(bytes, requested);
        var options = new ReadingImportOptions(
                requested.submissionId(),
                requested.sourceLabel(),
                requested.preset(),
                requested.assetLookupMode(),
                parsed.mapping());
        if (previous.isPresent()) {
            var row = previous.get();
            if (!hash.equals(row.getFilehash()) || !options.equals(repository.options(row)))
                throw ReadingImportParser.error(409, "This submission UUID was already used for different input.");
            return new Submitted(repository.response(row), false);
        }
        var now = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
        var lookups = new HashSet<String>();
        for (var row : parsed.rows()) {
            var raw = row.cells().get(options.assetLookupMode());
            var id = uuid(raw);
            if (options.assetLookupMode().equals("asset_reference")) lookups.add(raw);
            else if (id != null) lookups.add(id.toString());
        }
        var assets = new HashMap<String, AssetRecord>();
        for (var asset : repository.assets(estate, options.assetLookupMode(), lookups))
            assets.put(
                    options.assetLookupMode().equals("asset_id") ? asset.getId().toString() : asset.getReference(),
                    asset);
        var candidates = new ArrayList<Candidate>();
        var keys = new HashSet<ReadingImportRepository.Key>();
        for (var row : parsed.rows()) {
            var raw = row.cells().get(options.assetLookupMode());
            var id = uuid(raw);
            var asset = assets.get(options.assetLookupMode().equals("asset_id") && id != null ? id.toString() : raw);
            var candidate = validate(row, asset, options, now);
            candidates.add(candidate);
            if (candidate.valid()) keys.add(candidate.key());
        }
        var existing = new HashMap<ReadingImportRepository.Key, ImportedreadingRecord>();
        for (var reading : repository.existing(estate, keys))
            existing.put(
                    new ReadingImportRepository.Key(
                            reading.getAssetid(),
                            reading.getMetric(),
                            reading.getMeasuredat().toInstant()),
                    reading);
        var origins = new HashMap<String, ReadingImportRepository.Origin>();
        if (options.preset() == ReadingImportPreset.EXPORT) {
            for (var source : ReadingSource.values()) {
                var ids = new HashSet<UUID>();
                for (var row : parsed.rows())
                    if (source.name().equals(row.cells().get("source"))) {
                        var id = uuid(row.cells().get("reading_id"));
                        if (id != null) ids.add(id);
                    }
                for (var origin : repository.origins(estate, source, ids))
                    origins.put(source + ":" + origin.id(), origin);
            }
        }
        var batch = repository.create(estate, user, name, safeFilename(filename), hash, bytes.length, options, now);
        var inserted = new ArrayList<ImportedreadingRecord>();
        var outcomes = new ArrayList<ReadingImportRowResponse>();
        for (var candidate : candidates) {
            var outcome = ReadingImportOutcome.INVALID;
            UUID readingId = null;
            ReadingSource source = null;
            if (candidate.valid()) {
                var origin = origins.get(candidate.row().cells().get("source") + ":"
                        + candidate.row().cells().get("reading_id"));
                if (origin != null) {
                    if (!origin.asset().equals(candidate.asset().getId())
                            || !origin.metric().equals(candidate.metric().name())
                            || !origin.time()
                                    .toInstant()
                                    .equals(candidate.time().toInstant())
                            || origin.value().compareTo(candidate.value()) != 0)
                        candidate
                                .issues()
                                .add(new ReadingImportIssue(
                                        "reading_id",
                                        "READING_CONFLICT",
                                        "The existing exported identity does not match this measurement."));
                    else {
                        outcome = ReadingImportOutcome.DUPLICATE;
                        readingId = origin.id();
                        source = origin.source();
                    }
                } else {
                    var duplicate = existing.get(candidate.key());
                    if (duplicate != null) {
                        if (duplicate.getValue().compareTo(candidate.value()) != 0)
                            candidate
                                    .issues()
                                    .add(new ReadingImportIssue(
                                            "value",
                                            "READING_CONFLICT",
                                            "An imported measurement at this instant already has a different value."));
                        else {
                            outcome = ReadingImportOutcome.DUPLICATE;
                            readingId = duplicate.getId();
                            source = ReadingSource.IMPORT;
                        }
                    } else {
                        var reading = repository.reading(
                                estate,
                                candidate.asset().getId(),
                                batch.getId(),
                                candidate.metric().name(),
                                candidate.value(),
                                candidate.time(),
                                now);
                        inserted.add(reading);
                        existing.put(candidate.key(), reading);
                        outcome = ReadingImportOutcome.IMPORTED;
                        readingId = reading.getId();
                        source = ReadingSource.IMPORT;
                    }
                }
            }
            outcomes.add(new ReadingImportRowResponse(
                    candidate.row().number(),
                    candidate.row().line(),
                    outcome,
                    readingId,
                    source,
                    candidate.asset() == null ? null : candidate.asset().getId(),
                    candidate.metric() == null ? null : candidate.metric().name(),
                    candidate.time(),
                    candidate.value() == null
                            ? null
                            : candidate.value().stripTrailingZeros().toPlainString(),
                    options.preset() == ReadingImportPreset.EXPORT
                            ? candidate.row().cells()
                            : Map.of(),
                    List.copyOf(candidate.issues())));
        }
        repository.persist(batch, inserted, outcomes);
        return new Submitted(repository.response(batch), true);
    }

    @Transactional(readOnly = true)
    public ReadingImportBatchPage list(UUID estate, String user, int page, int size) {
        authorize(estate, user, false, false);
        page(page, size);
        return repository.list(estate, page, size);
    }

    @Transactional(readOnly = true)
    public ReadingImportBatchResponse detail(UUID estate, String user, UUID id) {
        authorize(estate, user, false, false);
        return repository.response(repository.batch(estate, id));
    }

    @Transactional(readOnly = true)
    public ReadingImportRowPage rows(
            UUID estate, String user, UUID id, int page, int size, ReadingImportOutcome outcome) {
        authorize(estate, user, false, false);
        repository.batch(estate, id);
        page(page, size);
        return repository.rows(id, page, size, outcome);
    }

    @Transactional(timeout = 120)
    public ReadingImportBatchResponse revert(UUID estate, String user, UUID id, String reason) {
        authorize(estate, user, true, true);
        var batch = repository.batch(estate, id);
        if (reason == null || reason.isBlank() || reason.length() > 2000)
            throw ReadingImportParser.error(400, "A rollback reason of at most 2,000 characters is required.");
        if (!batch.getStatus().equals("REVERTED"))
            repository.revert(
                    batch, user, reason, OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS));
        return repository.response(batch);
    }

    private static void page(int page, int size) {
        if (page < 0 || size < 1 || size > 200)
            throw ReadingImportParser.error(400, "Page must be nonnegative and size between 1 and 200.");
    }

    private record Candidate(
            ReadingImportParser.Row row,
            AssetRecord asset,
            DeviceMetric metric,
            OffsetDateTime time,
            BigDecimal value,
            List<ReadingImportIssue> issues) {
        boolean valid() {
            return issues.stream().allMatch(issue -> issue.code().equals("OUT_OF_RANGE"));
        }

        ReadingImportRepository.Key key() {
            return new ReadingImportRepository.Key(asset.getId(), metric.name(), time.toInstant());
        }
    }

    private static Candidate validate(
            ReadingImportParser.Row row, AssetRecord asset, ReadingImportOptions options, OffsetDateTime now) {
        var issues = new ArrayList<ReadingImportIssue>();
        var cells = row.cells();
        if (asset == null)
            issues.add(new ReadingImportIssue(
                    options.assetLookupMode(), "ASSET_NOT_FOUND", "Asset was not found in this estate."));
        else if (asset.getDeactivatedat() != null)
            issues.add(new ReadingImportIssue(
                    options.assetLookupMode(),
                    "ASSET_RETIRED",
                    "Restore this asset before importing historical readings."));
        DeviceMetric metric = null;
        try {
            metric = DeviceMetric.valueOf(cells.getOrDefault("metric", ""));
        } catch (IllegalArgumentException invalid) {
            issues.add(new ReadingImportIssue("metric", "INVALID_METRIC", "Use an exact metric catalogue code."));
        }
        OffsetDateTime time = null;
        try {
            time = OffsetDateTime.parse(cells.getOrDefault("measured_at", ""))
                    .withOffsetSameInstant(ZoneOffset.UTC)
                    .truncatedTo(ChronoUnit.MICROS);
            if (time.isAfter(now.plusMinutes(5))) throw new IllegalArgumentException();
        } catch (java.time.DateTimeException | IllegalArgumentException invalid) {
            time = null;
            issues.add(new ReadingImportIssue(
                    "measured_at",
                    "INVALID_TIMESTAMP",
                    "Use a valid ISO-8601 time with an offset, no more than five minutes in the future."));
        }
        BigDecimal value = null;
        try {
            value = new BigDecimal(cells.getOrDefault("value", ""));
            if ((long) value.precision() - value.scale() > 12
                    || value.stripTrailingZeros().scale() > 6) throw new ArithmeticException();
            value = value.setScale(6, RoundingMode.UNNECESSARY);
        } catch (NumberFormatException | ArithmeticException invalid) {
            value = null;
            issues.add(new ReadingImportIssue(
                    "value",
                    "INVALID_VALUE",
                    "Use a finite decimal with at most twelve integer and six meaningful fractional digits."));
        }
        if (metric != null) {
            if (cells.containsKey("unit") && !metric.unit().equals(cells.get("unit")))
                issues.add(new ReadingImportIssue("unit", "INVALID_UNIT", "The unit must match the metric catalogue."));
            if (value != null
                    && (value.compareTo(BigDecimal.valueOf(metric.validMin())) < 0
                            || value.compareTo(BigDecimal.valueOf(metric.validMax())) > 0))
                issues.add(new ReadingImportIssue("value", "OUT_OF_RANGE", "Value is outside the expected range."));
        }
        return new Candidate(row, asset, metric, time, value, issues);
    }

    private static UUID uuid(String raw) {
        try {
            var id = UUID.fromString(raw);
            return id.toString().equalsIgnoreCase(raw) ? id : null;
        } catch (IllegalArgumentException | NullPointerException invalid) {
            return null;
        }
    }

    private static String safeFilename(String raw) {
        if (raw == null) return "readings.csv";
        var name = raw.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "");
        return name.substring(0, Math.min(name.length(), 255));
    }

    private static String hash(byte[] bytes) {
        try {
            return HexFormat.of()
                    .formatHex(
                            java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
