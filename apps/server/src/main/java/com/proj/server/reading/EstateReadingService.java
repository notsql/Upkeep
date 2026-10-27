package com.proj.server.reading;

import com.proj.server.asset.AssetRepository;
import com.proj.server.device.DeviceMetric;
import com.proj.server.estate.EstatePermissions;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import org.jooq.DSLContext;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class EstateReadingService {
    private final DSLContext db;
    private final AssetReadingRepository readings;
    private final AssetRepository assets;

    public EstateReadingService(DSLContext db, AssetReadingRepository readings, AssetRepository assets) {
        this.db = db;
        this.readings = readings;
        this.assets = assets;
    }

    private void authorize(UUID estate, String user) {
        var authority = EstatePermissions.authority(db, estate, user, false);
        if (!authority.manager() && !"CREW".equals(authority.role())) {
            throw new ReadingException(HttpStatus.FORBIDDEN, "Readings access to this estate is required.");
        }
    }

    private static void validatePage(int page, int size) {
        if (page < 0) throw new ReadingException(HttpStatus.BAD_REQUEST, "page: must be 0 or more.");
        if (size < 1 || size > AssetReadingService.MAX_SIZE) {
            throw new ReadingException(HttpStatus.BAD_REQUEST, "size: must be between 1 and 200.");
        }
    }

    public EstateReadingPage list(
            UUID estate,
            String user,
            UUID asset,
            DeviceMetric metric,
            OffsetDateTime from,
            OffsetDateTime to,
            Set<ReadingFlagType> flags,
            int page,
            int size) {
        validatePage(page, size);
        if (from != null && to != null && !from.isBefore(to)) {
            throw new ReadingException(HttpStatus.BAD_REQUEST, "from: must be before to.");
        }
        authorize(estate, user);
        if (asset != null)
            assets.find(asset, estate, false)
                    .orElseThrow(() -> new ReadingException(HttpStatus.NOT_FOUND, "Asset not found."));
        return new EstateReadingPage(
                readings.listEstate(estate, asset, metric, from, to, flags, page, size),
                page,
                size,
                readings.countEstate(estate, asset, metric, from, to, flags));
    }

    public ReadingAssetOptionPage assets(UUID estate, String user, String search, int page, int size) {
        validatePage(page, size);
        authorize(estate, user);
        return readings.assetOptions(estate, search == null ? "" : search.strip(), page, size);
    }
}
