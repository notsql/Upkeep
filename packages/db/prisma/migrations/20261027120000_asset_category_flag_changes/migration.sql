-- CreateTable
CREATE TABLE "AssetCategoryFlagChange" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "failsSilently" BOOLEAN NOT NULL,
    "changedByUserId" VARCHAR(255) NOT NULL,
    "changedByName" VARCHAR(255),
    "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetCategoryFlagChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetCategoryFlagChange_estateId_category_changedAt_idx" ON "AssetCategoryFlagChange"("estateId", "category", "changedAt");

-- AddForeignKey
ALTER TABLE "AssetCategoryFlagChange" ADD CONSTRAINT "AssetCategoryFlagChange_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetCategoryFlagChange" ADD CONSTRAINT "AssetCategoryFlagChange_category_fkey" FOREIGN KEY ("category") REFERENCES "AssetCategory"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;
