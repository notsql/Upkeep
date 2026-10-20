package com.proj.server.device;

/**
 * The fixed metric catalogue (decision 0016). A metric's unit never changes; add a metric instead. Each metric also
 * has a fixed valid range, inclusive at both ends; readings outside it are flagged, not rejected.
 */
public enum DeviceMetric {
    TEMPERATURE("°C", -40, 150),
    HUMIDITY("%", 0, 100),
    PRESSURE("bar", 0, 25),
    FLOW_RATE("L/min", 0, 10_000),
    VIBRATION("mm/s", 0, 100),
    /** RMS acceleration, the unit the anomaly model was trained on (decision 0021). */
    VIBRATION_ACCELERATION("g", 0, 16),
    POWER("kW", 0, 1_000),
    ENERGY("kWh", 0, 10_000_000);

    private final String unit;
    private final double validMin;
    private final double validMax;

    DeviceMetric(String unit, double validMin, double validMax) {
        this.unit = unit;
        this.validMin = validMin;
        this.validMax = validMax;
    }

    public String unit() {
        return unit;
    }

    public double validMin() {
        return validMin;
    }

    public double validMax() {
        return validMax;
    }
}
