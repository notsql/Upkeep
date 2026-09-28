package com.proj.server.device;

/** The fixed metric catalogue (decision 0016). A metric's unit never changes; add a metric instead. */
public enum DeviceMetric {
    TEMPERATURE("°C"),
    HUMIDITY("%"),
    PRESSURE("bar"),
    FLOW_RATE("L/min"),
    VIBRATION("mm/s"),
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
