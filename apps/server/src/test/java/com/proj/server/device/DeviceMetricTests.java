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

    @Test
    void temperatureValidMinIsMinus40() {
        assertEquals(-40.0, DeviceMetric.TEMPERATURE.validMin());
    }

    @Test
    void temperatureValidMaxIs150() {
        assertEquals(150.0, DeviceMetric.TEMPERATURE.validMax());
    }

    @Test
    void humidityValidMinIs0() {
        assertEquals(0.0, DeviceMetric.HUMIDITY.validMin());
    }

    @Test
    void humidityValidMaxIs100() {
        assertEquals(100.0, DeviceMetric.HUMIDITY.validMax());
    }

    @Test
    void pressureValidMinIs0() {
        assertEquals(0.0, DeviceMetric.PRESSURE.validMin());
    }

    @Test
    void pressureValidMaxIs25() {
        assertEquals(25.0, DeviceMetric.PRESSURE.validMax());
    }

    @Test
    void flowRateValidMinIs0() {
        assertEquals(0.0, DeviceMetric.FLOW_RATE.validMin());
    }

    @Test
    void flowRateValidMaxIs10000() {
        assertEquals(10000.0, DeviceMetric.FLOW_RATE.validMax());
    }

    @Test
    void vibrationValidMinIs0() {
        assertEquals(0.0, DeviceMetric.VIBRATION.validMin());
    }

    @Test
    void vibrationValidMaxIs100() {
        assertEquals(100.0, DeviceMetric.VIBRATION.validMax());
    }

    @Test
    void vibrationAccelerationValidMinIs0() {
        assertEquals(0.0, DeviceMetric.VIBRATION_ACCELERATION.validMin());
    }

    @Test
    void vibrationAccelerationValidMaxIs16() {
        assertEquals(16.0, DeviceMetric.VIBRATION_ACCELERATION.validMax());
    }

    @Test
    void powerValidMinIs0() {
        assertEquals(0.0, DeviceMetric.POWER.validMin());
    }

    @Test
    void powerValidMaxIs1000() {
        assertEquals(1000.0, DeviceMetric.POWER.validMax());
    }

    @Test
    void energyValidMinIs0() {
        assertEquals(0.0, DeviceMetric.ENERGY.validMin());
    }

    @Test
    void energyValidMaxIs10000000() {
        assertEquals(10000000.0, DeviceMetric.ENERGY.validMax());
    }
}
