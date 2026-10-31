package com.proj.server.reading;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

@Schema(requiredProperties = {"id", "reference", "name", "retired"})
public record ReadingAssetOption(UUID id, String reference, String name, boolean retired) {}
