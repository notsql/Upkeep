-- Asset categories, the shared manufacturer and model catalogue, and asset
-- events (decision 0026). Hand-ordered: categories are seeded before
-- Asset.category gets its foreign key, and the catalogue is filled from the
-- old text columns before they are dropped.

-- CreateTable
CREATE TABLE "AssetCategory" (
    "code" VARCHAR(30) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("code")
);

-- Seed categories
INSERT INTO "AssetCategory" ("code", "label") VALUES
    ('LIFT', 'Lift & escalator'),
    ('PUMP', 'Pump'),
    ('GENERATOR', 'Generator'),
    ('ELECTRICAL', 'Electrical'),
    ('LIGHTING', 'Lighting'),
    ('FIRE_SAFETY', 'Fire safety'),
    ('HVAC', 'Air-con & ventilation'),
    ('PLUMBING', 'Plumbing & water'),
    ('SECURITY', 'Security & access'),
    ('WASTE', 'Waste handling'),
    ('FACADE_ACCESS', 'Facade access'),
    ('RECREATION', 'Recreation'),
    ('OTHER', 'Other');

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetModel" (
    "id" UUID NOT NULL,
    "manufacturerId" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetEvent" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "notes" VARCHAR(2000) NOT NULL,
    "manufacturerId" UUID,
    "modelId" UUID,
    "recordedByUserId" VARCHAR(255) NOT NULL,
    "recordedByName" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_name_key" ON "Manufacturer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AssetModel_manufacturerId_category_name_key" ON "AssetModel"("manufacturerId", "category", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AssetModel_id_manufacturerId_key" ON "AssetModel"("id", "manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetModel_id_manufacturerId_category_key" ON "AssetModel"("id", "manufacturerId", "category");

-- CreateIndex
CREATE INDEX "AssetEvent_estateId_idx" ON "AssetEvent"("estateId");

-- CreateIndex
CREATE INDEX "AssetEvent_assetId_occurredOn_createdAt_idx" ON "AssetEvent"("assetId", "occurredOn", "createdAt");

-- AlterTable: add the new columns, keeping the text ones until the data is moved
ALTER TABLE "Asset" ADD COLUMN "manufacturerId" UUID,
ADD COLUMN "modelId" UUID;

-- Data migration: normalise the text columns (trim, collapse inner whitespace,
-- uppercase; blank becomes null). An asset with a model but no manufacturer
-- gets the manufacturer UNKNOWN.
CREATE TEMPORARY TABLE "_asset_catalogue" AS
SELECT
    a."id" AS "assetId",
    a."category",
    CASE
        WHEN n."model" IS NULL THEN n."manufacturer"
        ELSE COALESCE(n."manufacturer", 'UNKNOWN')
    END AS "manufacturer",
    n."model"
FROM "Asset" a
CROSS JOIN LATERAL (
    SELECT
        NULLIF(UPPER(BTRIM(REGEXP_REPLACE(a."manufacturer", '\s+', ' ', 'g'))), '') AS "manufacturer",
        NULLIF(UPPER(BTRIM(REGEXP_REPLACE(a."model", '\s+', ' ', 'g'))), '') AS "model"
) n;

INSERT INTO "Manufacturer" ("id", "name")
SELECT gen_random_uuid(), m."manufacturer"
FROM (
    SELECT DISTINCT "manufacturer" FROM "_asset_catalogue" WHERE "manufacturer" IS NOT NULL
) m;

INSERT INTO "AssetModel" ("id", "manufacturerId", "category", "name")
SELECT gen_random_uuid(), mf."id", c."category", c."model"
FROM (
    SELECT DISTINCT "manufacturer", "category", "model"
    FROM "_asset_catalogue"
    WHERE "model" IS NOT NULL
) c
JOIN "Manufacturer" mf ON mf."name" = c."manufacturer";

UPDATE "Asset" a
SET "manufacturerId" = mf."id",
    "modelId" = am."id"
FROM "_asset_catalogue" c
JOIN "Manufacturer" mf ON mf."name" = c."manufacturer"
LEFT JOIN "AssetModel" am
    ON am."manufacturerId" = mf."id"
    AND am."category" = c."category"
    AND am."name" = c."model"
WHERE a."id" = c."assetId";

DROP TABLE "_asset_catalogue";

-- AlterTable
ALTER TABLE "Asset" DROP COLUMN "manufacturer",
DROP COLUMN "model";

-- CreateIndex
CREATE INDEX "Asset_modelId_idx" ON "Asset"("modelId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_category_fkey" FOREIGN KEY ("category") REFERENCES "AssetCategory"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetModel" ADD CONSTRAINT "AssetModel_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetModel" ADD CONSTRAINT "AssetModel_category_fkey" FOREIGN KEY ("category") REFERENCES "AssetCategory"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_modelId_manufacturerId_category_fkey" FOREIGN KEY ("modelId", "manufacturerId", "category") REFERENCES "AssetModel"("id", "manufacturerId", "category") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "AssetEvent" ADD CONSTRAINT "AssetEvent_modelId_manufacturerId_fkey" FOREIGN KEY ("modelId", "manufacturerId") REFERENCES "AssetModel"("id", "manufacturerId") ON DELETE RESTRICT ON UPDATE RESTRICT;
