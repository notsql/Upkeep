-- CreateTable
CREATE TABLE "ManualReading" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "metric" VARCHAR(30) NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "measuredAt" TIMESTAMPTZ(6) NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "recordedByName" VARCHAR(200),
    "submissionId" UUID NOT NULL,

    CONSTRAINT "ManualReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualReading_assetId_metric_measuredAt_idx" ON "ManualReading"("assetId", "metric", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManualReading_estateId_recordedByUserId_submissionId_key" ON "ManualReading"("estateId", "recordedByUserId", "submissionId");

-- AddForeignKey
ALTER TABLE "ManualReading" ADD CONSTRAINT "ManualReading_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
