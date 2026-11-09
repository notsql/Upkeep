package com.proj.server.anomaly;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Which abnormal run a scoring pass considers. */
class AbnormalRunsTests {
    static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");

    /** One score per second from T0, plus {@code gapAfter} extra seconds after the index in {@code gapAt}. */
    static List<AbnormalRuns.Scored> scores(int gapAt, double... values) {
        var list = new ArrayList<AbnormalRuns.Scored>();
        long second = 0;
        for (int i = 0; i < values.length; i++) {
            if (i == gapAt) {
                second += 2;
            }
            list.add(new AbnormalRuns.Scored(T0.plusSeconds(second++), values[i]));
        }
        return list;
    }

    static Set<Instant> pass(List<AbnormalRuns.Scored> scores, int... indexes) {
        var set = new java.util.HashSet<Instant>();
        for (int i : indexes) {
            set.add(scores.get(i).measuredAt());
        }
        return set;
    }

    @Test
    void theLongestRunContainingASampleOfThePassIsConsidered() {
        // A run of 3 (index 0-2) outside the pass, a run of 2 (4-5) inside it.
        var s = scores(-1, 0.9, 0.9, 0.9, 0.1, 0.6, 0.7, 0.1);

        var run = AbnormalRuns.longest(s, pass(s, 5, 6)).orElseThrow();

        assertThat(run.samples())
                .extracting(AbnormalRuns.Scored::measuredAt)
                .containsExactly(s.get(4).measuredAt(), s.get(5).measuredAt());
    }

    @Test
    void aRunCanStartBeforeThePass() {
        var s = scores(-1, 0.9, 0.9, 0.9, 0.9);

        var run = AbnormalRuns.longest(s, pass(s, 3)).orElseThrow();

        assertThat(run.samples()).hasSize(4);
    }

    @Test
    void onATieTheLatestRunIsUsed() {
        var s = scores(-1, 0.9, 0.9, 0.1, 0.8, 0.8);

        var run = AbnormalRuns.longest(s, pass(s, 0, 1, 2, 3, 4)).orElseThrow();

        assertThat(run.samples().getFirst().measuredAt()).isEqualTo(s.get(3).measuredAt());
    }

    @Test
    void theDecisionThresholdIsAbnormal() {
        var s = scores(-1, AnomalyModel.DECISION_THRESHOLD, 0.5099);

        var run = AbnormalRuns.longest(s, pass(s, 0, 1)).orElseThrow();

        assertThat(run.samples()).hasSize(1);
    }

    @Test
    void aGapOverMaxGapEndsARun() {
        // Index 3 comes 3 s after index 2.
        var s = scores(3, 0.9, 0.9, 0.9, 0.9, 0.9);

        var run = AbnormalRuns.longest(s, pass(s, 4)).orElseThrow();

        assertThat(run.samples()).hasSize(2);
    }

    @Test
    void noAbnormalSampleInThePassIsNoRun() {
        var s = scores(-1, 0.9, 0.9, 0.1);

        assertThat(AbnormalRuns.longest(s, pass(s, 2))).isEmpty();
    }
}
