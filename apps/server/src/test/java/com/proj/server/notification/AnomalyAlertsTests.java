package com.proj.server.notification;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.proj.server.anomaly.AnomalyModel;
import com.proj.server.asset.AssetCondition;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

/** The anomaly alert uses the model's fixed threshold and the estate's switch. */
class AnomalyAlertsTests {
    static final UUID ESTATE = UUID.randomUUID();
    static final UUID ASSET = UUID.randomUUID();
    static final NotificationSettings OFF = new NotificationSettings(false, true, true, true, true);

    NotificationRepository repository;
    NotificationSettingsService settings;
    ApplicationEventPublisher events;
    AnomalyAlerts alerts;

    @BeforeEach
    void setup() {
        repository = mock(NotificationRepository.class);
        settings = mock(NotificationSettingsService.class);
        events = mock(ApplicationEventPublisher.class);
        when(settings.forEstate(ESTATE)).thenReturn(NotificationSettings.DEFAULTS);
        when(repository.lockOpen(ASSET, NotificationType.ANOMALY)).thenReturn(Optional.empty());
        alerts = new AnomalyAlerts(repository, settings, events);
    }

    static AbnormalRun run(double median, boolean suspect) {
        return new AbnormalRun(
                AssetCondition.NEEDS_ATTENTION, median, median, Instant.EPOCH, Instant.EPOCH, "why", suspect);
    }

    @Test
    void aRunAtTheModelThresholdRaisesAnAlertAndAnnouncesIt() {
        var id = UUID.randomUUID();
        when(repository.insertAnomaly(eq(ESTATE), eq(ASSET), anyString(), any()))
                .thenReturn(Optional.of(id));
        alerts.abnormal(ESTATE, ASSET, run(AnomalyModel.DECISION_THRESHOLD, false));
        verify(events).publishEvent(new AnomalyAlertRaised(id, ESTATE, ASSET));
    }

    @Test
    void aRunBelowTheModelThresholdRaisesNothing() {
        alerts.abnormal(ESTATE, ASSET, run(Math.nextDown(AnomalyModel.DECISION_THRESHOLD), false));
        verify(repository, never()).insertAnomaly(any(), any(), any(), any());
    }

    @Test
    void aSwitchedOffEstateGetsNoAlert() {
        when(settings.forEstate(ESTATE)).thenReturn(OFF);
        alerts.abnormal(ESTATE, ASSET, run(0.99, false));
        verify(repository, never()).insertAnomaly(any(), any(), any(), any());
        verify(events, never()).publishEvent(any(Object.class));
    }

    @Test
    void updatingAnOpenAlertAnnouncesNothing() {
        var open = UUID.randomUUID();
        when(repository.lockOpen(ASSET, NotificationType.ANOMALY)).thenReturn(Optional.of(open));
        alerts.abnormal(ESTATE, ASSET, run(0.9, false));
        verify(repository).updateAnomaly(eq(open), anyString(), any());
        verify(events, never()).publishEvent(any(Object.class));
    }

    @Test
    void losingTheInsertRaceAnnouncesNothing() {
        var other = UUID.randomUUID();
        when(repository.insertAnomaly(eq(ESTATE), eq(ASSET), anyString(), any()))
                .thenReturn(Optional.empty());
        when(repository.lockOpen(ASSET, NotificationType.ANOMALY))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(other));
        alerts.abnormal(ESTATE, ASSET, run(0.9, false));
        verify(repository).updateAnomaly(eq(other), anyString(), any());
        verify(events, never()).publishEvent(any(Object.class));
    }
}
