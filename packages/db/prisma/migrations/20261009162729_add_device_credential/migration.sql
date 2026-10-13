-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "credentialHash" CHAR(64),
ADD COLUMN     "credentialIssuedAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE UNIQUE INDEX "Device_credentialHash_key" ON "Device"("credentialHash");

