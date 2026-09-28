package com.proj.server.asset;

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

    public AssetService(AssetRepository repository, LocationRepository locations, EstateRepository estates) {
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

    @Transactional
    public AssetResponse deactivate(UUID estateId, UUID id, String owner, String reference) {
        lockActiveEstate(estateId, owner);
        var asset = repository.find(id, estateId, true).orElseThrow(AssetService::assetNotFound);
        if (!asset.getReference().equals(reference)) {
            throw new AssetException(
                    HttpStatus.BAD_REQUEST, "Enter the asset reference exactly to confirm deactivation.");
        }
        if (asset.getDeactivatedat() != null) {
            return response(asset);
        }
        return response(repository.deactivate(id));
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
        return new AssetResponse(
                row.getId(),
                row.getEstateid(),
                row.getReference(),
                row.getName(),
                AssetCategory.valueOf(row.getCategory()),
                row.getLocationid(),
                locationPath(row.getEstateid(), row.getLocationid()),
                row.getInstalledon(),
                row.getManufacturer(),
                row.getModel(),
                row.getSerialnumber(),
                row.getCreatedat(),
                row.getUpdatedat(),
                row.getDeactivatedat());
    }

    private static AssetException estateNotFound() {
        return new AssetException(HttpStatus.NOT_FOUND, "Estate not found.");
    }

    private static AssetException assetNotFound() {
        return new AssetException(HttpStatus.NOT_FOUND, "Asset not found.");
    }
}
