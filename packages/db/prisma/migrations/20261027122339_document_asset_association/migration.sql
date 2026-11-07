-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "assetAssociationChangedAt" TIMESTAMPTZ(6),
ADD COLUMN     "assetAssociationChangedByUserId" VARCHAR(255),
ADD COLUMN     "assetAssociationVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "assetId" UUID;

-- CreateIndex
CREATE INDEX "Document_estateId_assetId_createdAt_id_idx" ON "Document"("estateId", "assetId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
