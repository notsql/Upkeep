---
description: Add or change a Prisma model and update the Java side to match
argument-hint: <the model or change you want>
---

Change the database schema. Remember rule 5 in `AGENTS.md`: Prisma owns the
schema, Spring never migrates.

Requested change: $ARGUMENTS

1. Edit `packages/db/prisma/schema/schema.prisma`.
2. Run `pnpm db:start`, then `pnpm db:migrate` to create and apply the
   migration.
3. Update the Java persistence code in `apps/server` so it matches the new
   shape. **Nothing verifies this automatically** - the migration is only half
   the task, and skipping this step produces runtime failures rather than
   compile errors.
4. If any API response shape changed as a result, run `pnpm api:generate` and
   fix the resulting frontend type errors.
5. Run `pnpm test`.

Tell me explicitly which Java files you changed to stay in sync, and flag
anything you were unsure about.
