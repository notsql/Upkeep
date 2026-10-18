-- CreateTable
CREATE TABLE "DeviceReading" (
    "id" UUID NOT NULL,
    "deviceId" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "metric" VARCHAR(30) NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "measuredAt" TIMESTAMPTZ(6) NOT NULL,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DeviceReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceReading_deviceId_metric_measuredAt_key" ON "DeviceReading"("deviceId", "metric", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Device_id_estateId_key" ON "Device"("id", "estateId");

-- AddForeignKey
ALTER TABLE "DeviceReading" ADD CONSTRAINT "DeviceReading_deviceId_estateId_fkey" FOREIGN KEY ("deviceId", "estateId") REFERENCES "Device"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DeviceReading" ADD CONSTRAINT "DeviceReading_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

