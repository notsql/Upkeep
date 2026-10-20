-- CreateIndex
CREATE INDEX "DeviceReading_assetId_metric_measuredAt_idx" ON "DeviceReading"("assetId", "metric", "measuredAt");
