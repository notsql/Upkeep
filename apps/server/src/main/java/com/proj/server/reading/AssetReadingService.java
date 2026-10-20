package com.proj.server.reading;

import com.proj.server.asset.AssetRepository;
import com.proj.server.device.DeviceMetric;
import com.proj.server.estate.EstateRepository;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** An owner's view of an asset's stored readings. */
@Service
public class AssetReadingService {
    static final int MAX_SIZE = 200;

    private final AssetReadingRepository repository;
    private final AssetRepository assets;
    private final EstateRepository estates;

    public AssetReadingService(AssetReadingRepository repository, AssetRepository assets, EstateRepository estates) {
        this.repository = repository;
        this.assets = assets;
        this.estates = estates;
    }

    /** Includes a deactivated asset's readings: they are kept, only closed to new ones. */
    public AssetReadingPage list(
            UUID estateId,
            UUID assetId,
            String owner,
            DeviceMetric metric,
            OffsetDateTime from,
            OffsetDateTime to,
            int page,
            int size) {
        if (page < 0) {
            throw badRequest("page: must be 0 or more.");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw badRequest("size: must be between 1 and " + MAX_SIZE + ".");
        }
        if (from != null && to != null && !from.isBefore(to)) {
            throw badRequest("from: must be before to.");
        }
        estates.findOwned(estateId, owner, false)
                .orElseThrow(() -> new ReadingException(HttpStatus.NOT_FOUND, "Estate not found."));
        assets.find(assetId, estateId, false)
                .orElseThrow(() -> new ReadingException(HttpStatus.NOT_FOUND, "Asset not found."));
        return new AssetReadingPage(
                repository.list(assetId, metric, from, to, page, size),
                page,
                size,
                repository.count(assetId, metric, from, to));
    }

    private static ReadingException badRequest(String message) {
        return new ReadingException(HttpStatus.BAD_REQUEST, message);
    }
}
