-- CreateTable
CREATE TABLE "ReadingImportBatch" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "submissionId" UUID NOT NULL,
    "sourceLabel" VARCHAR(200) NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "fileHash" VARCHAR(64) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "mapping" JSONB NOT NULL,
    "parserVersion" VARCHAR(30) NOT NULL,
    "uploaderUserId" VARCHAR(255) NOT NULL,
    "uploaderName" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    "totalRows" INTEGER NOT NULL,
    "importedRows" INTEGER NOT NULL,
    "duplicateRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "warningRows" INTEGER NOT NULL,
    "rollbackUserId" VARCHAR(255),
    "rollbackAt" TIMESTAMPTZ(6),
    "rollbackReason" VARCHAR(2000),
    "removedCount" INTEGER,

    CONSTRAINT "ReadingImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportedReading" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "metric" VARCHAR(30) NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "measuredAt" TIMESTAMPTZ(6) NOT NULL,
    "recordedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ImportedReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingImportRow" (
    "batchId" UUID NOT NULL,
    "recordNumber" INTEGER NOT NULL,
    "startingLineNumber" INTEGER NOT NULL,
    "outcome" VARCHAR(20) NOT NULL,
    "readingId" UUID,
    "source" VARCHAR(20),
    "assetId" UUID,
    "metric" VARCHAR(30),
    "measuredAt" TIMESTAMPTZ(6),
    "valueText" VARCHAR(32),
    "origin" JSONB,
    "issues" JSONB NOT NULL,

    CONSTRAINT "ReadingImportRow_pkey" PRIMARY KEY ("batchId","recordNumber")
);

-- CreateIndex
CREATE INDEX "ReadingImportBatch_estateId_createdAt_idx" ON "ReadingImportBatch"("estateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingImportBatch_id_estateId_key" ON "ReadingImportBatch"("id", "estateId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingImportBatch_estateId_uploaderUserId_submissionId_key" ON "ReadingImportBatch"("estateId", "uploaderUserId", "submissionId");

-- CreateIndex
CREATE INDEX "ImportedReading_assetId_metric_measuredAt_idx" ON "ImportedReading"("assetId", "metric", "measuredAt");

-- CreateIndex
CREATE INDEX "ImportedReading_batchId_idx" ON "ImportedReading"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportedReading_estateId_assetId_metric_measuredAt_key" ON "ImportedReading"("estateId", "assetId", "metric", "measuredAt");

-- CreateIndex
CREATE INDEX "ReadingImportRow_batchId_outcome_recordNumber_idx" ON "ReadingImportRow"("batchId", "outcome", "recordNumber");

-- AddForeignKey
ALTER TABLE "ReadingImportBatch" ADD CONSTRAINT "ReadingImportBatch_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ImportedReading" ADD CONSTRAINT "ImportedReading_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ImportedReading" ADD CONSTRAINT "ImportedReading_batchId_estateId_fkey" FOREIGN KEY ("batchId", "estateId") REFERENCES "ReadingImportBatch"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ReadingImportRow" ADD CONSTRAINT "ReadingImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ReadingImportBatch"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
