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

    public List<EstateResponse> list(String owner, EstateStatus status) {
        return repository.listOwned(owner, status);
    }

    public EstateResponse get(UUID id, String owner) {
        return owned(id, owner, false);
    }

    public EstateResponse create(String owner, EstateRequest request) {
        return repository.create(owner, request);
    }

    @Transactional
    public EstateResponse update(UUID id, String owner, EstateRequest request) {
        owned(id, owner, true);
        return repository.update(id, owner, request);
    }

    @Transactional
    public EstateResponse deactivate(UUID id, String owner, String code) {
        var estate = owned(id, owner, true);
        if (!estate.code().equals(code)) {
            throw new EstateException(HttpStatus.BAD_REQUEST, "Enter the estate code exactly to confirm deactivation.");
        }
        if (estate.deactivatedAt() != null) {
            return estate;
        }
        return repository.deactivate(id, owner);
    }

    private EstateResponse owned(UUID id, String owner, boolean lock) {
        return repository
                .findOwned(id, owner, lock)
                .orElseThrow(() -> new EstateException(HttpStatus.NOT_FOUND, "Estate not found."));
    }
}
