-- CreateTable
CREATE TABLE "ResidentAssignment" (
    "userId" VARCHAR(255) NOT NULL,
    "estateId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ResidentAssignment_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "IssueReport" (
    "id" UUID NOT NULL,
    "submittedByUserId" VARCHAR(255) NOT NULL,
    "estateId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "description" VARCHAR(2500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "IssueReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueReportImage" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "contentType" VARCHAR(50) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueReportImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResidentAssignment_estateId_idx" ON "ResidentAssignment"("estateId");

-- CreateIndex
CREATE INDEX "IssueReport_submittedByUserId_createdAt_id_idx" ON "IssueReport"("submittedByUserId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "IssueReport_estateId_idx" ON "IssueReport"("estateId");

-- CreateIndex
CREATE UNIQUE INDEX "IssueReportImage_storageKey_key" ON "IssueReportImage"("storageKey");

-- CreateIndex
CREATE INDEX "IssueReportImage_reportId_idx" ON "IssueReportImage"("reportId");

-- AddForeignKey
ALTER TABLE "ResidentAssignment" ADD CONSTRAINT "ResidentAssignment_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "IssueReport" ADD CONSTRAINT "IssueReport_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "IssueReport" ADD CONSTRAINT "IssueReport_locationId_estateId_fkey" FOREIGN KEY ("locationId", "estateId") REFERENCES "Location"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "IssueReportImage" ADD CONSTRAINT "IssueReportImage_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IssueReport"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
