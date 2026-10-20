package com.proj.server.location;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"created", "skipped"})
public record AddFloorsResponse(
        @Schema(description = "The levels created, highest floor first")
        List<LocationResponse> created,

        @Schema(description = "Names of floors the block already had, highest first")
        List<String> skipped) {}
