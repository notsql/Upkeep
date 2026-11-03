-- CreateTable
CREATE TABLE "AssetCategoryIntervalChange" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "intervalValue" INTEGER,
    "intervalUnit" VARCHAR(5),
    "changedByUserId" VARCHAR(255) NOT NULL,
    "changedByName" VARCHAR(255),
    "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetCategoryIntervalChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetIntervalChange" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "intervalValue" INTEGER,
    "intervalUnit" VARCHAR(5),
    "changedByUserId" VARCHAR(255) NOT NULL,
    "changedByName" VARCHAR(255),
    "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetIntervalChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetCategoryIntervalChange_estateId_category_changedAt_idx" ON "AssetCategoryIntervalChange"("estateId", "category", "changedAt");

-- CreateIndex
CREATE INDEX "AssetIntervalChange_assetId_changedAt_idx" ON "AssetIntervalChange"("assetId", "changedAt");

-- AddForeignKey
ALTER TABLE "AssetCategoryIntervalChange" ADD CONSTRAINT "AssetCategoryIntervalChange_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetCategoryIntervalChange" ADD CONSTRAINT "AssetCategoryIntervalChange_category_fkey" FOREIGN KEY ("category") REFERENCES "AssetCategory"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetIntervalChange" ADD CONSTRAINT "AssetIntervalChange_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- An interval is cleared (both null) or a whole number within its unit's limit:
-- 1-3650 days, 1-120 months or 1-10 years (spec service-intervals.md).
ALTER TABLE "AssetCategoryIntervalChange" ADD CONSTRAINT "AssetCategoryIntervalChange_interval_check" CHECK (
  ("intervalValue" IS NULL AND "intervalUnit" IS NULL)
  OR ("intervalUnit" = 'DAY' AND "intervalValue" BETWEEN 1 AND 3650)
  OR ("intervalUnit" = 'MONTH' AND "intervalValue" BETWEEN 1 AND 120)
  OR ("intervalUnit" = 'YEAR' AND "intervalValue" BETWEEN 1 AND 10)
);
ALTER TABLE "AssetIntervalChange" ADD CONSTRAINT "AssetIntervalChange_interval_check" CHECK (
  ("intervalValue" IS NULL AND "intervalUnit" IS NULL)
  OR ("intervalUnit" = 'DAY' AND "intervalValue" BETWEEN 1 AND 3650)
  OR ("intervalUnit" = 'MONTH' AND "intervalValue" BETWEEN 1 AND 120)
  OR ("intervalUnit" = 'YEAR' AND "intervalValue" BETWEEN 1 AND 10)
);
