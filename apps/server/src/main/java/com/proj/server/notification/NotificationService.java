package com.proj.server.notification;

import com.proj.server.asset.AssetRepository;
import com.proj.server.estate.EstateRepository;
import com.proj.server.workos.WorkOSService;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The caller's in-app inbox (ID-100) and responses to anomaly alerts (ID-107), spec notifications.md. */
@Service
public class NotificationService {
    static final int DEFAULT_SIZE = 20;
    static final int MAX_SIZE = 100;
    static final int MAX_REASON = 500;

    private final NotificationRepository repository;
    private final EstateRepository estates;
    private final AssetRepository assets;
    private final WorkOSService workOS;
    private final NotificationSweeper sweeper;

    public NotificationService(
            NotificationRepository repository,
            EstateRepository estates,
            AssetRepository assets,
            WorkOSService workOS,
            NotificationSweeper sweeper) {
        this.repository = repository;
        this.estates = estates;
        this.assets = assets;
        this.workOS = workOS;
        this.sweeper = sweeper;
    }

    @Transactional
    public NotificationCountResponse unread(String user) {
        sweeper.sweep(user);
        return new NotificationCountResponse(repository.unread(user));
    }

    @Transactional
    public NotificationPageResponse list(String user, int page, int size) {
        if (page < 0) {
            throw new NotificationException(HttpStatus.BAD_REQUEST, "page: must be 0 or more.");
        }
        if (size < 1 || size > MAX_SIZE) {
            throw new NotificationException(HttpStatus.BAD_REQUEST, "size: must be from 1 to " + MAX_SIZE + ".");
        }
        sweeper.sweep(user);
        return new NotificationPageResponse(repository.page(user, page, size), page, size, repository.total(user));
    }

    @Transactional
    public void read(UUID id, String user) {
        if (!repository.visible(id, user)) {
            throw new NotificationException(HttpStatus.NOT_FOUND, "Notification not found.");
        }
        repository.markRead(id, user);
    }

    @Transactional
    public NotificationCountResponse readAll(String user) {
        repository.markAllRead(user);
        return new NotificationCountResponse(repository.unread(user));
    }

    @Transactional
    public NotificationResponse acknowledge(UUID id, String user, AcknowledgeAlertRequest request) {
        var reason = trimmed(request == null ? null : request.reason());
        return respond(id, user, AlertResponse.ACKNOWLEDGED, reason);
    }

    @Transactional
    public NotificationResponse dismiss(UUID id, String user, DismissAlertRequest request) {
        var reason = trimmed(request == null ? null : request.reason());
        if (reason == null) {
            throw new NotificationException(HttpStatus.BAD_REQUEST, "Enter a reason for dismissing this alert.");
        }
        return respond(id, user, AlertResponse.DISMISSED, reason);
    }

    @Transactional
    public List<NotificationResponse> assetAlerts(UUID estateId, UUID assetId, String user) {
        estates.findManaged(estateId, user)
                .orElseThrow(() -> new NotificationException(HttpStatus.NOT_FOUND, "Estate not found."));
        assets.find(assetId, estateId, false)
                .orElseThrow(() -> new NotificationException(HttpStatus.NOT_FOUND, "Asset not found."));
        return repository.anomalyAlerts(assetId, user);
    }

    private NotificationResponse respond(UUID id, String user, AlertResponse response, String reason) {
        if (reason != null && reason.length() > MAX_REASON) {
            throw new NotificationException(
                    HttpStatus.BAD_REQUEST, "reason: must be at most " + MAX_REASON + " characters.");
        }
        var target = repository
                .lockForResponse(id, user)
                .orElseThrow(() -> new NotificationException(HttpStatus.NOT_FOUND, "Notification not found."));
        if (target.type() != NotificationType.ANOMALY) {
            throw new NotificationException(
                    HttpStatus.CONFLICT, "Only anomaly alerts can be acknowledged or dismissed.");
        }
        if (target.response() == AlertResponse.DISMISSED) {
            throw new NotificationException(HttpStatus.CONFLICT, "This alert has already been dismissed.");
        }
        if (target.estateInactive()) {
            throw new NotificationException(
                    HttpStatus.CONFLICT, "This estate is inactive. Its alerts cannot be changed.");
        }
        if (target.assetRetired()) {
            throw new NotificationException(
                    HttpStatus.CONFLICT, "This asset is retired. Its alerts cannot be changed.");
        }
        repository.respond(id, response, user, workOS.findDisplayName(user).orElse(null), reason);
        repository.markRead(id, user);
        return repository.one(id, user).orElseThrow();
    }

    private static String trimmed(String reason) {
        if (reason == null || reason.isBlank()) {
            return null;
        }
        return reason.strip();
    }
}
