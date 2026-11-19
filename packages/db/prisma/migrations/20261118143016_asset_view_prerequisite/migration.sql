-- estate-role-permissions: VIEW_ASSETS now requires VIEW_ESTATE. A custom role
-- holding VIEW_ASSETS without it would resolve to no permissions at all, so it
-- gains VIEW_ESTATE (and a new version, so a stale edit form cannot overwrite it).
WITH affected AS (
  SELECT DISTINCT p."roleId"
  FROM "EstateRolePermission" p
  WHERE p.permission = 'VIEW_ASSETS'
    AND NOT EXISTS (
      SELECT 1 FROM "EstateRolePermission" q
      WHERE q."roleId" = p."roleId" AND q.permission = 'VIEW_ESTATE'
    )
), granted AS (
  INSERT INTO "EstateRolePermission" ("roleId", permission)
  SELECT "roleId", 'VIEW_ESTATE' FROM affected
  RETURNING "roleId"
)
UPDATE "EstateRoleDefinition" d
SET version = d.version + 1, "updatedAt" = now()
FROM granted
WHERE d.id = granted."roleId";
