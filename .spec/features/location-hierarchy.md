# Location hierarchy

**Status:** built
**Owner:** Genghong

## Agreed Manager creation update (2026-10-19)

The user approved this API/UI scope before implementation:

- Owners and current MANAGER members can create blocks, levels and common areas
  in their assigned active estate. Manager membership in another estate is
  insufficient. Council, legacy MEMBER, Crew, Resident and unassigned users
  cannot create locations.
- Creation locks the estate before checking current authority and activation.
  Removal/demotion takes effect on the next request using the same token.
  Existing parent, hierarchy, duplicate-name and level-position rules still apply.
- A former owner retains creation access through their MANAGER membership after
  ownership transfer, including legacy owners whose membership transfer preserves.
- Location editing/deactivation remain owner-only. Estate deactivation and
  ownership transfer remain restricted to the current owner.
- The UI uses target-estate `canManageEstate` plus active-estate state for Add
  block/level/common-area controls and create dialogs. Owner-only modification
  controls are separate. Missing/loading/failed access never grants creation to
  a non-owner, and revocation closes unauthorized create dialogs.
- No endpoint, DTO, database schema or dependency is added. Update documentation
  and regenerate the API contract after documenting creation authority.

Write and observe failing HTTP/database and UI tests first, then implement the
permission change and run the full tests, type checks and formatting.

Verification: new database tests first reproduced Manager creation returning
404, and UI tests first reproduced missing Add controls. The focused Java suite
passed all 76 tests after implementation. The full workspace suite then passed,
including 565 Java tests plus web and ML. `pnpm api:generate` regenerated the
contract and frontend types; type checks and formatting passed. No schema or
dependency changes were needed.

## Problem

Estate managers describe faults and assets in free text ("the lift lobby on
level 4 of block 101"). Nothing can reference a location, so reports cannot be
pinpointed, grouped or searched.

## Behaviour

- An owner or assigned Manager can add blocks directly under an active estate.
- An owner or assigned Manager can add levels under a block. Each level has a position (`sortOrder`)
  that orders it within the block; lower is lower, basements are negative.
- An owner or assigned Manager can add common areas under a block or a level.
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
- Existing management members and Manager/Crew responders can read locations;
  only the owner can edit or deactivate them. Creation additionally permits a
  Manager assigned to the estate. Other creation callers receive 404; Resident
  membership denies management access with 403.
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
| POST | /estates/{estateId}/locations | CreateLocationRequest | 201 LocationResponse | Owner or assigned Manager; active estate |
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
- On a Neon feature branch: `prisma migrate dev` reported no drift, and
  `db:generate`, `LocationControllerTests`, `api:generate` and `check-types`
  passed.
