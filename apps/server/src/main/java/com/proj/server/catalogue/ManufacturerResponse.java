package com.proj.server.catalogue;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(requiredProperties = {"id", "name"})
public record ManufacturerResponse(UUID id, String name) {}
