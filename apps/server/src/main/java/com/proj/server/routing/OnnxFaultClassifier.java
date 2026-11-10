package com.proj.server.routing;

import org.springframework.stereotype.Component;

/** Classifies a report with the team's trained water leak model (decision 0048). */
@Component
public class OnnxFaultClassifier implements FaultClassifier {
    private static final double THRESHOLD = RoutingDecision.CONFIDENCE_THRESHOLD.doubleValue();

    private final WaterLeakModel model;

    public OnnxFaultClassifier(WaterLeakModel model) {
        this.model = model;
    }

    @Override
    public boolean available() {
        return true;
    }

    @Override
    public Classification classify(Report report) {
        var prediction = model.predict(input(report));
        return classification(prediction.leak(), prediction.notLeak());
    }

    static String input(Report report) {
        return report.title() + " " + report.description();
    }

    static Classification classification(double leak, double notLeak) {
        if (leak >= THRESHOLD)
            return result(
                    ClassificationOutcome.EQUIPMENT_FAULT,
                    EquipmentType.PLUMBING.name(),
                    leak,
                    "Water leak, %d%% confidence.".formatted(percent(leak)));
        if (notLeak >= THRESHOLD)
            return result(
                    ClassificationOutcome.NOT_EQUIPMENT,
                    "NONE",
                    notLeak,
                    "Not a water leak, %d%% confidence.".formatted(percent(notLeak)));
        var reason =
                "Unclear whether this is a water leak (%d%% leak). Needs a check on site.".formatted(percent(leak));
        return leak > notLeak
                ? result(ClassificationOutcome.INCONCLUSIVE, EquipmentType.PLUMBING.name(), leak, reason)
                : result(ClassificationOutcome.INCONCLUSIVE, "NONE", notLeak, reason);
    }

    private static Classification result(
            ClassificationOutcome outcome, String equipmentType, double confidence, String reason) {
        return Classification.of(outcome.name(), equipmentType, confidence, reason, WaterLeakModel.VERSION);
    }

    private static long percent(double probability) {
        return Math.round(probability * 100);
    }
}
