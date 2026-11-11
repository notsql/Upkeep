-- AlterTable
ALTER TABLE "EstateNotificationSettings" ADD COLUMN     "anomalyEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "checkFailedEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "checkRequestedEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "repairPredictedEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "serviceDueEnabled" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "anomalyScoreThreshold" DROP NOT NULL,
ALTER COLUMN "serviceLeadDays" DROP NOT NULL,
ALTER COLUMN "repairLeadDays" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "milestoneDays" INTEGER;

-- CreateIndex
CREATE INDEX "Notification_assetId_type_milestoneDays_idx" ON "Notification"("assetId", "type", "milestoneDays");

-- Milestones are 90, 60, 30, 14 for SERVICE_DUE and 90, 60, 30 for REPAIR_PREDICTED; null for every other type.
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_milestoneDays_check" CHECK (
  "milestoneDays" IS NULL
  OR ("type" = 'SERVICE_DUE' AND "milestoneDays" IN (90, 60, 30, 14))
  OR ("type" = 'REPAIR_PREDICTED' AND "milestoneDays" IN (90, 60, 30))
);
