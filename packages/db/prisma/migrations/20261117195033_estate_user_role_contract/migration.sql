-- AlterTable
ALTER TABLE "EstateUser" ALTER COLUMN "role" DROP DEFAULT;

-- Contract step of estate-role-permissions: the legacy Member role was converted
-- to Council by 20261117145338_preset_role_permissions; now no row may hold it.
UPDATE "EstateUser" SET role = 'COUNCIL' WHERE role = 'MEMBER';
ALTER TABLE "EstateUser" DROP CONSTRAINT "EstateUser_role_check";
ALTER TABLE "EstateUser" ADD CONSTRAINT "EstateUser_role_check"
  CHECK (role IN ('COUNCIL', 'RESIDENT', 'MANAGER', 'CREW', 'CUSTOM'));
