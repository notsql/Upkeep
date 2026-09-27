package com.proj.server.estate;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EstateService {
    private final EstateRepository repository;

    public EstateService(EstateRepository repository) {
        this.repository = repository;
    }

    public List<EstateResponse> list(String user, EstateStatus status) {
        return repository.listAccessible(user, status);
    }

    public EstateResponse get(UUID id, String user) {
        return repository.findAccessible(id, user).orElseThrow(EstateService::notFound);
    }

    public EstateResponse create(String owner, EstateRequest request) {
        return repository.create(owner, request);
    }

    @Transactional
    public EstateResponse update(UUID id, String owner, EstateRequest request) {
        owned(id, owner);
        return repository.update(id, owner, request);
    }

    @Transactional
    public EstateResponse deactivate(UUID id, String owner, String code) {
        var estate = owned(id, owner);
        if (!estate.code().equals(code)) {
            throw new EstateException(HttpStatus.BAD_REQUEST, "Enter the estate code exactly to confirm deactivation.");
        }
        if (estate.deactivatedAt() != null) {
            return estate;
        }
        return repository.deactivate(id, owner);
    }

    // Granted users can see an estate but not change it; hiding it would protect nothing.
    private EstateResponse owned(UUID id, String user) {
        return repository
                .findOwned(id, user, true)
                .orElseThrow(() -> repository.findAccessible(id, user).isPresent()
                        ? new EstateException(HttpStatus.FORBIDDEN, "Only the estate owner can change it.")
                        : notFound());
    }

    private static EstateException notFound() {
        return new EstateException(HttpStatus.NOT_FOUND, "Estate not found.");
    }
}
