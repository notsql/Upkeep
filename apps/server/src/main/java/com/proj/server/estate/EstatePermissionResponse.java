package com.proj.server.estate;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"code", "label", "description", "requires"})
public record EstatePermissionResponse(
        EstatePermissionCode code, String label, String description, List<EstatePermissionCode> requires) {}
