/*
  Warnings:

  - A unique constraint covering the columns `[id,estateId]` on the table `Document` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "workOrderAssociationVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "workOrderId" UUID;

-- CreateTable
CREATE TABLE "DocumentWorkOrderEvent" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "fromWorkOrderId" UUID,
    "toWorkOrderId" UUID,
    "associationVersion" INTEGER NOT NULL,
    "correctionReason" VARCHAR(500),
    "changedByUserId" VARCHAR(255) NOT NULL,
    "changedByName" VARCHAR(255),
    "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentWorkOrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentWorkOrderEvent_estateId_documentId_associationVersi_idx" ON "DocumentWorkOrderEvent"("estateId", "documentId", "associationVersion");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentWorkOrderEvent_documentId_associationVersion_key" ON "DocumentWorkOrderEvent"("documentId", "associationVersion");

-- CreateIndex
CREATE INDEX "Document_estateId_workOrderId_createdAt_id_idx" ON "Document"("estateId", "workOrderId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Document_id_estateId_key" ON "Document"("id", "estateId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_workOrderId_estateId_fkey" FOREIGN KEY ("workOrderId", "estateId") REFERENCES "WorkOrder"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DocumentWorkOrderEvent" ADD CONSTRAINT "DocumentWorkOrderEvent_documentId_estateId_fkey" FOREIGN KEY ("documentId", "estateId") REFERENCES "Document"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DocumentWorkOrderEvent" ADD CONSTRAINT "DocumentWorkOrderEvent_fromWorkOrderId_estateId_fkey" FOREIGN KEY ("fromWorkOrderId", "estateId") REFERENCES "WorkOrder"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DocumentWorkOrderEvent" ADD CONSTRAINT "DocumentWorkOrderEvent_toWorkOrderId_estateId_fkey" FOREIGN KEY ("toWorkOrderId", "estateId") REFERENCES "WorkOrder"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Prisma cannot express these domain checks; apply them with its migration.
ALTER TABLE "Document" ADD CONSTRAINT "Document_association_version_check"
  CHECK ("workOrderAssociationVersion" >= 0);
ALTER TABLE "DocumentWorkOrderEvent"
  ADD CONSTRAINT "DocumentWorkOrderEvent_version_check" CHECK ("associationVersion" > 0),
  ADD CONSTRAINT "DocumentWorkOrderEvent_target_check" CHECK ("fromWorkOrderId" IS DISTINCT FROM "toWorkOrderId"),
  ADD CONSTRAINT "DocumentWorkOrderEvent_reason_check"
    CHECK ("fromWorkOrderId" IS NULL OR ("correctionReason" IS NOT NULL AND length(trim("correctionReason")) > 0));
