package com.proj.server.reading;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.OffsetDateTime;
import java.util.List;

@Schema(requiredProperties = {"from", "to", "bucketSeconds", "anomalyThreshold", "metrics", "anomalies"})
public record ReadingSeriesResponse(
        @Schema(description = "The requested start, inclusive, in UTC")
        OffsetDateTime from,

        @Schema(description = "The requested end, exclusive, in UTC")
        OffsetDateTime to,

        @Schema(description = "Width of every bucket; buckets are aligned to the Unix epoch")
        int bucketSeconds,

        @Schema(description = "Scores at or above this are abnormal")
        double anomalyThreshold,

        @Schema(description = "Metrics with device readings in the range, in catalogue order")
        List<MetricSeries> metrics,

        @Schema(description = "Buckets with at least one anomaly score, ascending")
        List<AnomalyBucket> anomalies) {}
