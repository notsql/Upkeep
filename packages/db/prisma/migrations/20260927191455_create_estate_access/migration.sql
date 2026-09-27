-- CreateTable
CREATE TABLE "EstateAccess" (
    "estateId" UUID NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstateAccess_pkey" PRIMARY KEY ("estateId","userId")
);

-- CreateIndex
CREATE INDEX "EstateAccess_userId_idx" ON "EstateAccess"("userId");

-- AddForeignKey
ALTER TABLE "EstateAccess" ADD CONSTRAINT "EstateAccess_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

