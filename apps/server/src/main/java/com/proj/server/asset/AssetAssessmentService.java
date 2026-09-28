package com.proj.server.asset;

import com.proj.server.db.tables.records.AssetassessmentRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.workos.WorkOSService;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Assessments are append-only (decision 0017): this service only lists and inserts. */
@Service
public class AssetAssessmentService {
    // The latest "today" anywhere, so an inspector ahead of the server's clock is never
    // told their own date is in the future.
    private static final ZoneOffset LATEST_TIME_ZONE = ZoneOffset.ofHours(14);

    private final AssetAssessmentRepository repository;
    private final AssetRepository assets;
    private final EstateRepository estates;
    private final WorkOSService workOS;

    public AssetAssessmentService(
            AssetAssessmentRepository repository,
            AssetRepository assets,
            EstateRepository estates,
            WorkOSService workOS) {
        this.repository = repository;
        this.assets = assets;
        this.estates = estates;
        this.workOS = workOS;
    }

    /** Includes a deactivated asset's history: it is preserved, only closed to new entries. */
    public List<AssetAssessmentResponse> list(UUID estateId, UUID assetId, String owner) {
        estates.findOwned(estateId, owner, false).orElseThrow(AssetAssessmentService::estateNotFound);
        assets.find(assetId, estateId, false).orElseThrow(AssetAssessmentService::assetNotFound);
        return repository.listForAsset(assetId).stream()
                .map(AssetAssessmentService::response)
                .toList();
    }

    @Transactional
    public AssetAssessmentResponse record(
            UUID estateId, UUID assetId, String owner, CreateAssetAssessmentRequest request) {
        if (request.assessedOn().isAfter(LocalDate.now(LATEST_TIME_ZONE))) {
            throw new AssetException(HttpStatus.BAD_REQUEST, "The assessment date cannot be in the future.");
        }
        // Looked up before any row is locked, so a slow WorkOS call never holds a lock.
        var recordedByName = workOS.findDisplayName(owner).orElse(null);

        var estate = estates.findOwned(estateId, owner, true).orElseThrow(AssetAssessmentService::estateNotFound);
        if (estate.deactivatedAt() != null) {
            throw new AssetException(HttpStatus.CONFLICT, "This estate is inactive. Its assets cannot be assessed.");
        }
        var asset = assets.find(assetId, estateId, true).orElseThrow(AssetAssessmentService::assetNotFound);
        if (asset.getDeactivatedat() != null) {
            throw new AssetException(
                    HttpStatus.CONFLICT,
                    "This asset is deactivated. Its condition history is kept, but new assessments are not accepted.");
        }
        return response(repository.create(estateId, assetId, request, owner, recordedByName));
    }

    private static AssetAssessmentResponse response(AssetassessmentRecord row) {
        return new AssetAssessmentResponse(
                row.getId(),
                row.getAssetid(),
                AssetCondition.valueOf(row.getCondition()),
                row.getAssessedon(),
                row.getNotes(),
                row.getRecordedbyuserid(),
                row.getRecordedbyname(),
                row.getCreatedat());
    }

    private static AssetException estateNotFound() {
        return new AssetException(HttpStatus.NOT_FOUND, "Estate not found.");
    }

    private static AssetException assetNotFound() {
        return new AssetException(HttpStatus.NOT_FOUND, "Asset not found.");
    }
}
