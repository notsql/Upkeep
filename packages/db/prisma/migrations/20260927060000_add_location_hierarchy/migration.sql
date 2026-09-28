-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "parentId" UUID,
    "parentType" VARCHAR(20),
    "name" VARCHAR(200) NOT NULL,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deactivatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_estateId_idx" ON "Location"("estateId");

-- CreateIndex
CREATE INDEX "Location_parentId_idx" ON "Location"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Location_id_type_estateId_key" ON "Location"("id", "type", "estateId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_parentType_estateId_fkey" FOREIGN KEY ("parentId", "parentType", "estateId") REFERENCES "Location"("id", "type", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Hand-written: Prisma cannot express CHECK constraints, and it leaves ones it
-- did not create alone. Together with the composite foreign key above, this
-- makes the hierarchy's shape a database rule:
--   BLOCK        has no parent
--   LEVEL        has a BLOCK parent and a sortOrder (its position in the block)
--   COMMON_AREA  has a BLOCK or LEVEL parent
-- A parent always ranks above its child (BLOCK > LEVEL > COMMON_AREA), so a
-- cycle is impossible. Comparisons are written to be false, never NULL, because
-- a CHECK that evaluates to NULL passes.
ALTER TABLE "Location" ADD CONSTRAINT "Location_hierarchy_check" CHECK (
    ("parentId" IS NULL) = ("parentType" IS NULL)
    AND ("type" = 'LEVEL') = ("sortOrder" IS NOT NULL)
    AND (
        ("type" = 'BLOCK' AND "parentId" IS NULL)
        OR ("type" = 'LEVEL' AND "parentType" IS NOT NULL AND "parentType" = 'BLOCK')
        OR ("type" = 'COMMON_AREA' AND "parentType" IS NOT NULL AND "parentType" IN ('BLOCK', 'LEVEL'))
    )
);
