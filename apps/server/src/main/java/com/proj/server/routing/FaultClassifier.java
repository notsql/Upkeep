package com.proj.server.routing;

/** Reads a fault report and says whether it is an equipment fault. */
public interface FaultClassifier {
    /** False when no model is configured; reports then go straight to the managing agent. */
    boolean available();

    /** @throws ClassificationFailedException when the attempt produced no usable answer */
    Classification classify(Report report);

    record Report(String title, String description) {}
}
