package com.proj.server.catalogue;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(requiredProperties = {"id", "manufacturerId", "category", "name"})
public record AssetModelResponse(UUID id, UUID manufacturerId, String category, String name) {}
