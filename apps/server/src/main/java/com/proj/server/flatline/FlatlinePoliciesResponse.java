package com.proj.server.flatline;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

@Schema(requiredProperties = {"canManage", "estateActive", "policies"})
public record FlatlinePoliciesResponse(
        boolean canManage, boolean estateActive, List<FlatlinePolicyResponse> policies) {}
