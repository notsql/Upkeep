package com.proj.server.anomaly;

import com.proj.server.asset.AssetAssessmentRepository;
import com.proj.server.asset.AssetCondition;
import com.proj.server.asset.AssetRepository;
import com.proj.server.asset.CreateAssetAssessmentRequest;
import com.proj.server.catalogue.AssetCategoryCodes;
import com.proj.server.estate.EstateRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Scores a batch of readings with the anomaly model and records a condition assessment for a long enough abnormal run
 * (decision 0021). Readings are scored, not stored. No row is locked while the model runs.
 */
@Service
public class AnomalyCheckService {
    private final AnomalyFeatureBuilder features;
    private final AnomalyScorer ml;
    private final EstateRepository estates;
    private final AssetRepository assets;
    private final AssetAssessmentRepository assessments;

    public AnomalyCheckService(
            AnomalyFeatureBuilder features,
            AnomalyScorer ml,
            EstateRepository estates,
            AssetRepository assets,
            AssetAssessmentRepository assessments) {
        this.features = features;
        this.ml = ml;
        this.estates = estates;
        this.assets = assets;
        this.assessments = assessments;
    }

    public AnomalyCheckResponse check(UUID estateId, UUID assetId, AnomalyCheckRequest request, String owner) {
        var estate = estates.findOwned(estateId, owner, false).orElseThrow(() -> notFound("Estate not found."));
        var asset = assets.find(assetId, estateId, false).orElseThrow(() -> notFound("Asset not found."));
        if (estate.deactivatedAt() != null) {
            throw conflict("This estate is inactive. Its assets cannot be checked.");
        }
        if (asset.getDeactivatedat() != null) {
            throw conflict("This asset is deactivated. Its readings cannot be checked.");
        }
        if (!AssetCategoryCodes.PUMP.equals(asset.getCategory())) {
            throw conflict("Anomaly detection is only available for pumps.");
        }
        var readings = sorted(request.readings());

        double[] scores = ml.scores(features.build(readings));
        if (scores.length != readings.size()) {
            throw new MlUnavailableException("The anomaly model returned an unexpected response.", null);
        }

        int abnormal = 0, longest = 0, longestEnd = -1, run = 0;
        for (int i = 0; i < scores.length; i++) {
            if (scores[i] >= AnomalyModel.DECISION_THRESHOLD) {
                abnormal++;
                run++;
                if (run > longest) {
                    longest = run;
                    longestEnd = i;
                }
            } else {
                run = 0;
            }
        }
        double maxScore = Arrays.stream(scores).max().orElse(0);

        AssetCondition recorded = null;
        if (longest >= AnomalyModel.MIN_ABNORMAL_RUN) {
            int start = longestEnd - longest + 1;
            double[] runScores = Arrays.copyOfRange(scores, start, longestEnd + 1);
            double median = median(runScores);
            var condition =
                    median >= AnomalyModel.FAULTY_THRESHOLD ? AssetCondition.FAULTY : AssetCondition.NEEDS_ATTENTION;
            if (assets.currentCondition(assetId) != condition) {
                Instant from = readings.get(start).timestamp();
                Instant to = readings.get(longestEnd).timestamp();
                var notes = String.format(
                        Locale.ROOT,
                        "%d consecutive abnormal readings from %s to %s. Median score %.2f, maximum %.2f.",
                        longest,
                        from,
                        to,
                        median,
                        Arrays.stream(runScores).max().orElse(0));
                assessments.create(
                        estateId,
                        assetId,
                        new CreateAssetAssessmentRequest(condition, LocalDate.ofInstant(to, ZoneOffset.UTC), notes),
                        AnomalyModel.SYSTEM_USER_ID,
                        AnomalyModel.SYSTEM_NAME);
                recorded = condition;
            }
        }
        return new AnomalyCheckResponse(readings.size(), abnormal, longest, maxScore, recorded);
    }

    /** Validates the batch and sorts it by timestamp: 10 to 3,600 complete, finite readings at most 2 s apart. */
    private static List<AnomalyCheckRequest.Reading> sorted(List<AnomalyCheckRequest.Reading> readings) {
        if (readings == null
                || readings.size() < AnomalyModel.MIN_READINGS
                || readings.size() > AnomalyModel.MAX_READINGS) {
            throw badRequest("readings: send between %d and %d readings."
                    .formatted(AnomalyModel.MIN_READINGS, AnomalyModel.MAX_READINGS));
        }
        for (var reading : readings) {
            if (reading == null || reading.timestamp() == null || !complete(reading)) {
                throw badRequest("readings: every reading needs a timestamp and a finite value for every metric.");
            }
        }
        var sorted = readings.stream()
                .sorted(Comparator.comparing(AnomalyCheckRequest.Reading::timestamp))
                .toList();
        for (int i = 1; i < sorted.size(); i++) {
            var gap = Duration.between(
                    sorted.get(i - 1).timestamp(), sorted.get(i).timestamp());
            if (gap.isZero()) {
                throw badRequest("readings: timestamps must be unique.");
            }
            if (gap.compareTo(AnomalyModel.MAX_GAP) > 0) {
                throw badRequest("readings: readings must be at most 2 seconds apart.");
            }
        }
        return sorted;
    }

    private static boolean complete(AnomalyCheckRequest.Reading reading) {
        return Stream.of(
                        reading.vibrationAcceleration(),
                        reading.pressure(),
                        reading.temperature(),
                        reading.flowRate(),
                        reading.power())
                .allMatch(value -> value != null && Double.isFinite(value));
    }

    private static double median(double[] values) {
        double[] sorted = values.clone();
        Arrays.sort(sorted);
        int mid = sorted.length / 2;
        return sorted.length % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    private static AnomalyCheckException badRequest(String message) {
        return new AnomalyCheckException(HttpStatus.BAD_REQUEST, message);
    }

    private static AnomalyCheckException notFound(String message) {
        return new AnomalyCheckException(HttpStatus.NOT_FOUND, message);
    }

    private static AnomalyCheckException conflict(String message) {
        return new AnomalyCheckException(HttpStatus.CONFLICT, message);
    }
}
