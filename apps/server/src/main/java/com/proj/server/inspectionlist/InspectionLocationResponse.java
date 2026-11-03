package com.proj.server.inspectionlist;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(requiredProperties = {"id", "name"})
public record InspectionLocationResponse(UUID id, String name) {}
