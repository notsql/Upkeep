package com.proj.server.notification;

import com.proj.server.asset.AssetCondition;
import java.time.Instant;

/**
 * The longest abnormal run of an anomaly-check batch that is long enough to count (ID-105).
 *
 * @param suspect true when a reading in the run is outside its metric's valid range
 */
public record AbnormalRun(
        AssetCondition condition,
        double medianScore,
        double maxScore,
        Instant from,
        Instant to,
        String explanation,
        boolean suspect) {}
