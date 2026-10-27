package com.proj.server.routing;

import com.proj.server.resident.ResidentImageStore;
import com.proj.server.workorder.WorkOrderException;
import com.proj.server.workorder.WorkOrderPriority;
import com.proj.server.workorder.WorkOrderProgressService;
import com.proj.server.workorder.WorkOrderService;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import java.util.function.IntConsumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Classifies newly submitted reports and routes them into ID-36 work orders. The model call happens outside any
 * transaction; a lease on the routing row keeps two API instances from classifying the same report.
 */
@Component
public class ReportClassificationJob {
    static final int MAX_ATTEMPTS = 3;
    static final String UNAVAILABLE = "Automatic classification unavailable";
    private static final Duration LEASE = Duration.ofMinutes(3);
    private static final int BATCH = 20;
    private static final Logger log = LoggerFactory.getLogger(ReportClassificationJob.class);

    private final RoutingRepository routing;
    private final FaultClassifier classifier;
    private final ResidentImageStore images;
    private final WorkOrderService orders;
    private final WorkOrderProgressService progress;
    private final TransactionTemplate transactions;
    private final Clock clock;

    public ReportClassificationJob(
            RoutingRepository routing,
            FaultClassifier classifier,
            ResidentImageStore images,
            WorkOrderService orders,
            WorkOrderProgressService progress,
            TransactionTemplate transactions,
            Clock clock) {
        this.routing = routing;
        this.classifier = classifier;
        this.images = images;
        this.orders = orders;
        this.progress = progress;
        this.transactions = transactions;
        this.clock = clock;
    }

    @Scheduled(
            fixedDelayString = "${app.routing.poll-interval:PT15S}",
            initialDelayString = "${app.routing.initial-delay:PT30S}")
    public void run() {
        for (int i = 0; i < BATCH && classifyNext(); i++) {
            // Each call claims and settles one report.
        }
    }

    /** Classifies and routes the next due report; false when none is due. */
    public boolean classifyNext() {
        var now = now();
        var lease = now.plus(LEASE);
        var claimed = transactions.execute(status -> routing.claimClassification(now, lease));
        if (claimed == null || claimed.isEmpty()) return false;
        var reportId = claimed.get().reportId();
        var estateId = claimed.get().estateId();
        var source = routing.source(reportId).orElseThrow();
        if (!source.estateActive()) {
            settle(estateId, reportId, lease, attempts -> routing.review(reportId, attempts, "Estate is inactive"));
            return true;
        }
        if (!classifier.available()) {
            settle(estateId, reportId, lease, attempts -> routing.review(reportId, attempts, UNAVAILABLE));
            return true;
        }
        Classification result;
        try {
            var photos = source.images().stream()
                    .map(image -> new FaultClassifier.Image(images.read(image.key()), image.contentType()))
                    .toList();
            result = classifier.classify(
                    new FaultClassifier.Report(source.title(), source.description(), source.locationLabel(), photos));
        } catch (RuntimeException failure) {
            log.warn("Classifying report {} failed: {}", reportId, failure.getMessage());
            settle(estateId, reportId, lease, attempts -> {
                var next = attempts + 1;
                if (next >= MAX_ATTEMPTS) routing.review(reportId, next, UNAVAILABLE);
                else routing.retryClassification(reportId, next, now().plus(RoutingDecision.backoff(next)));
            });
            return true;
        }
        settle(estateId, reportId, lease, attempts -> {
            routing.recordClassification(reportId, result);
            var contractors = routing.contractors(estateId);
            switch (RoutingDecision.decide(result, contractors.keySet())) {
                case RoutingDecision.Route route -> {
                    try {
                        var workOrder = orders.createFromRoutedReport(
                                estateId, reportId, WorkOrderService.AUTOMATIC_ROUTING_USER, WorkOrderPriority.MEDIUM);
                        progress.assign(
                                estateId,
                                workOrder,
                                WorkOrderService.AUTOMATIC_ROUTING_USER,
                                WorkOrderService.AUTOMATIC_ROUTING_NAME);
                        routing.createDispatch(
                                workOrder,
                                estateId,
                                route.equipmentType(),
                                contractors.get(route.equipmentType()),
                                null);
                        routing.decide(reportId, RoutingState.WORK_ORDER, null, workOrder);
                    } catch (WorkOrderException rejected) {
                        // ID-36's rules refused the order before writing it, so the report goes to review instead.
                        routing.review(reportId, attempts, rejected.getMessage());
                    }
                }
                case RoutingDecision.Review review -> routing.review(reportId, attempts, review.reason());
            }
        });
        return true;
    }

    /** Writes the outcome only while this worker's lease still holds the row; the estate is locked first. */
    private void settle(UUID estateId, UUID reportId, OffsetDateTime lease, IntConsumer write) {
        transactions.executeWithoutResult(status -> {
            routing.lockEstate(estateId);
            routing.lockClassificationLease(reportId, lease).ifPresent(write::accept);
        });
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
