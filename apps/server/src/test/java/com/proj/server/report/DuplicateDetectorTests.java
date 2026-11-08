package com.proj.server.report;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.proj.server.report.DuplicateDetector.Candidate;
import com.proj.server.report.DuplicateDetector.LocationMatch;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class DuplicateDetectorTests {
    private static final OffsetDateTime T0 = OffsetDateTime.parse("2026-01-01T00:00:00Z");

    @Test
    void similarityIsTheJaccardIndexOfMeaningfulTokens() {
        // {water, leaking, ceiling} vs {water, leaking, lift}: 2 shared of 4 distinct.
        assertEquals(
                0.5, DuplicateDetector.similarity("Water leaking", "from the ceiling", "Leaking water", "at the lift"));
    }

    @Test
    void similarityIgnoresCaseStopWordsAndShortTokens() {
        assertEquals(1.0, DuplicateDetector.similarity("The PIPE is leaking", "", "pipe leaking", "a"));
    }

    @Test
    void similarityTreatsPunctuationAsASeparator() {
        assertEquals(1.0, DuplicateDetector.similarity("pipe-leaking!", "", "pipe leaking", ""));
    }

    @Test
    void similarityKeepsNonAsciiWords() {
        assertEquals(1.0, DuplicateDetector.similarity("Ascenseur bloqué", "", "bloqué ascenseur", ""));
    }

    @Test
    void similarityOfTwoEmptyTokenSetsIsZero() {
        assertEquals(0.0, DuplicateDetector.similarity("the", "a", "is", "of"));
    }

    @ParameterizedTest
    @ValueSource(
            strings = {
                "Leaking again",
                "STILL dripping",
                "another puddle",
                "the same problem",
                "it keeps happening",
                "recurring fault",
                "it recurred",
                "repeated leak",
                "leak not fixed",
                "It came back",
                "dripping once more"
            })
    void recognisesRepeatCues(String text) {
        assertTrue(DuplicateDetector.hasRepeatCue(text, ""));
        assertTrue(DuplicateDetector.hasRepeatCue("", text));
    }

    @ParameterizedTest
    @ValueSource(strings = {"Against the wall", "Stillwater block", "sameness", "come back later", "not fixedly"})
    void repeatCuesMustBeWholeWordsOrPhrases(String text) {
        assertFalse(DuplicateDetector.hasRepeatCue(text, ""));
    }

    @Test
    void noCandidatesMeansNoMatch() {
        assertTrue(DuplicateDetector.detect("Leaking pipe", "Water everywhere", List.of())
                .isEmpty());
    }

    @Test
    void candidateBelowThresholdWithoutCueDoesNotMatch() {
        var candidate = candidate(LocationMatch.EXACT, T0, "Broken light", "Lift lobby bulb out");

        assertTrue(DuplicateDetector.detect("Leaking pipe", "Water everywhere", List.of(candidate))
                .isEmpty());
    }

    @Test
    void similarCandidateMatchesAndRecordsItsSignals() {
        // {leaking, pipe, water} vs {leaking, pipe, lift, lobby}: 2 shared of 5 distinct.
        var candidate = candidate(LocationMatch.EXACT, T0, "Leaking pipe", "lift lobby");

        var match = DuplicateDetector.detect("Leaking pipe", "water", List.of(candidate))
                .orElseThrow();

        assertEquals(candidate.id(), match.originalReportId());
        assertEquals(LocationMatch.EXACT, match.locationMatch());
        assertEquals(new BigDecimal("0.400"), match.textSimilarity());
        assertFalse(match.repeatCue());
    }

    @Test
    void similarityOfExactlyAQuarterQualifies() {
        // {pipe, ddd, eee} vs {pipe, ccc}: 1 shared of 4 distinct.
        var candidate = candidate(LocationMatch.NEARBY, T0, "pipe ccc", "");

        var match =
                DuplicateDetector.detect("pipe ddd", "eee", List.of(candidate)).orElseThrow();

        assertEquals(new BigDecimal("0.250"), match.textSimilarity());
    }

    @Test
    void repeatCueQualifiesACandidateWithNoSharedWords() {
        var candidate = candidate(LocationMatch.NEARBY, T0, "Broken light", "");

        var match = DuplicateDetector.detect("Happening again", "", List.of(candidate))
                .orElseThrow();

        assertEquals(LocationMatch.NEARBY, match.locationMatch());
        assertEquals(new BigDecimal("0.000"), match.textSimilarity());
        assertTrue(match.repeatCue());
    }

    @Test
    void cueInTheCandidateDoesNotCount() {
        var candidate = candidate(LocationMatch.EXACT, T0, "Leaking again", "");

        assertTrue(
                DuplicateDetector.detect("Broken light", "", List.of(candidate)).isEmpty());
    }

    @Test
    void exactLocationOutranksHigherSimilarityNearby() {
        var nearby = candidate(LocationMatch.NEARBY, T0, "Leaking pipe water", "");
        var exact = candidate(LocationMatch.EXACT, T0.plusDays(1), "Leaking pipe lobby", "");

        var match = DuplicateDetector.detect("Leaking pipe water", "", List.of(nearby, exact))
                .orElseThrow();

        assertEquals(exact.id(), match.originalReportId());
    }

    @Test
    void higherSimilarityOutranksAge() {
        var older = candidate(LocationMatch.EXACT, T0, "Leaking pipe lobby", "");
        var closer = candidate(LocationMatch.EXACT, T0.plusDays(1), "Leaking pipe water", "");

        var match = DuplicateDetector.detect("Leaking pipe water", "", List.of(older, closer))
                .orElseThrow();

        assertEquals(closer.id(), match.originalReportId());
    }

    @Test
    void olderReportWinsATie() {
        var newer = candidate(LocationMatch.EXACT, T0.plusDays(1), "Leaking pipe", "");
        var older = candidate(LocationMatch.EXACT, T0, "Leaking pipe", "");

        var match = DuplicateDetector.detect("Leaking pipe", "", List.of(newer, older))
                .orElseThrow();

        assertEquals(older.id(), match.originalReportId());
    }

    @Test
    void lowerIdWinsWhenEverythingElseTies() {
        var high = new Candidate(
                UUID.fromString("ffffffff-0000-0000-0000-000000000000"), T0, LocationMatch.EXACT, "Leaking pipe", "");
        var low = new Candidate(
                UUID.fromString("00000000-0000-0000-0000-000000000001"), T0, LocationMatch.EXACT, "Leaking pipe", "");

        var match =
                DuplicateDetector.detect("Leaking pipe", "", List.of(high, low)).orElseThrow();

        assertEquals(low.id(), match.originalReportId());
    }

    private static Candidate candidate(
            LocationMatch match, OffsetDateTime createdAt, String title, String description) {
        return new Candidate(UUID.randomUUID(), createdAt, match, title, description);
    }
}
