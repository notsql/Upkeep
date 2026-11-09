-- CreateTable
CREATE TABLE "AnomalyScore" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "measuredAt" TIMESTAMPTZ(6) NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "scoredAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AnomalyScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnomalyScore_assetId_measuredAt_key" ON "AnomalyScore"("assetId", "measuredAt");

-- AddForeignKey
ALTER TABLE "AnomalyScore" ADD CONSTRAINT "AnomalyScore_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
