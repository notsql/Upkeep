package com.proj.server.notification;

import com.proj.server.anomaly.AnomalyModel;
import com.proj.server.asset.AssetCondition;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

/**
 * Raises, updates and resolves the one open anomaly alert per pump (ID-105, ID-106). Called inside the anomaly
 * check's transaction.
 */
@Service
public class AnomalyAlerts {
    private final NotificationRepository repository;
    private final NotificationSettingsService settings;
    private final ApplicationEventPublisher events;

    public AnomalyAlerts(
            NotificationRepository repository, NotificationSettingsService settings, ApplicationEventPublisher events) {
        this.repository = repository;
        this.settings = settings;
        this.events = events;
    }

    /** A batch whose longest abnormal run is too short: the pump is back to normal. */
    public void normal(UUID assetId) {
        repository.resolveOpen(assetId, NotificationType.ANOMALY);
    }

    /**
     * A batch with a long enough abnormal run; it raises or updates an alert only when it reaches the model's
     * threshold and the estate's switch is on. A newly raised alert is announced for email after commit.
     */
    public void abnormal(UUID estateId, UUID assetId, AbnormalRun run) {
        if (run.suspect()
                || run.medianScore() < AnomalyModel.DECISION_THRESHOLD
                || !settings.forEstate(estateId).anomalyEnabled()) {
            return;
        }
        var summary = summary(run.condition());
        var open = repository.lockOpen(assetId, NotificationType.ANOMALY);
        if (open.isEmpty()) {
            var raised = repository.insertAnomaly(estateId, assetId, summary, run);
            if (raised.isPresent()) {
                events.publishEvent(new AnomalyAlertRaised(raised.get(), estateId, assetId));
                return;
            }
        }
        // Either already open, or another check opened it between the lock and the insert.
        var id = open.orElseGet(
                () -> repository.lockOpen(assetId, NotificationType.ANOMALY).orElseThrow());
        repository.updateAnomaly(id, summary, run);
    }

    static String summary(AssetCondition condition) {
        return condition == AssetCondition.FAULTY ? "Abnormal readings: faulty" : "Abnormal readings: needs attention";
    }
}
