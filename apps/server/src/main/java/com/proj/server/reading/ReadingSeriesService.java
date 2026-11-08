package com.proj.server.reading;

import com.proj.server.anomaly.AnomalyModel;
import com.proj.server.asset.AssetRepository;
import com.proj.server.device.DeviceMetric;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Device readings of one asset bucketed for a chart, with its anomaly scores bucketed the same way. */
@Service
public class ReadingSeriesService {
    static final Duration MAX_SPAN = Duration.ofHours(24);
    static final int MAX_BUCKETS = 300;
    private static final int[] STEPS = {1, 5, 10, 15, 30, 60, 120, 300};

    private final AssetReadingRepository repository;
    private final EstateReadingService access;
    private final AssetRepository assets;

    public ReadingSeriesService(
            AssetReadingRepository repository, EstateReadingService access, AssetRepository assets) {
        this.repository = repository;
        this.access = access;
        this.assets = assets;
    }

    /** Includes a retired asset: its readings are kept. */
    public ReadingSeriesResponse series(
            UUID estateId,
            UUID assetId,
            String user,
            OffsetDateTime from,
            OffsetDateTime to,
            List<DeviceMetric> metric) {
        if (!from.isBefore(to)) {
            throw new ReadingException(HttpStatus.BAD_REQUEST, "from: must be before to.");
        }
        var span = Duration.between(from, to);
        if (span.compareTo(MAX_SPAN) > 0) {
            throw new ReadingException(HttpStatus.BAD_REQUEST, "to: must be at most 24 hours after from.");
        }
        access.authorize(estateId, user);
        assets.find(assetId, estateId, false)
                .orElseThrow(() -> new ReadingException(HttpStatus.NOT_FOUND, "Asset not found."));
        int bucket = bucketSeconds(span);
        var metrics = metric == null || metric.isEmpty() ? EnumSet.allOf(DeviceMetric.class) : EnumSet.copyOf(metric);
        return new ReadingSeriesResponse(
                from.withOffsetSameInstant(ZoneOffset.UTC),
                to.withOffsetSameInstant(ZoneOffset.UTC),
                bucket,
                AnomalyModel.DECISION_THRESHOLD,
                repository.series(assetId, metrics, from, to, bucket),
                repository.anomalyBuckets(assetId, from, to, bucket));
    }

    /** The smallest step giving at most {@link #MAX_BUCKETS} buckets over the span. */
    static int bucketSeconds(Duration span) {
        return Arrays.stream(STEPS)
                .filter(step ->
                        Duration.ofSeconds(step).multipliedBy(MAX_BUCKETS).compareTo(span) >= 0)
                .findFirst()
                .orElseThrow();
    }
}
