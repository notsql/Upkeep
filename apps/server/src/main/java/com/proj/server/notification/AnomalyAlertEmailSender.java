package com.proj.server.notification;

import com.proj.server.estate.CouncilIdentity;
import com.proj.server.estate.CouncilRepository;
import com.proj.server.routing.EmailSender;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Emails the estate's owner and managers about a new unusual-readings alert, once it is committed and off the scoring
 * thread. Best effort: a failed lookup or send is logged and not retried; the in-app alert is the record.
 */
@Component
public class AnomalyAlertEmailSender {
    private static final Logger LOG = LoggerFactory.getLogger(AnomalyAlertEmailSender.class);

    private final ObjectProvider<EmailSender> mail;
    private final CouncilRepository council;
    private final CouncilIdentity identity;
    private final NotificationRepository notifications;
    private final TaskExecutor executor;
    private final String webOrigin;

    public AnomalyAlertEmailSender(
            ObjectProvider<EmailSender> mail,
            CouncilRepository council,
            CouncilIdentity identity,
            NotificationRepository notifications,
            @Qualifier("anomalyAlertEmailExecutor") TaskExecutor executor,
            @Value("${app.cors.allowed-origins}") List<String> allowedOrigins) {
        this.mail = mail;
        this.council = council;
        this.identity = identity;
        this.notifications = notifications;
        this.executor = executor;
        this.webOrigin = allowedOrigins.getFirst();
    }

    @TransactionalEventListener
    public void raised(AnomalyAlertRaised event) {
        var sender = mail.getIfAvailable();
        if (sender == null) {
            return;
        }
        executor.execute(() -> send(sender, event));
    }

    private void send(EmailSender sender, AnomalyAlertRaised event) {
        var names = notifications.alertNames(event.notificationId()).orElse(null);
        if (names == null) {
            LOG.warn("Unusual-readings alert {} is gone; no email sent.", event.notificationId());
            return;
        }
        var users =
                AnomalyAlertEmail.recipients(council.ownerUserId(event.estateId()), council.members(event.estateId()));
        var addresses = new HashSet<String>();
        for (var user : users) {
            var address = address(user, event);
            if (address == null || !addresses.add(address.toLowerCase(Locale.ROOT))) {
                continue;
            }
            try {
                sender.send(AnomalyAlertEmail.build(new AnomalyAlertEmail.Content(
                        address, names.assetName(), names.estateName(), webOrigin, event.estateId(), event.assetId())));
            } catch (RuntimeException failure) {
                LOG.warn(
                        "Could not email user {} about unusual-readings alert {}.",
                        user,
                        event.notificationId(),
                        failure);
            }
        }
        if (addresses.isEmpty()) {
            LOG.warn("No verified manager address for unusual-readings alert {}.", event.notificationId());
        }
    }

    /** The user's verified address, or null (logged) when it cannot be used. */
    private String address(String user, AnomalyAlertRaised event) {
        try {
            var person = identity.user(user);
            if (person == null || person.email() == null || person.email().isBlank() || !person.verified()) {
                LOG.warn(
                        "User {} has no verified email; skipped for unusual-readings alert {}.",
                        user,
                        event.notificationId());
                return null;
            }
            return person.email().strip();
        } catch (RuntimeException failure) {
            LOG.warn("Could not look up user {} for unusual-readings alert {}.", user, event.notificationId(), failure);
            return null;
        }
    }
}
