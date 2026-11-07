-- AlterTable
ALTER TABLE "IssueReport" ADD COLUMN     "isSafety" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "urgency" VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "urgencyVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "IssueReportUrgencyEvent" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "fromUrgency" VARCHAR(20) NOT NULL,
    "toUrgency" VARCHAR(20) NOT NULL,
    "fromIsSafety" BOOLEAN NOT NULL,
    "toIsSafety" BOOLEAN NOT NULL,
    "changedByUserId" VARCHAR(255) NOT NULL,
    "changedByName" VARCHAR(255),
    "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueReportUrgencyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssueReportUrgencyEvent_reportId_version_key" ON "IssueReportUrgencyEvent"("reportId", "version");

-- AddForeignKey
ALTER TABLE "IssueReportUrgencyEvent" ADD CONSTRAINT "IssueReportUrgencyEvent_reportId_estateId_fkey" FOREIGN KEY ("reportId", "estateId") REFERENCES "IssueReport"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
