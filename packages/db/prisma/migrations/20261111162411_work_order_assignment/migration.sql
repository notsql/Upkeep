-- DropIndex
DROP INDEX "WorkOrderDispatch_workOrderId_estateId_key";

-- DropIndex
DROP INDEX "WorkOrderDispatch_workOrderId_key";

-- AlterTable
ALTER TABLE "EstateNotificationSettings" ADD COLUMN     "workOrderAssignedEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "workOrderId" UUID,
ALTER COLUMN "assetId" DROP NOT NULL,
ALTER COLUMN "type" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "assignedAt" TIMESTAMPTZ(6),
ADD COLUMN     "assignedByUserId" VARCHAR(255),
ADD COLUMN     "assigneeName" VARCHAR(255),
ADD COLUMN     "assigneeProviderId" UUID,
ADD COLUMN     "assigneeUserId" VARCHAR(255);

-- AlterTable
ALTER TABLE "WorkOrderDispatch" ALTER COLUMN "providerId" DROP NOT NULL,
ALTER COLUMN "equipmentType" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkOrderStatusEvent" ADD COLUMN     "assigneeName" VARCHAR(255),
ADD COLUMN     "kind" VARCHAR(20) NOT NULL DEFAULT 'STATUS';

-- CreateIndex
CREATE INDEX "WorkOrder_estateId_assigneeUserId_idx" ON "WorkOrder"("estateId", "assigneeUserId");

-- CreateIndex
CREATE INDEX "WorkOrderDispatch_estateId_workOrderId_createdAt_idx" ON "WorkOrderDispatch"("estateId", "workOrderId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assigneeProviderId_estateId_fkey" FOREIGN KEY ("assigneeProviderId", "estateId") REFERENCES "ServiceProvider"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workOrderId_estateId_fkey" FOREIGN KEY ("workOrderId", "estateId") REFERENCES "WorkOrder"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Backfill (work-order-assignment.md): open orders a contractor was already emailed about name that contractor.
UPDATE "WorkOrder" w
SET "assigneeProviderId" = d."providerId",
    "assigneeName" = d."contractorName",
    "assignedAt" = d."createdAt",
    "assignedByUserId" = d."approvedByUserId"
FROM "WorkOrderDispatch" d
WHERE d."workOrderId" = w."id"
  AND d."estateId" = w."estateId"
  AND w."status" IN ('ASSIGNED', 'IN_PROGRESS');

-- An assignee is a member or a contractor, never both; the name and time are set exactly when one is.
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assignee_check" CHECK (
  NOT ("assigneeUserId" IS NOT NULL AND "assigneeProviderId" IS NOT NULL)
  AND (("assigneeUserId" IS NOT NULL OR "assigneeProviderId" IS NOT NULL) = ("assigneeName" IS NOT NULL))
  AND (("assigneeUserId" IS NOT NULL OR "assigneeProviderId" IS NOT NULL) = ("assignedAt" IS NOT NULL))
);

ALTER TABLE "WorkOrderStatusEvent" ADD CONSTRAINT "WorkOrderStatusEvent_kind_check" CHECK ("kind" IN ('STATUS', 'ASSIGNED', 'UNASSIGNED'));

ALTER TABLE "Notification"
  DROP CONSTRAINT "Notification_type_check",
  ADD CONSTRAINT "Notification_type_check" CHECK ("type" IN ('ANOMALY', 'SERVICE_DUE', 'REPAIR_PREDICTED', 'CHECK_REQUESTED', 'CHECK_FAILED', 'WORK_ORDER_ASSIGNED')),
  DROP CONSTRAINT "Notification_check_requested_check",
  ADD CONSTRAINT "Notification_check_requested_check" CHECK (("type" IN ('CHECK_REQUESTED', 'WORK_ORDER_ASSIGNED')) = ("recipientUserId" IS NOT NULL)),
  ADD CONSTRAINT "Notification_work_order_check" CHECK (("type" = 'WORK_ORDER_ASSIGNED') = ("workOrderId" IS NOT NULL)),
  ADD CONSTRAINT "Notification_asset_check" CHECK ("assetId" IS NOT NULL OR "type" = 'WORK_ORDER_ASSIGNED');
