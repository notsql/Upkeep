-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "reference" VARCHAR(60) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "installedOn" DATE,
    "manufacturer" VARCHAR(200),
    "model" VARCHAR(200),
    "serialNumber" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deactivatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_estateId_idx" ON "Asset"("estateId");

-- CreateIndex
CREATE INDEX "Asset_locationId_idx" ON "Asset"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_estateId_reference_key" ON "Asset"("estateId", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Location_id_estateId_key" ON "Location"("id", "estateId");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_locationId_estateId_fkey" FOREIGN KEY ("locationId", "estateId") REFERENCES "Location"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
