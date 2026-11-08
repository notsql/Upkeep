package com.proj.server.anomaly;

import com.proj.server.reading.ReadingsStored;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Starts scoring once stored readings are committed, off the request thread (decision 0044). At most one run per
 * asset waits in the queue; it scores everything unscored when it starts, so later triggers fold into it.
 */
@Component
public class AnomalyScoringScheduler {
    private static final Logger log = LoggerFactory.getLogger(AnomalyScoringScheduler.class);

    private final AnomalyScoringService scoring;
    private final TaskExecutor executor;
    private final Set<UUID> queued = ConcurrentHashMap.newKeySet();

    public AnomalyScoringScheduler(
            AnomalyScoringService scoring, @Qualifier("anomalyScoringExecutor") TaskExecutor executor) {
        this.scoring = scoring;
        this.executor = executor;
    }

    @TransactionalEventListener
    public void readingsStored(ReadingsStored event) {
        var assetId = event.assetId();
        if (queued.add(assetId)) {
            executor.execute(() -> score(assetId));
        }
    }

    private void score(UUID assetId) {
        queued.remove(assetId);
        try {
            while (scoring.pass(assetId) == AnomalyModel.MAX_READINGS) {
                // More may remain: keep going until a pass comes up short.
            }
        } catch (RuntimeException failure) {
            // Unscored samples stay unscored; the next stored reading starts another pass.
            log.warn("Anomaly scoring failed for asset {}", assetId, failure);
        }
    }
}
