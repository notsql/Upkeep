package com.proj.server.risk;

/** The agreed pump estimates, applied to {@code AssetCategoryCodes.PUMP} (spec "Estimates and why", decision 0020). Time is in days. */
public final class PumpConstants {
    public static final double MEAN_DAYS_BETWEEN_BREAKDOWNS = 1095;
    public static final double SHAPE = 1.2;
    public static final double PRIOR_WEIGHT = 0.5;
    public static final int LIFESPAN_YEARS = 15;
    public static final int END_OF_LIFE_FLAG_YEARS = 12;

    private PumpConstants() {}
}
