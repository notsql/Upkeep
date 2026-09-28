# 0014 - The location hierarchy is one self-referencing table

**Status:** accepted

## Context

Estates contain blocks, blocks contain levels, and common areas sit inside a
block (lifts, stairwells) or a level (lift lobbies, corridors). Faults and
assets will reference these locations, so every node needs one stable ID, and
the story forbids orphaned or circular nodes.

## Decision

- **One `Location` table with a `type` column**, not a table per type. Anything
  that references a location needs one foreign key, not one per type plus an
  "exactly one is set" check in every referencing table.
- **Postgres enforces the shape.** `parentType` repeats the parent's type, and
  the parent foreign key is `(parentId, parentType, estateId)` referencing
  `(id, type, estateId)`. The hand-written `Location_hierarchy_check` constraint
  in the migration then allows only BLOCK (no parent), LEVEL (BLOCK parent and
  a `sortOrder`) and COMMON_AREA (BLOCK or LEVEL parent). A parent always ranks
  above its child, so cycles are impossible, and a parent from another estate
  or of the wrong type is rejected by the database, not only by Java.
- **`type` is a `VARCHAR` checked by that constraint, not a Postgres enum.**
  The check has to be hand-written anyway, and a Prisma enum would add a
  Postgres type whose jOOQ class name is one more thing to keep in step.
- **Soft delete, as for estates.** `deactivatedAt` keeps the row and its ID.
  Deactivation is refused while active children remain, deactivated rows
  cannot be edited or used as a parent, and there is no reactivation.
- **Uniqueness among active rows is checked in the service**, not by index:
  sibling names (case-insensitive) and a level's `sortOrder` within its block.
  A partial unique index (`WHERE "deactivatedAt" IS NULL`) cannot be written in
  Prisma, and one added by hand would be dropped by the next `migrate dev`.
  Every location write locks the estate row first (decision 0010), which
  serializes writes within an estate, so these checks cannot race.

## Consequences

- Changing a location's type means deactivating it and creating a new one.
- Type-specific columns, if ever needed, become nullable columns or a side
  table.
- `Location_hierarchy_check` lives only in the migration SQL. Prisma does not
  manage CHECK constraints and leaves them in place; anyone rewriting the
  migration history must carry it over.
- Deactivating a block with levels is bottom-up work for the manager. A cascade
  was rejected for now because deactivation cannot be undone.
