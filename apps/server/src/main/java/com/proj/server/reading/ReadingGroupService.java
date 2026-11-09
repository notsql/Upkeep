package com.proj.server.reading;

import com.proj.server.asset.AssetRepository;
import com.proj.server.device.DeviceMetric;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** An asset's latest readings grouped per instant and source, paged by a measuredAt keyset. */
@Service
public class ReadingGroupService {
    static final int MAX_LIMIT = 100;

    private final AssetReadingRepository repository;
    private final EstateReadingService access;
    private final AssetRepository assets;

    public ReadingGroupService(AssetReadingRepository repository, EstateReadingService access, AssetRepository assets) {
        this.repository = repository;
        this.access = access;
        this.assets = assets;
    }

    /**
     * {@code limit} bounds timestamps, not groups; includes a retired asset. Groups hold only {@code metrics}; with
     * {@code flags}, a group is kept when any of its readings carries any of them.
     */
    public ReadingGroupPage groups(
            UUID estateId,
            UUID assetId,
            String user,
            int limit,
            OffsetDateTime before,
            OffsetDateTime from,
            OffsetDateTime to,
            Set<DeviceMetric> metrics,
            Set<ReadingFlagType> flags) {
        if (limit < 1 || limit > MAX_LIMIT) {
            throw new ReadingException(HttpStatus.BAD_REQUEST, "limit: must be between 1 and " + MAX_LIMIT + ".");
        }
        if (from != null && to != null && !from.isBefore(to)) {
            throw new ReadingException(HttpStatus.BAD_REQUEST, "from: must be before to.");
        }
        access.authorize(estateId, user);
        assets.find(assetId, estateId, false)
                .orElseThrow(() -> new ReadingException(HttpStatus.NOT_FOUND, "Asset not found."));
        var upper = before == null || (to != null && to.isBefore(before)) ? to : before;
        var instants = repository.groupInstants(assetId, metrics, from, upper, flags, limit + 1);
        boolean more = instants.size() > limit;
        var page = more ? instants.subList(0, limit) : instants;
        return new ReadingGroupPage(
                repository.groupsAt(assetId, metrics, flags, page),
                more ? page.getLast().withOffsetSameInstant(ZoneOffset.UTC) : null);
    }
}
