-- CreateIndex
CREATE INDEX "IssueReport_estateId_createdAt_id_idx" ON "IssueReport"("estateId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "IssueReport_estateId_locationId_createdAt_id_idx" ON "IssueReport"("estateId", "locationId", "createdAt", "id");
