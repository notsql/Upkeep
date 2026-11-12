package com.proj.server.routing;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"contractors"})
public record ContractorDirectoryResponse(List<ContractorResponse> contractors) {}
