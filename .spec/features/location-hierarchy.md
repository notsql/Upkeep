# Location hierarchy

**Status:** built; server tests and generated code pending a run on a Neon branch
**Owner:** Genghong

## Problem

Estate managers describe faults and assets in free text ("the lift lobby on
level 4 of block 101"). Nothing can reference a location, so reports cannot be
pinpointed, grouped or searched.

## Behaviour

- An owner can add blocks directly under an active estate.
- An owner can add levels under a block. Each level has a position (`sortOrder`)
  that orders it within the block; lower is lower, basements are negative.
- An owner can add common areas under a block or a level.
- A block cannot have a parent; a level cannot sit under a level or a common
  area; nothing can sit under a common area. These are 400s.
- A parent that is unknown or belongs to another estate is a 404.
- Names are trimmed and must be unique, case-insensitively, among a node's
  active siblings. A level's position must be unique among the block's active
  levels. Duplicates are 409s.
- Owners can rename a location, change a level's position, move a level to
  another block and move a common area to another block or level. Children
  move with their parent. The type never changes.
- Owners can deactivate a location. It keeps its ID and row. Deactivation is
  refused (409) while it has active children, and repeating it keeps the
  original timestamp.
- Deactivated locations cannot be edited or used as a parent (409).
- Nothing can change in an inactive estate (409); its hierarchy stays browsable.
- Only the estate's owner can see or change its locations; anyone else gets 404.
- The estate page shows active locations as a nested tree, levels in position
  order and everything else by name.
- Searching by name lists every match with its full path, for example
  "Blk 101 › Level 1 › Lift lobby".
- Adding a level suggests the position above the block's highest level.

## Data

Prisma `Location`: UUID ID, `estateId`, `type` (BLOCK, LEVEL, COMMON_AREA),
`parentId` and `parentType`, `name`, `sortOrder` (levels only), created,
updated and nullable deactivated timestamps. See decision 0014 for the
composite parent foreign key and the hand-written `Location_hierarchy_check`.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/locations | - | LocationResponse[] (active) | Owner |
| POST | /estates/{estateId}/locations | CreateLocationRequest | 201 LocationResponse | Owner |
| PATCH | /estates/{estateId}/locations/{id} | UpdateLocationRequest (name, parentId, sortOrder) | LocationResponse | Owner |
| POST | /estates/{estateId}/locations/{id}/deactivate | - | LocationResponse | Owner |

## Edge cases

- Every write locks the estate row, serializing writes in an estate, so the
  service's uniqueness checks cannot race and a write cannot slip past a
  concurrent estate deactivation.
- If a database constraint still fires, the API returns 409 without SQL.
- A PATCH body's `type` is ignored; type cannot change.
- Search runs in the browser over the estate's list. Fine at hundreds of nodes
  per estate; revisit if estates reach many thousands.

## Out of scope

- Reactivating a location, or viewing deactivated ones.
- Cascading deactivation.
- Drag-to-reorder levels.
- Estate-wide common areas with no block (playgrounds, carparks). If needed,
  add a new type rather than loosening COMMON_AREA.
- Search across estates.

## Verification

- `Location_hierarchy_check` and the composite foreign keys were exercised
  against Postgres 16 with the migration SQL: 21 valid and invalid inserts,
  moves and deletes behaved as specified.
- Web: `tests/lib/locations.test.ts` and
  `tests/components/locations/locations-section.test.tsx` were seen failing
  before the implementation existed.
- Pending on a Neon feature branch: `prisma migrate dev` reporting no drift,
  `db:generate`, `LocationControllerTests`, `api:generate`, `check-types`.
