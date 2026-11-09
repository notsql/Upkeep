-- AlterTable
ALTER TABLE "InspectionCheck" ADD COLUMN     "assignedToName" VARCHAR(255),
ADD COLUMN     "assignedToUserId" VARCHAR(255);

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "inspectionResultId" UUID,
ADD COLUMN     "recipientUserId" VARCHAR(255);

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_idx" ON "Notification"("recipientUserId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_inspectionResultId_fkey" FOREIGN KEY ("inspectionResultId") REFERENCES "AssetInspectionResult"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
