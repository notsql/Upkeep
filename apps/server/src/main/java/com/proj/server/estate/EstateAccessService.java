package com.proj.server.estate;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class EstateAccessService {
    private final EstateAccessRepository repository;

    public EstateAccessService(EstateAccessRepository repository) {
        this.repository = repository;
    }

    public List<EstateAccessResponse> list(String userId) {
        return repository.listForUser(userId);
    }

    public void grant(String userId, UUID estateId) {
        if (!repository.estateExists(estateId)) {
            throw new EstateException(HttpStatus.NOT_FOUND, "Estate not found.");
        }
        repository.grant(estateId, userId);
    }

    public void revoke(String userId, UUID estateId) {
        repository.revoke(estateId, userId);
    }
}
