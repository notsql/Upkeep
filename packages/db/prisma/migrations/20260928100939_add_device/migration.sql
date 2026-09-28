-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "identifier" VARCHAR(100) NOT NULL,
    "model" VARCHAR(200) NOT NULL,
    "metrics" VARCHAR(30)[],
    "reportingIntervalSeconds" INTEGER NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_identifier_key" ON "Device"("identifier");

-- CreateIndex
CREATE INDEX "Device_estateId_idx" ON "Device"("estateId");

-- CreateIndex
CREATE INDEX "Device_assetId_idx" ON "Device"("assetId");

-- CreateIndex
CREATE INDEX "Device_locationId_idx" ON "Device"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_id_estateId_key" ON "Asset"("id", "estateId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_locationId_estateId_fkey" FOREIGN KEY ("locationId", "estateId") REFERENCES "Location"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

