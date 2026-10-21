-- AlterTable
ALTER TABLE "EstateInvitation" ADD COLUMN     "role" VARCHAR(20) NOT NULL DEFAULT 'COUNCIL';

ALTER TABLE "EstateInvitation" ADD CONSTRAINT "EstateInvitation_role_check"
  CHECK (role IN ('COUNCIL', 'RESIDENT', 'MANAGER', 'CREW'));

ALTER TABLE "EstateUser" DROP CONSTRAINT "EstateUser_role_check";
ALTER TABLE "EstateUser" ADD CONSTRAINT "EstateUser_role_check"
  CHECK (role IN ('MEMBER', 'COUNCIL', 'RESIDENT', 'MANAGER', 'CREW'));

DROP INDEX "EstateUser_one_resident_estate";
