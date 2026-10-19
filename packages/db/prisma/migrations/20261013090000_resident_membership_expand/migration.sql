-- Abort conflicting conversions; preserve existing management grants and history.
BEGIN;
LOCK TABLE "EstateUser", "ResidentAssignment" IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE "_ResidentMigrationReview" (valid boolean NOT NULL CHECK (valid));
INSERT INTO "_ResidentMigrationReview" (valid)
SELECT NOT EXISTS (
  SELECT 1 FROM "ResidentAssignment" a
  JOIN "EstateUser" u ON u."userId" = a."userId" AND u."estateId" = a."estateId"
  WHERE a."revokedAt" IS NULL AND u.role <> 'RESIDENT'
) AND NOT EXISTS (
  SELECT 1 FROM "ResidentAssignment" a JOIN "Estate" e ON e.id = a."estateId"
  WHERE a."revokedAt" IS NULL AND e."ownerUserId" = a."userId"
);
DROP TABLE "_ResidentMigrationReview";

ALTER TABLE "EstateUser" ADD CONSTRAINT "EstateUser_role_check"
  CHECK (role IN ('MEMBER', 'COUNCIL', 'RESIDENT'));
ALTER TABLE "EstateUser" ADD CONSTRAINT "EstateUser_resident_invitation_check"
  CHECK (role <> 'RESIDENT' OR NOT "canInviteMembers");
CREATE UNIQUE INDEX "EstateUser_one_resident_estate" ON "EstateUser" ("userId") WHERE role = 'RESIDENT';

INSERT INTO "EstateUser" ("estateId", "userId", role, "canInviteMembers", "createdAt")
SELECT "estateId", "userId", 'RESIDENT', false, "createdAt" FROM "ResidentAssignment"
WHERE "revokedAt" IS NULL
ON CONFLICT ("estateId", "userId") DO NOTHING;

COMMIT;
