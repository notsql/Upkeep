package com.proj.server.estate;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class EstateUserService {
    private final EstateUserRepository repository;

    public EstateUserService(EstateUserRepository repository) {
        this.repository = repository;
    }

    public List<EstateUserResponse> list(String userId) {
        return repository.listForUser(userId);
    }

    public void add(String userId, UUID estateId) {
        if (!repository.estateExists(estateId)) {
            throw new EstateException(HttpStatus.NOT_FOUND, "Estate not found.");
        }
        repository.add(estateId, userId);
    }

    public void remove(String userId, UUID estateId) {
        repository.remove(estateId, userId);
    }
}
