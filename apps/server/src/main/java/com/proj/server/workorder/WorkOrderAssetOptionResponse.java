package com.proj.server.workorder;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(requiredProperties = {"id", "reference", "name", "locationId", "locationPath"})
public record WorkOrderAssetOptionResponse(
        UUID id, String reference, String name, UUID locationId, String locationPath) {}
