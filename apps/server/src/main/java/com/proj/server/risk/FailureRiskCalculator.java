package com.proj.server.risk;

import com.proj.server.catalogue.AssetCategoryCodes;
import com.proj.server.event.AssetEventType;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Component;

/** The Bayesian Weibull breakdown forecast (decision 0020). Pure arithmetic: "today" is passed in. */
@Component
public class FailureRiskCalculator {
    /** Types added later do not count unless their spec says so. */
    private static final Set<AssetEventType> COUNTING_TYPES =
            Set.of(AssetEventType.BREAKDOWN_REPAIR, AssetEventType.PREVENTIVE);

    private static final double PRIOR_B = PumpConstants.PRIOR_WEIGHT
            * Math.pow(
                    PumpConstants.MEAN_DAYS_BETWEEN_BREAKDOWNS / gamma(1 + 1 / PumpConstants.SHAPE),
                    PumpConstants.SHAPE);

    /** Whether the event counts toward the forecast for the unit currently installed. */
    public boolean counts(RiskAsset asset, RiskEvent event) {
        return COUNTING_TYPES.contains(event.type())
                && (asset.installedOn() == null || !event.occurredOn().isBefore(asset.installedOn()))
                && Objects.equals(asset.manufacturerId(), event.manufacturerId())
                && Objects.equals(asset.modelId(), event.modelId());
    }

    /** The posterior from the asset's counting events, given oldest first. */
    public Posterior posterior(RiskAsset asset, List<RiskEvent> events) {
        double a = PumpConstants.PRIOR_WEIGHT;
        double b = PRIOR_B;
        LocalDate start = asset.installedOn();
        for (RiskEvent event : counting(asset, events)) {
            if (event.type() == AssetEventType.BREAKDOWN_REPAIR) {
                a += 1;
            }
            if (start != null) {
                b += Math.pow(ChronoUnit.DAYS.between(start, event.occurredOn()), PumpConstants.SHAPE);
            }
            start = event.occurredOn();
        }
        return new Posterior(a, b);
    }

    /** The forecast as of {@code today}, from the asset's events, given oldest first. */
    public Forecast forecast(RiskAsset asset, List<RiskEvent> events, LocalDate today) {
        if (!AssetCategoryCodes.PUMP.equals(asset.category())) {
            return new Forecast(FailureRiskBasis.NOT_SUPPORTED, 0, null, null, null, null, null, null, false);
        }
        var counting = counting(asset, events);
        int failures = (int) counting.stream()
                .filter(event -> event.type() == AssetEventType.BREAKDOWN_REPAIR)
                .count();
        LocalDate installedOn = asset.installedOn();
        LocalDate endOfLife = installedOn == null ? null : installedOn.plusYears(PumpConstants.LIFESPAN_YEARS);
        boolean nearingEndOfLife =
                installedOn != null && !today.isBefore(installedOn.plusYears(PumpConstants.END_OF_LIFE_FLAG_YEARS));

        LocalDate since = counting.isEmpty() ? installedOn : counting.getLast().occurredOn();
        if (since == null) {
            return new Forecast(FailureRiskBasis.INSUFFICIENT_DATA, 0, null, null, null, null, null, null, false);
        }
        int u = (int) Math.max(0, ChronoUnit.DAYS.between(since, today));
        var posterior = posterior(asset, events);
        double p30 = probability(posterior, u, 30);
        double p60 = probability(posterior, u, 60);
        double p90 = probability(posterior, u, 90);
        return new Forecast(
                failures > 0 ? FailureRiskBasis.ASSET_HISTORY : FailureRiskBasis.SERVICE_INTERVAL,
                failures,
                u,
                p30,
                p60,
                p90,
                timeframe(p30, p60, p90),
                endOfLife,
                nearingEndOfLife);
    }

    private List<RiskEvent> counting(RiskAsset asset, List<RiskEvent> events) {
        return events.stream()
                .filter(event -> counts(asset, event))
                .sorted(Comparator.comparing(RiskEvent::occurredOn))
                .toList();
    }

    private static double probability(Posterior posterior, int u, int horizon) {
        double k = PumpConstants.SHAPE;
        double survived = posterior.b() + Math.pow(u, k);
        double later = posterior.b() + Math.pow(u + horizon, k);
        return 1 - Math.pow(survived / later, posterior.a());
    }

    private static RecommendedTimeframe timeframe(double p30, double p60, double p90) {
        double threshold = FailureRiskConstants.RISK_THRESHOLD;
        if (p30 >= threshold) return RecommendedTimeframe.WITHIN_30_DAYS;
        if (p60 >= threshold) return RecommendedTimeframe.WITHIN_60_DAYS;
        if (p90 >= threshold) return RecommendedTimeframe.WITHIN_90_DAYS;
        return RecommendedTimeframe.BEYOND_90_DAYS;
    }

    /** Lanczos approximation (g = 7, n = 9), accurate to about 15 significant digits for x > 0.5. */
    private static double gamma(double x) {
        double[] c = {
            0.99999999999980993,
            676.5203681218851,
            -1259.1392167224028,
            771.32342877765313,
            -176.61502916214059,
            12.507343278686905,
            -0.13857109526572012,
            9.9843695780195716e-6,
            1.5056327351493116e-7
        };
        x -= 1;
        double sum = c[0];
        for (int i = 1; i < c.length; i++) {
            sum += c[i] / (x + i);
        }
        double t = x + 7.5;
        return Math.sqrt(2 * Math.PI) * Math.pow(t, x + 0.5) * Math.exp(-t) * sum;
    }
}
