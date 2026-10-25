-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WorkOrderStatusEvent" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "fromStatus" VARCHAR(20),
    "toStatus" VARCHAR(20) NOT NULL,
    "changedByUserId" VARCHAR(255) NOT NULL,
    "changedByName" VARCHAR(255),
    "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL,

    CONSTRAINT "WorkOrderStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderCompletion" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "findings" VARCHAR(2500) NOT NULL,
    "workPerformed" VARCHAR(2500) NOT NULL,
    "partsUsed" VARCHAR(2500),
    "labourCost" DECIMAL(14,2),
    "partsCost" DECIMAL(14,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'SGD',
    "downtimeMinutes" INTEGER,
    "completedByUserId" VARCHAR(255) NOT NULL,
    "completedByName" VARCHAR(255),
    "completedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrderStatusEvent_estateId_workOrderId_idx" ON "WorkOrderStatusEvent"("estateId", "workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderStatusEvent_workOrderId_version_key" ON "WorkOrderStatusEvent"("workOrderId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderCompletion_workOrderId_key" ON "WorkOrderCompletion"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderCompletion_estateId_completedAt_id_idx" ON "WorkOrderCompletion"("estateId", "completedAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderCompletion_workOrderId_estateId_key" ON "WorkOrderCompletion"("workOrderId", "estateId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_id_estateId_key" ON "WorkOrder"("id", "estateId");

-- AddForeignKey
ALTER TABLE "WorkOrderStatusEvent" ADD CONSTRAINT "WorkOrderStatusEvent_workOrderId_estateId_fkey" FOREIGN KEY ("workOrderId", "estateId") REFERENCES "WorkOrder"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "WorkOrderCompletion" ADD CONSTRAINT "WorkOrderCompletion_workOrderId_estateId_fkey" FOREIGN KEY ("workOrderId", "estateId") REFERENCES "WorkOrder"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
