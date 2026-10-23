-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "reference" VARCHAR(70) NOT NULL,
    "description" VARCHAR(2500) NOT NULL,
    "locationId" UUID NOT NULL,
    "assetId" UUID,
    "category" VARCHAR(30) NOT NULL,
    "priority" VARCHAR(30) NOT NULL,
    "source" VARCHAR(30) NOT NULL,
    "sourceReportId" UUID,
    "sourceReference" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "createdByUserId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkOrder_estateId_createdAt_id_idx" ON "WorkOrder"("estateId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_estateId_reference_key" ON "WorkOrder"("estateId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "IssueReport_id_estateId_key" ON "IssueReport"("id", "estateId");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_locationId_estateId_fkey" FOREIGN KEY ("locationId", "estateId") REFERENCES "Location"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_sourceReportId_estateId_fkey" FOREIGN KEY ("sourceReportId", "estateId") REFERENCES "IssueReport"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
