-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "lifecycleVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "retiredOn" DATE,
ADD COLUMN     "retirementReason" VARCHAR(2000);

-- CreateTable
CREATE TABLE "AssetLifecycleEvent" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" VARCHAR(255) NOT NULL,
    "previousDeactivatedAt" TIMESTAMPTZ(6),
    "previousRetiredOn" DATE,
    "previousRetirementReason" VARCHAR(2000),
    "deactivatedAt" TIMESTAMPTZ(6),
    "retiredOn" DATE,
    "retirementReason" VARCHAR(2000),
    "lifecycleVersion" INTEGER NOT NULL,

    CONSTRAINT "AssetLifecycleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetLifecycleEvent_estateId_assetId_idx" ON "AssetLifecycleEvent"("estateId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetLifecycleEvent_assetId_lifecycleVersion_key" ON "AssetLifecycleEvent"("assetId", "lifecycleVersion");

-- AddForeignKey
ALTER TABLE "AssetLifecycleEvent" ADD CONSTRAINT "AssetLifecycleEvent_assetId_estateId_fkey" FOREIGN KEY ("assetId", "estateId") REFERENCES "Asset"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;
