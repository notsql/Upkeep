/*
  Warnings:

  - A unique constraint covering the columns `[sourceInspectionId]` on the table `WorkOrder` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "sourceInspectionId" UUID;

-- CreateTable
CREATE TABLE "AssetInspectionResult" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "locationPath" VARCHAR(650) NOT NULL,
    "outcome" VARCHAR(4) NOT NULL,
    "inspectedOn" DATE NOT NULL,
    "notes" VARCHAR(2000),
    "recordedByUserId" VARCHAR(255) NOT NULL,
    "recordedByName" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetInspectionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetInspectionPhoto" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "inspectionResultId" UUID NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "contentType" VARCHAR(50) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetInspectionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetInspectionResult_estateId_assetId_inspectedOn_createdA_idx" ON "AssetInspectionResult"("estateId", "assetId", "inspectedOn", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AssetInspectionResult_id_estateId_key" ON "AssetInspectionResult"("id", "estateId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetInspectionPhoto_storageKey_key" ON "AssetInspectionPhoto"("storageKey");

-- CreateIndex
CREATE INDEX "AssetInspectionPhoto_estateId_inspectionResultId_idx" ON "AssetInspectionPhoto"("estateId", "inspectionResultId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_sourceInspectionId_key" ON "WorkOrder"("sourceInspectionId");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_sourceInspectionId_estateId_fkey" FOREIGN KEY ("sourceInspectionId", "estateId") REFERENCES "AssetInspectionResult"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetInspectionResult" ADD CONSTRAINT "AssetInspectionResult_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetInspectionResult" ADD CONSTRAINT "AssetInspectionResult_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetInspectionResult" ADD CONSTRAINT "AssetInspectionResult_locationId_estateId_fkey" FOREIGN KEY ("locationId", "estateId") REFERENCES "Location"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetInspectionPhoto" ADD CONSTRAINT "AssetInspectionPhoto_inspectionResultId_estateId_fkey" FOREIGN KEY ("inspectionResultId", "estateId") REFERENCES "AssetInspectionResult"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
