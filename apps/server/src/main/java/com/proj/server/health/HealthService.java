package com.proj.server.health;

import java.time.Instant;
import org.jooq.DSLContext;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

@Service
public class HealthService {

    private final DSLContext dsl;

    public HealthService(DSLContext dsl) {
        this.dsl = dsl;
    }

    public HealthResponse check() {
        return new HealthResponse(true, databaseReachable(), Instant.now());
    }

    private boolean databaseReachable() {
        try {
            dsl.selectOne().fetch();
            return true;
        } catch (DataAccessException | org.jooq.exception.DataAccessException e) {
            return false;
        }
    }
}
