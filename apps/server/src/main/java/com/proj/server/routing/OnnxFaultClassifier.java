package com.proj.server.routing;

import org.springframework.stereotype.Component;

/** Classifies a report into a fault category with the team's in-process TF-IDF model. */
@Component
public class OnnxFaultClassifier implements FaultClassifier {
    private final FaultCategoryModel model;

    public OnnxFaultClassifier(FaultCategoryModel model) {
        this.model = model;
    }

    @Override
    public boolean available() {
        return true;
    }

    @Override
    public Classification classify(Report report) {
        return Classification.fromProbabilities(model.predict(input(report)), FaultCategoryModel.VERSION);
    }

    static String input(Report report) {
        return report.title() + " " + report.description();
    }
}
