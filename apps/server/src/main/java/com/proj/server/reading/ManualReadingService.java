package com.proj.server.reading;

import com.proj.server.asset.AssetRepository;
import com.proj.server.db.tables.records.ManualreadingRecord;
import com.proj.server.device.DeviceMetric;
import com.proj.server.estate.EstatePermissions;
import com.proj.server.workos.WorkOSService;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ManualReadingService {
    private final DSLContext db;
    private final ManualReadingRepository repository;
    private final AssetRepository assets;
    private final WorkOSService workOS;

    public ManualReadingService(
            DSLContext db, ManualReadingRepository repository, AssetRepository assets, WorkOSService workOS) {
        this.db = db;
        this.repository = repository;
        this.assets = assets;
        this.workOS = workOS;
    }

    public record Submitted(ManualReadingResponse reading, boolean created) {}

    @Transactional
    public Submitted submit(UUID estate, String user, byte[] body) {
        var now = OffsetDateTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MICROS);
        var request = ManualReadingValidator.parse(body, now);
        // Resolve only this authenticated user's name, before taking database locks.
        var name = workOS.findDisplayName(user)
                .map(value -> value.length() > 200 ? value.substring(0, 200) : value)
                .orElse(null);
        var authority = EstatePermissions.authority(db, estate, user, true);
        if (!authority.manager() && !"CREW".equals(authority.role()))
            throw new ReadingException(
                    HttpStatus.FORBIDDEN, "Owner, Manager or Crew access is required to record readings.");
        // The estate lock serializes retries with lifecycle changes and other manual submissions.
        var existing = repository.find(estate, user, request.submissionId());
        if (existing.isPresent()) {
            var row = existing.get();
            if (!row.getAssetid().equals(request.assetId())
                    || !row.getMetric().equals(request.metric().name())
                    || row.getValue().compareTo(request.value()) != 0
                    || !row.getMeasuredat().isEqual(request.measuredAt()))
                throw new ReadingException(
                        HttpStatus.CONFLICT,
                        "This submission was already used for a different reading. Review the entry before saving again.");
            return new Submitted(response(row), false);
        }
        authority.requireActive();
        var asset = assets.find(request.assetId(), estate, true)
                .orElseThrow(() -> new ReadingException(HttpStatus.NOT_FOUND, "Asset not found."));
        if (asset.getDeactivatedat() != null)
            throw new ReadingException(
                    HttpStatus.CONFLICT, "This asset is retired. New manual readings cannot be recorded.");
        return new Submitted(response(repository.insert(estate, user, name, request, now)), true);
    }

    private static ManualReadingResponse response(ManualreadingRecord row) {
        var metric = DeviceMetric.valueOf(row.getMetric());
        return new ManualReadingResponse(
                row.getId(),
                row.getAssetid(),
                metric,
                row.getValue(),
                metric.unit(),
                row.getMeasuredat().withOffsetSameInstant(ZoneOffset.UTC),
                row.getRecordedat().withOffsetSameInstant(ZoneOffset.UTC),
                ReadingSource.MANUAL,
                row.getRecordedbyuserid(),
                row.getRecordedbyname());
    }
}
