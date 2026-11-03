-- CreateTable
CREATE TABLE "InspectionCheck" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "month" DATE NOT NULL,
    "dueOn" DATE NOT NULL,
    "dueBasis" VARCHAR(15) NOT NULL,
    "intervalValue" INTEGER,
    "intervalUnit" VARCHAR(5),
    "intervalSource" VARCHAR(8),
    "generatedByUserId" VARCHAR(255) NOT NULL,
    "generatedByName" VARCHAR(255),
    "generatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedByResultId" UUID,
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "InspectionCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionListRun" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "month" DATE NOT NULL,
    "added" INTEGER NOT NULL,
    "generatedByUserId" VARCHAR(255) NOT NULL,
    "generatedByName" VARCHAR(255),
    "generatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionListRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InspectionCheck_completedByResultId_key" ON "InspectionCheck"("completedByResultId");

-- CreateIndex
CREATE INDEX "InspectionCheck_estateId_month_idx" ON "InspectionCheck"("estateId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "InspectionCheck_assetId_month_key" ON "InspectionCheck"("assetId", "month");

-- CreateIndex
CREATE INDEX "InspectionListRun_estateId_month_generatedAt_idx" ON "InspectionListRun"("estateId", "month", "generatedAt");

-- AddForeignKey
ALTER TABLE "InspectionCheck" ADD CONSTRAINT "InspectionCheck_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InspectionCheck" ADD CONSTRAINT "InspectionCheck_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InspectionCheck" ADD CONSTRAINT "InspectionCheck_completedByResultId_fkey" FOREIGN KEY ("completedByResultId") REFERENCES "AssetInspectionResult"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "InspectionListRun" ADD CONSTRAINT "InspectionListRun_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;


-- At most one open check per asset (spec monthly-inspection-list.md).
CREATE UNIQUE INDEX "InspectionCheck_one_open_per_asset" ON "InspectionCheck"("assetId") WHERE "completedByResultId" IS NULL;

ALTER TABLE "InspectionCheck"
  ADD CONSTRAINT "InspectionCheck_dueBasis_check" CHECK ("dueBasis" IN ('PREDICTION', 'INTERVAL', 'NEVER_INSPECTED')),
  ADD CONSTRAINT "InspectionCheck_month_check" CHECK (EXTRACT(DAY FROM "month") = 1),
  ADD CONSTRAINT "InspectionCheck_completed_check" CHECK (("completedByResultId" IS NULL) = ("completedAt" IS NULL)),
  ADD CONSTRAINT "InspectionCheck_interval_check" CHECK (
    ("intervalValue" IS NULL AND "intervalUnit" IS NULL AND "intervalSource" IS NULL)
    OR ("intervalSource" IN ('ASSET', 'CATEGORY') AND (
      ("intervalUnit" = 'DAY' AND "intervalValue" BETWEEN 1 AND 3650)
      OR ("intervalUnit" = 'MONTH' AND "intervalValue" BETWEEN 1 AND 120)
      OR ("intervalUnit" = 'YEAR' AND "intervalValue" BETWEEN 1 AND 10)
    ))
  );
ALTER TABLE "InspectionListRun"
  ADD CONSTRAINT "InspectionListRun_month_check" CHECK (EXTRACT(DAY FROM "month") = 1),
  ADD CONSTRAINT "InspectionListRun_added_check" CHECK ("added" >= 0);
