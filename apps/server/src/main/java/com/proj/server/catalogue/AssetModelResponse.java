package com.proj.server.catalogue;

import java.util.UUID;

public record AssetModelResponse(UUID id, UUID manufacturerId, String category, String name) {}
