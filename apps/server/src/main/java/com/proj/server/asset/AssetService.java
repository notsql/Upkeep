package com.proj.server.asset;

import com.proj.server.catalogue.CatalogueRepository;
import com.proj.server.db.tables.records.AssetRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.estate.EstateResponse;
import com.proj.server.location.LocationRepository;
import com.proj.server.location.LocationResponse;
import java.util.ArrayDeque;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Every write locks the owning estate's row first, then the asset's (decision 0010).
 * The estate lock serialises reference generation (decision 0015) and stops a write
 * slipping past a concurrent estate deactivation.
 */
@Service
public class AssetService {
    private final AssetRepository repository;
    private final LocationRepository locations;
    private final EstateRepository estates;
    private final CatalogueRepository catalogue;

    public AssetService(
            AssetRepository repository,
            LocationRepository locations,
            EstateRepository estates,
            CatalogueRepository catalogue) {
        this.catalogue = catalogue;
        this.repository = repository;
        this.locations = locations;
        this.estates = estates;
    }

    public AssetResponse get(UUID estateId, UUID id, String owner) {
        estates.findOwned(estateId, owner, false).orElseThrow(AssetService::estateNotFound);
        return response(repository.find(id, estateId, false).orElseThrow(AssetService::assetNotFound));
    }

    @Transactional
    public AssetResponse create(UUID estateId, String owner, CreateAssetRequest request) {
        var estate = lockActiveEstate(estateId, owner);
        checkLocation(estateId, request.locationId());
        var reference = "%s-A%04d".formatted(estate.code(), repository.count(estateId) + 1);
        return response(repository.create(estateId, reference, request));
    }

    @Transactional
    public AssetResponse update(UUID estateId, UUID id, String owner, UpdateAssetRequest request) {
        lockActiveEstate(estateId, owner);
        var asset = repository.find(id, estateId, true).orElseThrow(AssetService::assetNotFound);
        if (asset.getDeactivatedat() != null) {
            throw new AssetException(HttpStatus.CONFLICT, "This asset is deactivated and cannot be changed.");
        }
        checkLocation(estateId, request.locationId());
        return response(repository.update(id, request));
    }

    public java.util.List<AssetResponse> list(
            UUID estateId,
            String owner,
            String q,
            AssetCategory category,
            UUID locationId,
            AssetConditionFilter condition,
            AssetStatus status) {
        estates.findOwned(estateId, owner, false).orElseThrow(AssetService::estateNotFound);
        if (locationId != null)
            locations
                    .find(locationId, estateId)
                    .orElseThrow(() -> new AssetException(HttpStatus.NOT_FOUND, "Location not found."));
        String search = q == null || q.isBlank() ? null : q.strip();
        return repository.list(estateId, search, category, locationId, condition, status);
    }

    public java.util.List<AssetLifecycleEventResponse> events(UUID estateId, UUID id, String owner) {
        estates.findOwned(estateId, owner, false).orElseThrow(AssetService::estateNotFound);
        repository.find(id, estateId, false).orElseThrow(AssetService::assetNotFound);
        return repository.events(id);
    }

    @Transactional
    public AssetResponse deactivate(UUID estateId, UUID id, String owner, DeactivateAssetRequest request) {
        var asset = lifecycleAsset(estateId, id, owner, request.expectedVersion());
        confirm(asset, request.reference());
        if (asset.getDeactivatedat() != null) throw conflict("This asset is already retired.");
        validateRetiredOn(asset, request.retiredOn());
        return response(
                repository.transition(asset, "RETIRED", owner, request.retiredOn(), request.retirementReason()));
    }

    @Transactional
    public AssetResponse correctRetirement(UUID estateId, UUID id, String owner, RetirementCorrectionRequest request) {
        var asset = lifecycleAsset(estateId, id, owner, request.expectedVersion());
        if (asset.getDeactivatedat() == null) throw conflict("This asset is not retired.");
        validateRetiredOn(asset, request.retiredOn());
        return response(
                repository.transition(asset, "CORRECTED", owner, request.retiredOn(), request.retirementReason()));
    }

    @Transactional
    public AssetResponse restore(UUID estateId, UUID id, String owner, RestoreAssetRequest request) {
        var asset = lifecycleAsset(estateId, id, owner, request.expectedVersion());
        confirm(asset, request.reference());
        if (asset.getDeactivatedat() == null) throw conflict("This asset is already active.");
        return response(repository.transition(asset, "RESTORED", owner, null, null));
    }

    private AssetRecord lifecycleAsset(UUID estateId, UUID id, String owner, int version) {
        lockActiveEstate(estateId, owner);
        var asset = repository.find(id, estateId, true).orElseThrow(AssetService::assetNotFound);
        if (asset.getLifecycleversion() != version) throw conflict("This asset changed. Refresh before trying again.");
        return asset;
    }

    private static void confirm(AssetRecord asset, String reference) {
        if (!asset.getReference().equals(reference))
            throw new AssetException(HttpStatus.BAD_REQUEST, "Enter the asset reference exactly to confirm.");
    }

    private static void validateRetiredOn(AssetRecord asset, java.time.LocalDate date) {
        if (date.isAfter(java.time.LocalDate.now(java.time.ZoneId.of("Asia/Singapore")))
                || (asset.getInstalledon() != null && date.isBefore(asset.getInstalledon())))
            throw new AssetException(
                    HttpStatus.BAD_REQUEST,
                    "Retirement date must be on or after installation and no later than today.");
    }

    private static AssetException conflict(String message) {
        return new AssetException(HttpStatus.CONFLICT, message);
    }

    private EstateResponse lockActiveEstate(UUID estateId, String owner) {
        var estate = estates.findOwned(estateId, owner, true).orElseThrow(AssetService::estateNotFound);
        if (estate.deactivatedAt() != null) {
            throw new AssetException(HttpStatus.CONFLICT, "This estate is inactive. Its assets cannot be changed.");
        }
        return estate;
    }

    private void checkLocation(UUID estateId, UUID locationId) {
        var location = locations
                .find(locationId, estateId)
                .orElseThrow(() -> new AssetException(HttpStatus.NOT_FOUND, "Location not found."));
        if (location.deactivatedAt() != null) {
            throw new AssetException(HttpStatus.CONFLICT, "The chosen location is deactivated.");
        }
    }

    /** Walks up parentId. The hierarchy is at most three deep, so this is at most three lookups. */
    private String locationPath(UUID estateId, UUID locationId) {
        var names = new ArrayDeque<String>();
        UUID next = locationId;
        while (next != null) {
            LocationResponse location = locations.find(next, estateId).orElseThrow();
            names.addFirst(location.name());
            next = location.parentId();
        }
        return String.join(" › ", names);
    }

    private AssetResponse response(AssetRecord row) {
        return AssetRepository.response(
                row,
                locationPath(row.getEstateid(), row.getLocationid()),
                catalogue.manufacturerName(row.getManufacturerid()),
                catalogue.modelName(row.getModelid()),
                repository.currentCondition(row.getId()));
    }

    private static AssetException estateNotFound() {
        return new AssetException(HttpStatus.NOT_FOUND, "Estate not found.");
    }

    private static AssetException assetNotFound() {
        return new AssetException(HttpStatus.NOT_FOUND, "Asset not found.");
    }
}
