package com.proj.server.risk;

import com.proj.server.event.AssetEventType;
import java.time.LocalDate;
import java.util.UUID;

/** What the forecast needs from an event: its type, date and the unit snapshot taken when recorded. */
public record RiskEvent(AssetEventType type, LocalDate occurredOn, UUID manufacturerId, UUID modelId) {}
