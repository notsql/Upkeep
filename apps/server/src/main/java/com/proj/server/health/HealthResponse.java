package com.proj.server.health;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/** API liveness plus whether the database answered a trivial query. */
@Schema(requiredProperties = {"ok", "database", "timestamp"})
public record HealthResponse(boolean ok, boolean database, Instant timestamp) {}
