package com.proj.server.device;

import com.proj.server.asset.AssetRepository;
import com.proj.server.db.tables.records.DeviceRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.location.LocationRepository;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Registration locks the estate row, then the asset's, the same order asset writes
 * use (decision 0010), so it cannot slip past a concurrent deactivation of either.
 */
@Service
public class DeviceService {
    private final DeviceRepository repository;
    private final AssetRepository assets;
    private final LocationRepository locations;
    private final EstateRepository estates;

    public DeviceService(
            DeviceRepository repository,
            AssetRepository assets,
            LocationRepository locations,
            EstateRepository estates) {
        this.repository = repository;
        this.assets = assets;
        this.locations = locations;
        this.estates = estates;
    }

    public List<DeviceResponse> list(UUID estateId, UUID assetId, String owner) {
        estates.findOwned(estateId, owner, false).orElseThrow(DeviceService::estateNotFound);
        assets.find(assetId, estateId, false).orElseThrow(DeviceService::assetNotFound);
        return repository.listForAsset(assetId).stream()
                .map(DeviceService::response)
                .toList();
    }

    @Transactional
    public DeviceResponse register(UUID estateId, UUID assetId, String owner, CreateDeviceRequest request) {
        var estate = estates.findOwned(estateId, owner, true).orElseThrow(DeviceService::estateNotFound);
        if (estate.deactivatedAt() != null) {
            throw new DeviceException(HttpStatus.CONFLICT, "This estate is inactive. Devices cannot be registered.");
        }
        var asset = assets.find(assetId, estateId, true).orElseThrow(DeviceService::assetNotFound);
        if (asset.getDeactivatedat() != null) {
            throw new DeviceException(
                    HttpStatus.CONFLICT, "This asset is deactivated. Devices cannot be registered to it.");
        }
        // Scoped to the estate, so another estate's location is simply not found.
        var location = locations
                .find(request.locationId(), estateId)
                .orElseThrow(() -> new DeviceException(HttpStatus.NOT_FOUND, "Location not found."));
        if (location.deactivatedAt() != null) {
            throw new DeviceException(HttpStatus.CONFLICT, "The chosen location is deactivated.");
        }
        if (repository.identifierTaken(request.identifier())) {
            throw new DeviceException(HttpStatus.CONFLICT, duplicateMessage(request.identifier()));
        }
        return response(repository.create(estateId, assetId, request));
    }

    static String duplicateMessage(String identifier) {
        return "A device with identifier \"%s\" is already registered. Check the identifier on the device's label."
                .formatted(identifier);
    }

    private static DeviceResponse response(DeviceRecord row) {
        var metrics = Arrays.stream(row.getMetrics())
                .map(DeviceMetric::valueOf)
                .map(metric -> new DeviceMetricResponse(metric, metric.unit()))
                .toList();
        return new DeviceResponse(
                row.getId(),
                row.getEstateid(),
                row.getAssetid(),
                row.getLocationid(),
                row.getIdentifier(),
                row.getModel(),
                metrics,
                row.getReportingintervalseconds(),
                row.getLastseenat(),
                row.getCreatedat(),
                row.getUpdatedat());
    }

    private static DeviceException estateNotFound() {
        return new DeviceException(HttpStatus.NOT_FOUND, "Estate not found.");
    }

    private static DeviceException assetNotFound() {
        return new DeviceException(HttpStatus.NOT_FOUND, "Asset not found.");
    }
}
