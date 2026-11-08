package com.proj.server.notification;

import com.proj.server.asset.AssetCondition;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Raises, updates and resolves the one open anomaly alert per pump (ID-105, ID-106). Called inside the anomaly
 * check's transaction.
 */
@Service
public class AnomalyAlerts {
    private final NotificationRepository repository;
    private final NotificationSettingsService settings;

    public AnomalyAlerts(NotificationRepository repository, NotificationSettingsService settings) {
        this.repository = repository;
        this.settings = settings;
    }

    /** A batch whose longest abnormal run is too short: the pump is back to normal. */
    public void normal(UUID assetId) {
        repository.resolveOpen(assetId, NotificationType.ANOMALY);
    }

    /** A batch with a long enough abnormal run; it raises or updates an alert only when it qualifies. */
    public void abnormal(UUID estateId, UUID assetId, AbnormalRun run) {
        var threshold = settings.forEstate(estateId).anomalyScoreThreshold().doubleValue();
        if (run.suspect() || run.medianScore() < threshold) {
            return;
        }
        var summary = summary(run.condition());
        var open = repository.lockOpen(assetId, NotificationType.ANOMALY);
        if (open.isEmpty() && repository.insertAnomaly(estateId, assetId, summary, run)) {
            return;
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
