package com.proj.server.device;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

/** Decision 0027: offline after 3 times the interval or 5 minutes, whichever is longer. */
class DeviceStatusTests {
    private final OffsetDateTime now = OffsetDateTime.parse("2026-10-24T12:00:00Z");

    private DeviceStatus silentFor(Duration silence, int intervalSeconds) {
        return DeviceStatus.of(now.minus(silence), intervalSeconds, now.toInstant());
    }

    @Test
    void aDeviceThatHasNeverReportedIsAwaitingItsFirstReading() {
        assertThat(DeviceStatus.of(null, 60, now.toInstant())).isEqualTo(DeviceStatus.AWAITING_FIRST_READING);
    }

    @Test
    void aDeviceThatJustReportedIsOnline() {
        assertThat(silentFor(Duration.ZERO, 60)).isEqualTo(DeviceStatus.ONLINE);
    }

    @Test
    void aShortIntervalDeviceStaysOnlineForFiveMinutes() {
        assertThat(silentFor(Duration.ofMinutes(4), 60)).isEqualTo(DeviceStatus.ONLINE);
        assertThat(silentFor(Duration.ofMinutes(5), 60)).isEqualTo(DeviceStatus.ONLINE);
        assertThat(silentFor(Duration.ofMinutes(5).plusSeconds(1), 60)).isEqualTo(DeviceStatus.OFFLINE);
    }

    @Test
    void aLongIntervalDeviceStaysOnlineForThreeIntervals() {
        assertThat(silentFor(Duration.ofMinutes(30), 600)).isEqualTo(DeviceStatus.ONLINE);
        assertThat(silentFor(Duration.ofMinutes(30).plusSeconds(1), 600)).isEqualTo(DeviceStatus.OFFLINE);
    }

    @Test
    void aOneSecondIntervalDeviceDoesNotFlickerOffline() {
        assertThat(silentFor(Duration.ofSeconds(10), 1)).isEqualTo(DeviceStatus.ONLINE);
    }

    @Test
    void aDeactivatedDeviceIsDeactivatedWhateverItsLastReading() {
        var deactivatedAt = now.minusDays(1);
        assertThat(DeviceStatus.of(deactivatedAt, now, 60, now.toInstant())).isEqualTo(DeviceStatus.DEACTIVATED);
        assertThat(DeviceStatus.of(deactivatedAt, now.minusDays(30), 60, now.toInstant()))
                .isEqualTo(DeviceStatus.DEACTIVATED);
        assertThat(DeviceStatus.of(deactivatedAt, null, 60, now.toInstant())).isEqualTo(DeviceStatus.DEACTIVATED);
    }

    @Test
    void anActiveDeviceFollowsTheReportingRule() {
        assertThat(DeviceStatus.of(null, now, 60, now.toInstant())).isEqualTo(DeviceStatus.ONLINE);
        assertThat(DeviceStatus.of(null, null, 60, now.toInstant())).isEqualTo(DeviceStatus.AWAITING_FIRST_READING);
    }
}
