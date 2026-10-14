package com.proj.server.device;

/** The fixed metric catalogue (decision 0016). A metric's unit never changes; add a metric instead. */
public enum DeviceMetric {
    TEMPERATURE("°C"),
    HUMIDITY("%"),
    PRESSURE("bar"),
    FLOW_RATE("L/min"),
    VIBRATION("mm/s"),
    /** RMS acceleration, the unit the anomaly model was trained on (decision 0021). */
    VIBRATION_ACCELERATION("g"),
    POWER("kW"),
    ENERGY("kWh");

    private final String unit;

    DeviceMetric(String unit) {
        this.unit = unit;
    }

    public String unit() {
        return unit;
    }
}
