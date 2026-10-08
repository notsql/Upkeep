-- AlterTable
ALTER TABLE "EstateUser" ADD COLUMN     "canInviteMembers" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" VARCHAR(20) NOT NULL DEFAULT 'MEMBER';

-- CreateTable
CREATE TABLE "EstateInvitation" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "inviterUserId" VARCHAR(255) NOT NULL,
    "providerInvitationId" VARCHAR(255),
    "status" VARCHAR(20) NOT NULL DEFAULT 'SENDING',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6),
    "acceptedAt" TIMESTAMPTZ(6),
    "acceptedUserId" VARCHAR(255),

    CONSTRAINT "EstateInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstateInvitation_providerInvitationId_key" ON "EstateInvitation"("providerInvitationId");

-- CreateIndex
CREATE INDEX "EstateInvitation_email_status_idx" ON "EstateInvitation"("email", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EstateInvitation_estateId_email_key" ON "EstateInvitation"("estateId", "email");

-- AddForeignKey
ALTER TABLE "EstateInvitation" ADD CONSTRAINT "EstateInvitation_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
