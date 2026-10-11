package com.proj.server.risk;

import java.time.LocalDate;
import java.util.List;

/** The Bayesian Weibull breakdown forecast (decision 0020). Pure arithmetic: "today" is passed in. */
public class FailureRiskCalculator {

    /** Whether the event counts toward the forecast for the unit currently installed. */
    public boolean counts(RiskAsset asset, RiskEvent event) {
        throw new UnsupportedOperationException("Not implemented");
    }

    /** The posterior from the asset's counting events, given oldest first. */
    public Posterior posterior(RiskAsset asset, List<RiskEvent> events) {
        throw new UnsupportedOperationException("Not implemented");
    }

    /** The forecast as of {@code today}, from the asset's events, given oldest first. */
    public Forecast forecast(RiskAsset asset, List<RiskEvent> events, LocalDate today) {
        throw new UnsupportedOperationException("Not implemented");
    }
}
