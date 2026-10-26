-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "deactivatedAt" TIMESTAMPTZ(6),
ADD COLUMN     "replacesDeviceId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Device_replacesDeviceId_estateId_key" ON "Device"("replacesDeviceId", "estateId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_replacesDeviceId_estateId_fkey" FOREIGN KEY ("replacesDeviceId", "estateId") REFERENCES "Device"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

