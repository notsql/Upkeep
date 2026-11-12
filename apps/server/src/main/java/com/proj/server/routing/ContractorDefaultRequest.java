package com.proj.server.routing;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

@Schema(requiredProperties = {"contractorId"})
public record ContractorDefaultRequest(@NotNull UUID contractorId) {}
