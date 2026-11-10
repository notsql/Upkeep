-- CreateTable
CREATE TABLE "ServiceProvider" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentProviderRoute" (
    "estateId" UUID NOT NULL,
    "equipmentType" VARCHAR(20) NOT NULL,
    "providerId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "EquipmentProviderRoute_pkey" PRIMARY KEY ("estateId","equipmentType")
);

-- CreateTable
CREATE TABLE "ReportRouting" (
    "reportId" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "state" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(500),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(6),
    "workOrderId" UUID,
    "decidedByUserId" VARCHAR(255),
    "decidedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ReportRouting_pkey" PRIMARY KEY ("reportId")
);

-- CreateTable
CREATE TABLE "ReportClassification" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "outcome" VARCHAR(20) NOT NULL,
    "equipmentType" VARCHAR(20),
    "confidence" DECIMAL(3,2) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportClassification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderDispatch" (
    "id" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "providerId" UUID NOT NULL,
    "equipmentType" VARCHAR(20) NOT NULL,
    "contractorName" VARCHAR(200) NOT NULL,
    "contractorEmail" VARCHAR(254) NOT NULL,
    "approvedByUserId" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMPTZ(6),
    "sentAt" TIMESTAMPTZ(6),
    "lastErrorCode" VARCHAR(50),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "WorkOrderDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProvider_id_estateId_key" ON "ServiceProvider"("id", "estateId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProvider_estateId_email_key" ON "ServiceProvider"("estateId", "email");

-- CreateIndex
CREATE INDEX "EquipmentProviderRoute_providerId_idx" ON "EquipmentProviderRoute"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRouting_workOrderId_key" ON "ReportRouting"("workOrderId");

-- CreateIndex
CREATE INDEX "ReportRouting_state_nextAttemptAt_idx" ON "ReportRouting"("state", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRouting_reportId_estateId_key" ON "ReportRouting"("reportId", "estateId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRouting_workOrderId_estateId_key" ON "ReportRouting"("workOrderId", "estateId");

-- CreateIndex
CREATE INDEX "ReportClassification_reportId_createdAt_idx" ON "ReportClassification"("reportId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderDispatch_workOrderId_key" ON "WorkOrderDispatch"("workOrderId");

-- CreateIndex
CREATE INDEX "WorkOrderDispatch_status_nextAttemptAt_idx" ON "WorkOrderDispatch"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "WorkOrderDispatch_providerId_idx" ON "WorkOrderDispatch"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderDispatch_workOrderId_estateId_key" ON "WorkOrderDispatch"("workOrderId", "estateId");

-- AddForeignKey
ALTER TABLE "ServiceProvider" ADD CONSTRAINT "ServiceProvider_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentProviderRoute" ADD CONSTRAINT "EquipmentProviderRoute_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EquipmentProviderRoute" ADD CONSTRAINT "EquipmentProviderRoute_providerId_estateId_fkey" FOREIGN KEY ("providerId", "estateId") REFERENCES "ServiceProvider"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ReportRouting" ADD CONSTRAINT "ReportRouting_reportId_estateId_fkey" FOREIGN KEY ("reportId", "estateId") REFERENCES "IssueReport"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ReportRouting" ADD CONSTRAINT "ReportRouting_workOrderId_estateId_fkey" FOREIGN KEY ("workOrderId", "estateId") REFERENCES "WorkOrder"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ReportClassification" ADD CONSTRAINT "ReportClassification_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "IssueReport"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "WorkOrderDispatch" ADD CONSTRAINT "WorkOrderDispatch_workOrderId_estateId_fkey" FOREIGN KEY ("workOrderId", "estateId") REFERENCES "WorkOrder"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "WorkOrderDispatch" ADD CONSTRAINT "WorkOrderDispatch_providerId_estateId_fkey" FOREIGN KEY ("providerId", "estateId") REFERENCES "ServiceProvider"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
