package com.proj.server.device;

import com.proj.server.asset.AssetRepository;
import com.proj.server.db.tables.records.DeviceRecord;
import com.proj.server.estate.EstateRepository;
import com.proj.server.location.LocationRepository;
import java.util.Arrays;
import java.util.HashMap;
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
        var devices = repository.listForAsset(assetId);
        // Replacements are on the same asset, so the list holds both ends of every link.
        var replacedBy = new HashMap<UUID, UUID>();
        for (var device : devices) {
            if (device.getReplacesdeviceid() != null) {
                replacedBy.put(device.getReplacesdeviceid(), device.getId());
            }
        }
        return devices.stream()
                .map(device -> response(device, replacedBy.get(device.getId())))
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
        checkNewDevice(estateId, request);
        return response(repository.create(estateId, assetId, request), null);
    }

    /**
     * Permanent. Same lock order as registration; the identifier must be typed
     * exactly to confirm. Repeating it keeps the original time (ID-45).
     */
    @Transactional
    public DeviceResponse deactivate(UUID estateId, UUID assetId, UUID deviceId, String owner, String identifier) {
        lockActiveEstateAndAsset(estateId, assetId, owner);
        var device = repository.find(deviceId, assetId, estateId, true).orElseThrow(DeviceService::deviceNotFound);
        if (!device.getIdentifier().equals(identifier)) {
            throw new DeviceException(
                    HttpStatus.BAD_REQUEST, "Enter the device's identifier exactly to confirm deactivation.");
        }
        if (device.getDeactivatedat() != null) {
            return response(device, repository.replacementOf(deviceId).orElse(null));
        }
        return response(repository.deactivate(deviceId), null);
    }

    /**
     * Deactivates an active device and registers its replacement on the same asset,
     * in one transaction. Every check runs before anything is written (ID-45).
     */
    @Transactional
    public DeviceResponse replace(
            UUID estateId, UUID assetId, UUID deviceId, String owner, CreateDeviceRequest request) {
        lockActiveEstateAndAsset(estateId, assetId, owner);
        var device = repository.find(deviceId, assetId, estateId, true).orElseThrow(DeviceService::deviceNotFound);
        if (device.getDeactivatedat() != null) {
            throw new DeviceException(
                    HttpStatus.CONFLICT,
                    "This device is already deactivated. Register a new device on the asset instead.");
        }
        checkNewDevice(estateId, request);
        repository.deactivate(deviceId);
        return response(repository.createReplacing(estateId, assetId, request, deviceId), null);
    }

    /**
     * Same lock order as registration, then overwrites the device's key hash. The
     * plaintext key goes only into the response.
     */
    @Transactional
    public DeviceCredentialResponse issueCredential(UUID estateId, UUID assetId, UUID deviceId, String owner) {
        var estate = estates.findOwned(estateId, owner, true).orElseThrow(DeviceService::estateNotFound);
        if (estate.deactivatedAt() != null) {
            throw new DeviceException(
                    HttpStatus.CONFLICT, "This estate is inactive. Device credentials cannot be issued.");
        }
        var asset = assets.find(assetId, estateId, true).orElseThrow(DeviceService::assetNotFound);
        if (asset.getDeactivatedat() != null) {
            throw new DeviceException(
                    HttpStatus.CONFLICT, "This asset is retired. Device credentials cannot be issued.");
        }
        var device = repository.find(deviceId, assetId, estateId, true).orElseThrow(DeviceService::deviceNotFound);
        if (device.getDeactivatedat() != null) {
            throw new DeviceException(HttpStatus.CONFLICT, "This device is deactivated. It cannot be given a key.");
        }
        var key = DeviceKeys.generate();
        var issuedAt = repository
                .replaceCredential(deviceId, assetId, estateId, DeviceKeys.hash(key))
                .orElseThrow(() -> new DeviceException(HttpStatus.NOT_FOUND, "Device not found."));
        return new DeviceCredentialResponse(deviceId, key, issuedAt);
    }

    private void lockActiveEstateAndAsset(UUID estateId, UUID assetId, String owner) {
        var estate = estates.findOwned(estateId, owner, true).orElseThrow(DeviceService::estateNotFound);
        if (estate.deactivatedAt() != null) {
            throw new DeviceException(HttpStatus.CONFLICT, "This estate is inactive. Its devices cannot be changed.");
        }
        var asset = assets.find(assetId, estateId, true).orElseThrow(DeviceService::assetNotFound);
        if (asset.getDeactivatedat() != null) {
            throw new DeviceException(HttpStatus.CONFLICT, "This asset is deactivated. Its devices cannot be changed.");
        }
    }

    private void checkNewDevice(UUID estateId, CreateDeviceRequest request) {
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
    }

    static String duplicateMessage(String identifier) {
        return "A device with identifier \"%s\" is already registered. Check the identifier on the device's label."
                .formatted(identifier);
    }

    private static DeviceResponse response(DeviceRecord row, UUID replacedByDeviceId) {
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
                row.getCredentialissuedat(),
                row.getDeactivatedat(),
                row.getReplacesdeviceid(),
                replacedByDeviceId,
                row.getCreatedat(),
                row.getUpdatedat());
    }

    private static DeviceException estateNotFound() {
        return new DeviceException(HttpStatus.NOT_FOUND, "Estate not found.");
    }

    private static DeviceException deviceNotFound() {
        return new DeviceException(HttpStatus.NOT_FOUND, "Device not found.");
    }

    private static DeviceException assetNotFound() {
        return new DeviceException(HttpStatus.NOT_FOUND, "Asset not found.");
    }
}
