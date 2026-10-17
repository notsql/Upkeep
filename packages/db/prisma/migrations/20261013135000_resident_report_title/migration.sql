BEGIN;

ALTER TABLE "IssueReport" ADD COLUMN "title" VARCHAR(150);

UPDATE "IssueReport"
SET "title" = COALESCE(NULLIF(LEFT(BTRIM("description", E' \t\n\r\f'), 150), ''), 'Fault report');

ALTER TABLE "IssueReport" ALTER COLUMN "title" SET NOT NULL;

COMMIT;
