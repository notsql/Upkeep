-- CreateTable
CREATE TABLE "EstateUser" (
    "estateId" UUID NOT NULL,
    "userId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EstateUser_pkey" PRIMARY KEY ("estateId","userId")
);

-- CreateIndex
CREATE INDEX "EstateUser_userId_idx" ON "EstateUser"("userId");

-- AddForeignKey
ALTER TABLE "EstateUser" ADD CONSTRAINT "EstateUser_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

