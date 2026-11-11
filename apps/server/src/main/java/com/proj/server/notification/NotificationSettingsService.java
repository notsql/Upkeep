package com.proj.server.notification;

import com.proj.server.estate.EstateRepository;
import com.proj.server.estate.EstateResponse;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Per-estate notification switches, editable by the estate's managers. */
@Service
public class NotificationSettingsService {
    private final EstateRepository estates;
    private final NotificationSettingsRepository repository;

    public NotificationSettingsService(EstateRepository estates, NotificationSettingsRepository repository) {
        this.estates = estates;
        this.repository = repository;
    }

    /** The estate's settings, or the defaults. No access check: for server-side callers. */
    public NotificationSettings forEstate(UUID estateId) {
        return repository.find(estateId);
    }

    @Transactional
    public NotificationSettingsResponse get(UUID estateId, String user) {
        managed(estateId, user);
        return NotificationSettingsResponse.of(repository.find(estateId));
    }

    @Transactional
    public NotificationSettingsResponse save(UUID estateId, NotificationSettingsRequest request, String user) {
        var estate = managed(estateId, user);
        if (estate.deactivatedAt() != null) {
            throw new NotificationException(
                    HttpStatus.CONFLICT, "This estate is inactive. Its notification settings cannot be changed.");
        }
        var settings = request.settings();
        repository.save(estateId, settings, user);
        repository.forgetSweep(estateId, NotificationDays.today());
        return NotificationSettingsResponse.of(settings);
    }

    private EstateResponse managed(UUID estateId, String user) {
        return estates.findManaged(estateId, user)
                .orElseThrow(() -> new NotificationException(HttpStatus.NOT_FOUND, "Estate not found."));
    }
}
