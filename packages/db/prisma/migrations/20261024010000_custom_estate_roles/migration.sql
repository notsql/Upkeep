-- AlterTable
ALTER TABLE "EstateUser" ADD COLUMN     "customRoleId" UUID;

-- AlterTable
ALTER TABLE "EstateInvitation" ADD COLUMN     "customRoleId" UUID;

-- CreateTable
CREATE TABLE "Permission" (
    "code" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "EstateRoleDefinition" (
    "id" UUID NOT NULL,
    "estateId" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "normalizedName" VARCHAR(40) NOT NULL,
    "description" VARCHAR(500),
    "createdByUserId" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "EstateRoleDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EstateRolePermission" (
    "roleId" UUID NOT NULL,
    "permission" VARCHAR(64) NOT NULL,

    CONSTRAINT "EstateRolePermission_pkey" PRIMARY KEY ("roleId","permission")
);

-- CreateIndex
CREATE UNIQUE INDEX "EstateRoleDefinition_id_estateId_key" ON "EstateRoleDefinition"("id", "estateId");

-- CreateIndex
CREATE UNIQUE INDEX "EstateRoleDefinition_estateId_normalizedName_key" ON "EstateRoleDefinition"("estateId", "normalizedName");

-- AddForeignKey
ALTER TABLE "EstateUser" ADD CONSTRAINT "EstateUser_customRoleId_estateId_fkey" FOREIGN KEY ("customRoleId", "estateId") REFERENCES "EstateRoleDefinition"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EstateInvitation" ADD CONSTRAINT "EstateInvitation_customRoleId_estateId_fkey" FOREIGN KEY ("customRoleId", "estateId") REFERENCES "EstateRoleDefinition"("id", "estateId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EstateRoleDefinition" ADD CONSTRAINT "EstateRoleDefinition_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "Estate"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EstateRolePermission" ADD CONSTRAINT "EstateRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "EstateRoleDefinition"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "EstateRolePermission" ADD CONSTRAINT "EstateRolePermission_permission_fkey" FOREIGN KEY ("permission") REFERENCES "Permission"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;
-- CUSTOM is valid exactly when a same-estate definition is referenced.
ALTER TABLE "EstateUser" DROP CONSTRAINT "EstateUser_role_check";
ALTER TABLE "EstateUser" ADD CONSTRAINT "EstateUser_role_check"
  CHECK (role IN ('MEMBER', 'COUNCIL', 'RESIDENT', 'MANAGER', 'CREW', 'CUSTOM'));
ALTER TABLE "EstateInvitation" DROP CONSTRAINT "EstateInvitation_role_check";
ALTER TABLE "EstateInvitation" ADD CONSTRAINT "EstateInvitation_role_check"
  CHECK (role IN ('COUNCIL', 'RESIDENT', 'MANAGER', 'CREW', 'CUSTOM'));

ALTER TABLE "EstateUser" ADD CONSTRAINT "EstateUser_custom_role_check"
  CHECK ((role = 'CUSTOM' AND "customRoleId" IS NOT NULL)
      OR (role <> 'CUSTOM' AND "customRoleId" IS NULL));
ALTER TABLE "EstateInvitation" ADD CONSTRAINT "EstateInvitation_custom_role_check"
  CHECK ((role = 'CUSTOM' AND "customRoleId" IS NOT NULL)
      OR (role <> 'CUSTOM' AND "customRoleId" IS NULL));
ALTER TABLE "EstateRoleDefinition" ADD CONSTRAINT "EstateRoleDefinition_version_check" CHECK (version > 0);

INSERT INTO "Permission" (code, label, description) VALUES
 ('VIEW_ESTATE', 'View estate', 'View estate details, the management dashboard and active location hierarchy.'),
 ('EDIT_ESTATE', 'Edit estate', 'Edit estate details without changing ownership or deactivating the estate.'),
 ('VIEW_FAULT_REPORTS', 'View fault reports', 'Read estate fault reports, their private images and historical location context.'),
 ('RELOCATE_FAULT_REPORTS', 'Relocate fault reports', 'Correct report locations in an active estate.'),
 ('INVITE_MEMBERS', 'Invite members', 'Invite into eligible custom roles and view or cancel your own invitations.'),
 ('CREATE_LOCATIONS', 'Create locations', 'Create blocks, levels and common areas, including bulk floors, in an active estate.'),
 ('EDIT_LOCATIONS', 'Edit locations', 'Rename, reorder or move active locations within an active estate.'),
 ('CREATE_ROLES', 'Create roles', 'Create custom roles using permissions you currently hold.'),
 ('EDIT_ROLES', 'Edit roles', 'Edit eligible custom roles other than your assigned role, within your own permissions.');
