package com.proj.server.anomaly;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Finds the abnormal run a scoring pass acts on, from stored scores. */
final class AbnormalRuns {
    record Scored(Instant measuredAt, double score) {}

    record Run(List<Scored> samples) {
        Instant first() {
            return samples.getFirst().measuredAt();
        }

        Instant last() {
            return samples.getLast().measuredAt();
        }

        double max() {
            return samples.stream().mapToDouble(Scored::score).max().orElse(0);
        }

        double median() {
            double[] sorted =
                    samples.stream().mapToDouble(Scored::score).sorted().toArray();
            int mid = sorted.length / 2;
            return sorted.length % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        }
    }

    private AbnormalRuns() {}

    /**
     * The longest run of consecutive abnormal scores, within one segment, that contains a sample in {@code pass}; the
     * latest on a tie. {@code scores} are sorted by time.
     */
    static Optional<Run> longest(List<Scored> scores, Set<Instant> pass) {
        Run best = null;
        var current = new ArrayList<Scored>();
        boolean inPass = false;
        Scored previous = null;
        for (var s : scores) {
            boolean split = previous != null
                    && Duration.between(previous.measuredAt(), s.measuredAt()).compareTo(AnomalyModel.MAX_GAP) > 0;
            if (split || s.score() < AnomalyModel.DECISION_THRESHOLD) {
                best = better(best, current, inPass);
                current = new ArrayList<>();
                inPass = false;
            }
            if (s.score() >= AnomalyModel.DECISION_THRESHOLD) {
                current.add(s);
                inPass |= pass.contains(s.measuredAt());
            }
            previous = s;
        }
        return Optional.ofNullable(better(best, current, inPass));
    }

    private static Run better(Run best, List<Scored> run, boolean inPass) {
        if (!inPass || run.isEmpty()) {
            return best;
        }
        return best == null || run.size() >= best.samples().size() ? new Run(List.copyOf(run)) : best;
    }
}
