package com.proj.server.device;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class DeviceMetricTests {

    /** Decision 0021: acceleration in g RMS, the unit the anomaly model was trained on. */
    @Test
    void includesVibrationAccelerationInG() {
        assertEquals("g", DeviceMetric.valueOf("VIBRATION_ACCELERATION").unit());
    }

    /** Decision 0016: an existing metric's unit never changes. */
    @Test
    void keepsVibrationInMillimetresPerSecond() {
        assertEquals("mm/s", DeviceMetric.VIBRATION.unit());
    }
}
