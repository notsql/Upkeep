package com.proj.server.risk;

import java.time.LocalDate;
import java.util.UUID;

/** What the forecast needs from an asset: its category code and the unit currently installed. */
public record RiskAsset(String category, LocalDate installedOn, UUID manufacturerId, UUID modelId) {}
