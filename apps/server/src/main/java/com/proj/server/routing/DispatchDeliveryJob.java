package com.proj.server.routing;

import com.proj.server.resident.ResidentImageStore;
import com.proj.server.resident.ResidentReportException;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Emails pending work-order dispatches to their contractors. Delivery is at least once: a crash after the mail server accepts
 * a message but before SENT is recorded can repeat it.
 */
@Component
public class DispatchDeliveryJob {
    static final int MAX_ATTEMPTS = 5;
    private static final Duration LEASE = Duration.ofMinutes(3);
    private static final int BATCH = 20;
    private static final Logger log = LoggerFactory.getLogger(DispatchDeliveryJob.class);

    private final RoutingRepository routing;
    private final ObjectProvider<WorkOrderEmailSender> sender;
    private final ResidentImageStore images;
    private final TransactionTemplate transactions;
    private final Clock clock;

    /** The sender exists only when SMTP is configured (see MailConfig); without it every send fails. */
    public DispatchDeliveryJob(
            RoutingRepository routing,
            ObjectProvider<WorkOrderEmailSender> sender,
            ResidentImageStore images,
            TransactionTemplate transactions,
            Clock clock) {
        this.routing = routing;
        this.sender = sender;
        this.images = images;
        this.transactions = transactions;
        this.clock = clock;
    }

    @Scheduled(
            fixedDelayString = "${app.routing.poll-interval:PT15S}",
            initialDelayString = "${app.routing.initial-delay:PT30S}")
    public void run() {
        for (int i = 0; i < BATCH && deliverNext(); i++) {
            // Each call claims and settles one dispatch.
        }
    }

    /** Emails the next due dispatch; false when none is due. */
    public boolean deliverNext() {
        var now = now();
        var lease = now.plus(LEASE);
        var claimed = transactions.execute(status -> routing.claimDispatch(now, lease));
        if (claimed == null || claimed.isEmpty()) return false;
        var delivery = routing.delivery(claimed.get()).orElseThrow();
        var attempts = delivery.attempts() + 1;
        String failure = null;
        try {
            var mail = sender.getIfAvailable();
            if (mail == null) throw new WorkOrderSendException("MAIL_NOT_CONFIGURED", "No SMTP host is configured.");
            mail.send(email(delivery));
        } catch (WorkOrderSendException error) {
            failure = error.code();
        } catch (ResidentReportException error) {
            failure = "IMAGE_STORAGE";
        } catch (RuntimeException error) {
            failure = "UNEXPECTED";
        }
        var code = failure;
        if (code != null) log.warn("Sending work order {} failed: {}", delivery.id(), code);
        transactions.executeWithoutResult(status -> {
            if (!routing.lockDispatchLease(delivery.id(), lease)) return;
            if (code == null) routing.markSent(delivery.id(), attempts, now());
            else
                routing.sendFailed(
                        delivery.id(),
                        attempts >= MAX_ATTEMPTS ? DispatchStatus.FAILED : DispatchStatus.PENDING,
                        attempts,
                        now().plus(RoutingDecision.backoff(attempts)),
                        code);
        });
        return true;
    }

    private WorkOrderEmail email(RoutingRepository.Delivery delivery) {
        var source = routing.source(delivery.reportId()).orElseThrow();
        var photos = source.images().stream()
                .map(image -> new FaultClassifier.Image(images.read(image.key()), image.contentType()))
                .toList();
        return WorkOrderEmail.build(new WorkOrderEmail.Content(
                delivery.reference(),
                delivery.equipmentType(),
                delivery.name(),
                delivery.email(),
                source.estateName(),
                source.estateAddress(),
                source.locationLabel(),
                source.createdAt(),
                source.title(),
                source.description(),
                photos));
    }

    private OffsetDateTime now() {
        return OffsetDateTime.now(clock).truncatedTo(ChronoUnit.MICROS);
    }
}
