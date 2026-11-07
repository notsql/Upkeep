package com.proj.server.report;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Rule-based duplicate detection for fault reports (ID-74). Candidates arrive already filtered to open, unlinked
 * reports with an exact or nearby location match; this class scores their text and picks the original.
 */
public final class DuplicateDetector {
    static final double SIMILARITY_THRESHOLD = 0.25;

    private static final Pattern SEPARATOR = Pattern.compile("[^\\p{L}\\p{N}]+");

    private static final Set<String> STOP_WORDS = Set.of(
            "the", "and", "for", "from", "with", "this", "that", "these", "those", "are", "was", "were", "has", "have",
            "had", "been", "there", "here", "its", "our", "your", "their", "but", "into", "onto", "very", "not", "near",
            "please", "can", "will", "also");

    private static final Pattern REPEAT_CUE = Pattern.compile(
            "(?<![\\p{L}\\p{N}])(again|still|another|same|keeps|recurring|recurred|repeated|not\\s+fixed"
                    + "|came\\s+back|once\\s+more)(?![\\p{L}\\p{N}])");

    private DuplicateDetector() {}

    public enum LocationMatch {
        EXACT,
        NEARBY
    }

    public record Candidate(
            UUID id, OffsetDateTime createdAt, LocationMatch locationMatch, String title, String description) {}

    public record Match(
            UUID originalReportId, LocationMatch locationMatch, BigDecimal textSimilarity, boolean repeatCue) {}

    private record Scored(Candidate candidate, double similarity) {}

    public static Optional<Match> detect(String title, String description, List<Candidate> candidates) {
        var tokens = tokens(title, description);
        boolean cue = hasRepeatCue(title, description);
        return candidates.stream()
                .map(candidate ->
                        new Scored(candidate, jaccard(tokens, tokens(candidate.title(), candidate.description()))))
                .filter(scored -> cue || scored.similarity() >= SIMILARITY_THRESHOLD)
                .min(Comparator.comparing((Scored scored) -> scored.candidate().locationMatch())
                        .thenComparing(Scored::similarity, Comparator.reverseOrder())
                        .thenComparing(scored -> scored.candidate().createdAt())
                        // UUID.compareTo is signed; the canonical string orders like Postgres.
                        .thenComparing(scored -> scored.candidate().id().toString()))
                .map(best -> new Match(
                        best.candidate().id(),
                        best.candidate().locationMatch(),
                        BigDecimal.valueOf(best.similarity()).setScale(3, RoundingMode.HALF_UP),
                        cue));
    }

    static double similarity(String title, String description, String otherTitle, String otherDescription) {
        return jaccard(tokens(title, description), tokens(otherTitle, otherDescription));
    }

    static boolean hasRepeatCue(String title, String description) {
        return REPEAT_CUE.matcher(lower(title)).find()
                || REPEAT_CUE.matcher(lower(description)).find();
    }

    private static Set<String> tokens(String title, String description) {
        return Arrays.stream(SEPARATOR.split(lower(title) + " " + lower(description)))
                .filter(token -> token.codePointCount(0, token.length()) >= 3 && !STOP_WORDS.contains(token))
                .collect(Collectors.toSet());
    }

    private static double jaccard(Set<String> a, Set<String> b) {
        var union = new HashSet<>(a);
        union.addAll(b);
        if (union.isEmpty()) return 0.0;
        var intersection = new HashSet<>(a);
        intersection.retainAll(b);
        return (double) intersection.size() / union.size();
    }

    private static String lower(String text) {
        return text == null ? "" : text.toLowerCase(Locale.ROOT);
    }
}
