package com.proj.server.anomaly;

import com.proj.server.asset.AssetAssessmentRepository;
import com.proj.server.asset.AssetCondition;
import com.proj.server.asset.AssetRepository;
import com.proj.server.asset.CreateAssetAssessmentRequest;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Scores a pump's stored samples and records an assessment for a long enough abnormal run (decisions 0021 and 0044).
 * One pass is one transaction, holding the asset's advisory lock throughout.
 */
@Service
public class AnomalyScoringService {
    /** The rolling window reaches at most this far back: 9 earlier samples, each at most MAX_GAP apart. */
    private static final Duration WINDOW_REACH = AnomalyModel.MAX_GAP.multipliedBy(AnomalyModel.WINDOW_ROWS - 1);

    private final AnomalyScoringRepository repository;
    private final AnomalyFeatureBuilder features;
    private final AnomalyScorer ml;
    private final AssetRepository assets;
    private final AssetAssessmentRepository assessments;
    private final TransactionTemplate transaction;

    public AnomalyScoringService(
            AnomalyScoringRepository repository,
            AnomalyFeatureBuilder features,
            AnomalyScorer ml,
            AssetRepository assets,
            AssetAssessmentRepository assessments,
            TransactionTemplate transaction) {
        this.repository = repository;
        this.features = features;
        this.ml = ml;
        this.assets = assets;
        this.assessments = assessments;
        this.transaction = transaction;
    }

    /**
     * Scores up to {@link AnomalyModel#MAX_READINGS} of the asset's oldest unscored samples and returns how many. A
     * model failure throws and stores nothing.
     */
    public int pass(UUID assetId) {
        Integer scored = transaction.execute(status -> {
            repository.lock(assetId);
            var estateId = repository.scorableEstate(assetId);
            if (estateId.isEmpty()) {
                return 0;
            }
            var targets = repository.unscored(assetId, AnomalyModel.MAX_READINGS);
            if (targets.isEmpty()) {
                return 0;
            }
            var times =
                    targets.stream().map(AnomalyCheckRequest.Reading::timestamp).toList();
            double[] scores = ml.scores(featuresFor(assetId, times));
            if (scores.length != times.size()) {
                throw new MlUnavailableException("The anomaly model returned an unexpected response.", null);
            }
            repository.insert(estateId.get(), assetId, times, scores);
            assess(estateId.get(), assetId, times);
            return times.size();
        });
        return scored == null ? 0 : scored;
    }

    /**
     * Each target's feature row, as the feature builder gives it when its segment is built as one batch. Windows are
     * causal, so a segment only needs the samples within the window's reach before the first target.
     */
    private double[][] featuresFor(UUID assetId, List<Instant> targets) {
        var wanted = new HashSet<>(targets);
        var context = repository.samples(assetId, targets.getFirst().minus(WINDOW_REACH), targets.getLast());
        var rows = new ArrayList<double[]>(targets.size());
        int start = 0;
        for (int i = 1; i <= context.size(); i++) {
            boolean end = i == context.size()
                    || Duration.between(
                                            context.get(i - 1).timestamp(),
                                            context.get(i).timestamp())
                                    .compareTo(AnomalyModel.MAX_GAP)
                            > 0;
            if (!end) {
                continue;
            }
            var segment = context.subList(start, i);
            double[][] built = features.build(segment);
            for (int j = 0; j < segment.size(); j++) {
                if (wanted.contains(segment.get(j).timestamp())) {
                    rows.add(built[j]);
                }
            }
            start = i;
        }
        return rows.toArray(double[][]::new);
    }

    /** Records the condition of the longest abnormal run touching this pass, if it is long enough and new. */
    private void assess(UUID estateId, UUID assetId, List<Instant> pass) {
        var reset = repository.lastPersonAssessment(assetId);
        var scores = repository.scoresAround(assetId, reset, pass.getFirst(), pass.getLast());
        var run = AbnormalRuns.longest(scores, new HashSet<>(pass));
        if (run.isEmpty() || run.get().samples().size() < AnomalyModel.MIN_ABNORMAL_RUN) {
            return;
        }
        var found = run.get();
        double median = found.median();
        var condition =
                median >= AnomalyModel.FAULTY_THRESHOLD ? AssetCondition.FAULTY : AssetCondition.NEEDS_ATTENTION;
        if (assets.currentCondition(assetId) == condition) {
            return;
        }
        var notes = String.format(
                Locale.ROOT,
                "%d consecutive abnormal samples in device readings from %s to %s. Median score %.2f, maximum %.2f.",
                found.samples().size(),
                found.first(),
                found.last(),
                median,
                found.max());
        assessments.create(
                estateId,
                assetId,
                new CreateAssetAssessmentRequest(condition, LocalDate.ofInstant(found.last(), ZoneOffset.UTC), notes),
                AnomalyModel.SYSTEM_USER_ID,
                AnomalyModel.SYSTEM_NAME);
    }
}
