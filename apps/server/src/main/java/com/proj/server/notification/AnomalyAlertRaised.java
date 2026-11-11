package com.proj.server.notification;

import java.util.UUID;

/** A new open unusual-readings alert, published inside the anomaly check's transaction. */
public record AnomalyAlertRaised(UUID notificationId, UUID estateId, UUID assetId) {}
