-- CreateTable
CREATE TABLE "Estate" (
    "id" UUID NOT NULL,
    "ownerUserId" VARCHAR(255) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "postalCode" VARCHAR(20) NOT NULL,
    "description" VARCHAR(2000),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deactivatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Estate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Estate_code_key" ON "Estate"("code");

-- CreateIndex
CREATE INDEX "Estate_ownerUserId_idx" ON "Estate"("ownerUserId");
