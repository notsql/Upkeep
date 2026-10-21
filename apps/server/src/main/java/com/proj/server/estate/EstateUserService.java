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
        throw new EstateException(HttpStatus.FORBIDDEN, "Use estate-scoped member management.");
    }

    public void add(String userId, UUID estateId) {
        throw new EstateException(HttpStatus.FORBIDDEN, "Join an estate through an invitation.");
    }

    public void remove(String userId, UUID estateId) {
        throw new EstateException(HttpStatus.FORBIDDEN, "Use estate-scoped member management.");
    }
}
