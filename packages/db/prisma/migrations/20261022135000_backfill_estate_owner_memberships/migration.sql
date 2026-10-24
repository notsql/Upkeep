-- Estate creation now records the owner's MANAGER membership. Repair estates
-- created before that invariant so their owners receive the same report access.
-- Preserve unrelated memberships and fail closed on owner/RESIDENT conflicts.
INSERT INTO "EstateUser" ("estateId", "userId", role)
SELECT id, "ownerUserId", 'MANAGER'
FROM "Estate"
WHERE true
ON CONFLICT ("estateId", "userId") DO UPDATE
SET role = EXCLUDED.role
WHERE "EstateUser".role IN ('MEMBER', 'COUNCIL', 'CREW');
