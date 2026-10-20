-- CreateTable
CREATE TABLE "FlatlinePolicy" (
    "estateId" UUID NOT NULL,
    "metric" VARCHAR(30) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "tolerance" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "FlatlinePolicy_pkey" PRIMARY KEY ("estateId","metric")
);

-- CreateTable
CREATE TABLE "DeviceFlatlinePause" (
    "deviceId" UUID NOT NULL,
    "metric" VARCHAR(30) NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "pausedAt" TIMESTAMPTZ(6) NOT NULL,
    "resumesAt" TIMESTAMPTZ(6) NOT NULL,
    "pausedByUserId" VARCHAR(255) NOT NULL,

    CONSTRAINT "DeviceFlatlinePause_pkey" PRIMARY KEY ("deviceId","metric")
);

-- CreateIndex
CREATE INDEX "DeviceFlatlinePause_estateId_idx" ON "DeviceFlatlinePause"("estateId");

-- AddForeignKey
ALTER TABLE "FlatlinePolicy" ADD CONSTRAINT "FlatlinePolicy_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DeviceFlatlinePause" ADD CONSTRAINT "DeviceFlatlinePause_deviceId_estateId_fkey" FOREIGN KEY ("deviceId", "estateId") REFERENCES "Device"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "DeviceFlatlinePause" ADD CONSTRAINT "DeviceFlatlinePause_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
