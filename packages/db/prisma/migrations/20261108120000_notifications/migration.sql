-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "type" VARCHAR(16) NOT NULL,
    "summary" VARCHAR(300) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(6),
    "condition" VARCHAR(15),
    "medianScore" DECIMAL(5,4),
    "maxScore" DECIMAL(5,4),
    "firstDetectedAt" TIMESTAMPTZ(6),
    "lastDetectedAt" TIMESTAMPTZ(6),
    "explanation" VARCHAR(500),
    "response" VARCHAR(12),
    "respondedByUserId" VARCHAR(255),
    "respondedByName" VARCHAR(255),
    "respondedAt" TIMESTAMPTZ(6),
    "responseReason" VARCHAR(500),
    "dueOn" DATE,
    "intervalValue" INTEGER,
    "intervalUnit" VARCHAR(5),
    "intervalSource" VARCHAR(8),
    "recommendedTimeframe" VARCHAR(14),
    "probability" DECIMAL(5,4),
    "basis" VARCHAR(17),
    "failuresObserved" INTEGER,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRead" (
    "notificationId" UUID NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "readAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("notificationId","userId")
);

-- CreateTable
CREATE TABLE "EstateNotificationSettings" (
    "estateId" UUID NOT NULL,
    "anomalyScoreThreshold" DECIMAL(3,2) NOT NULL,
    "serviceLeadDays" INTEGER NOT NULL,
    "repairLeadDays" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedByUserId" VARCHAR(255) NOT NULL,

    CONSTRAINT "EstateNotificationSettings_pkey" PRIMARY KEY ("estateId")
);

-- CreateTable
CREATE TABLE "NotificationSweep" (
    "estateId" UUID NOT NULL,
    "day" DATE NOT NULL,
    "sweptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationSweep_pkey" PRIMARY KEY ("estateId","day")
);

-- CreateIndex
CREATE INDEX "Notification_estateId_createdAt_id_idx" ON "Notification"("estateId", "createdAt" DESC, "id");

-- CreateIndex
CREATE INDEX "Notification_assetId_type_createdAt_idx" ON "Notification"("assetId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationRead_userId_idx" ON "NotificationRead"("userId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EstateNotificationSettings" ADD CONSTRAINT "EstateNotificationSettings_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "NotificationSweep" ADD CONSTRAINT "NotificationSweep_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;



-- At most one open notification per asset and type (spec notifications.md, Decision 4).
CREATE UNIQUE INDEX "Notification_one_open_per_asset_type" ON "Notification"("assetId", "type") WHERE "resolvedAt" IS NULL;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_type_check" CHECK ("type" IN ('ANOMALY', 'SERVICE_DUE', 'REPAIR_PREDICTED')),
  ADD CONSTRAINT "Notification_anomaly_check" CHECK (
    ("type" = 'ANOMALY') = ("condition" IS NOT NULL)
    AND ("type" <> 'ANOMALY' OR (
      "condition" IN ('NEEDS_ATTENTION', 'FAULTY')
      AND "medianScore" BETWEEN 0 AND 1
      AND "maxScore" BETWEEN 0 AND 1
      AND "firstDetectedAt" IS NOT NULL
      AND "lastDetectedAt" IS NOT NULL
      AND "explanation" IS NOT NULL
      AND "response" IN ('NONE', 'ACKNOWLEDGED', 'DISMISSED')
      AND ("response" = 'NONE') = ("respondedAt" IS NULL)
      AND ("respondedAt" IS NULL) = ("respondedByUserId" IS NULL)
      AND ("response" <> 'DISMISSED' OR length(btrim("responseReason")) > 0)
    ))
  ),
  ADD CONSTRAINT "Notification_service_due_check" CHECK (
    ("type" = 'SERVICE_DUE') = ("dueOn" IS NOT NULL)
    AND ("type" <> 'SERVICE_DUE' OR (
      "intervalSource" IN ('ASSET', 'CATEGORY') AND (
        ("intervalUnit" = 'DAY' AND "intervalValue" BETWEEN 1 AND 3650)
        OR ("intervalUnit" = 'MONTH' AND "intervalValue" BETWEEN 1 AND 120)
        OR ("intervalUnit" = 'YEAR' AND "intervalValue" BETWEEN 1 AND 10)
      )
    ))
  ),
  ADD CONSTRAINT "Notification_repair_predicted_check" CHECK (
    ("type" = 'REPAIR_PREDICTED') = ("recommendedTimeframe" IS NOT NULL)
    AND ("type" <> 'REPAIR_PREDICTED' OR (
      "recommendedTimeframe" IN ('WITHIN_30_DAYS', 'WITHIN_60_DAYS', 'WITHIN_90_DAYS')
      AND "probability" BETWEEN 0 AND 1
      AND "basis" IN ('SERVICE_INTERVAL', 'ASSET_HISTORY')
      AND "failuresObserved" >= 0
    ))
  ),
  ADD CONSTRAINT "Notification_resolved_check" CHECK ("resolvedAt" IS NULL OR "resolvedAt" >= "createdAt");

ALTER TABLE "EstateNotificationSettings"
  ADD CONSTRAINT "EstateNotificationSettings_threshold_check" CHECK ("anomalyScoreThreshold" BETWEEN 0.51 AND 1.00),
  ADD CONSTRAINT "EstateNotificationSettings_service_lead_check" CHECK ("serviceLeadDays" BETWEEN 0 AND 365),
  ADD CONSTRAINT "EstateNotificationSettings_repair_lead_check" CHECK ("repairLeadDays" IN (30, 60, 90));
