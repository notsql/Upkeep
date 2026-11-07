-- CreateTable
CREATE TABLE "IssueReportDuplicate" (
    "reportId" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "originalReportId" UUID NOT NULL,
    "state" VARCHAR(20) NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "locationMatch" VARCHAR(10),
    "textSimilarity" DECIMAL(4,3),
    "repeatCue" BOOLEAN,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedByUserId" VARCHAR(255),
    "decidedAt" TIMESTAMPTZ(6),

    CONSTRAINT "IssueReportDuplicate_pkey" PRIMARY KEY ("reportId")
);

-- CreateIndex
CREATE INDEX "IssueReportDuplicate_estateId_originalReportId_state_idx" ON "IssueReportDuplicate"("estateId", "originalReportId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "IssueReportDuplicate_reportId_estateId_key" ON "IssueReportDuplicate"("reportId", "estateId");

-- CreateIndex
CREATE INDEX "WorkOrder_estateId_sourceReportId_idx" ON "WorkOrder"("estateId", "sourceReportId");

-- AddForeignKey
ALTER TABLE "IssueReportDuplicate" ADD CONSTRAINT "IssueReportDuplicate_reportId_estateId_fkey" FOREIGN KEY ("reportId", "estateId") REFERENCES "IssueReport"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "IssueReportDuplicate" ADD CONSTRAINT "IssueReportDuplicate_originalReportId_estateId_fkey" FOREIGN KEY ("originalReportId", "estateId") REFERENCES "IssueReport"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- A report cannot be its own original (spec fault-report-duplicates.md).
ALTER TABLE "IssueReportDuplicate" ADD CONSTRAINT "IssueReportDuplicate_not_self" CHECK ("reportId" <> "originalReportId");
