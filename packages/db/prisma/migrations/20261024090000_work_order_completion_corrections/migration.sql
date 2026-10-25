-- AlterTable
ALTER TABLE "WorkOrderCompletion" ADD COLUMN     "editedAt" TIMESTAMPTZ(6),
ADD COLUMN     "editedByName" VARCHAR(255),
ADD COLUMN     "editedByUserId" VARCHAR(255);

-- CreateTable
CREATE TABLE "WorkOrderCompletionRevision" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "fromVersion" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "correctionReason" VARCHAR(500) NOT NULL,
    "changedByUserId" VARCHAR(255) NOT NULL,
    "changedByName" VARCHAR(255),
    "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "beforeOutcome" JSONB NOT NULL,
    "afterOutcome" JSONB NOT NULL,

    CONSTRAINT "WorkOrderCompletionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrderCompletionRevision_estateId_workOrderId_idx" ON "WorkOrderCompletionRevision"("estateId", "workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderCompletionRevision_workOrderId_version_key" ON "WorkOrderCompletionRevision"("workOrderId", "version");

-- AddForeignKey
ALTER TABLE "WorkOrderCompletionRevision" ADD CONSTRAINT "WorkOrderCompletionRevision_workOrderId_estateId_fkey" FOREIGN KEY ("workOrderId", "estateId") REFERENCES "WorkOrderCompletion"("workOrderId", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

