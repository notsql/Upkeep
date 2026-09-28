-- CreateTable
CREATE TABLE "AssetAssessment" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "condition" VARCHAR(30) NOT NULL,
    "assessedOn" DATE NOT NULL,
    "notes" VARCHAR(2000) NOT NULL,
    "recordedByUserId" VARCHAR(255) NOT NULL,
    "recordedByName" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetAssessment_estateId_idx" ON "AssetAssessment"("estateId");

-- CreateIndex
CREATE INDEX "AssetAssessment_assetId_assessedOn_createdAt_idx" ON "AssetAssessment"("assetId", "assessedOn", "createdAt");

-- AddForeignKey
ALTER TABLE "AssetAssessment" ADD CONSTRAINT "AssetAssessment_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetAssessment" ADD CONSTRAINT "AssetAssessment_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

