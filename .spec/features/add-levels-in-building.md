# Add levels in the building

**Status:** draft
**Owner:** Zheng Kai

Builds on [building-elevation.md](building-elevation.md).

## Problem

Levels are ordered by a whole-number position that is unique among a block's
active levels, and bulk-added floors take their floor number as their position
(L5 = 5, L6 = 6). So there is no free position between two adjacent floors.
To add a mezzanine or a forgotten floor today, a manager has to edit every
level above it, one by one, to make room. And an empty block in the building
view is a dead end: "No levels yet" with no way to add one except the
block's Actions menu.

## Behaviour

Levels are added **inside the building drawing**, not through a dialog: a
dashed "ghost" slab appears where the new floor will go, you type its name in
place, and it turns solid when saved. The Actions-menu dialogs stay as they
are (and the tree view keeps using them).

Only users who can create levels in that block (the rule that shows "Add
level"/"Add levels" in the block's Actions menu), on an active estate, see
any of the "+" controls below. Each "+" is a `Button`, quiet until
hover/focus (always visible on touch).

### Add one level in place

- "+" controls sit:
  - between every two adjacent shown slabs on the same side of the Ground
    line ("Add level between L5 and L6"),
  - on the roof edge above the top floor ("Add level above L46"),
  - under the lowest basement, or under the Ground line when there are no
    basements ("Add basement below B2" / "Add basement").
- Activating one inserts a dashed ghost slab at that spot, containing an
  `Input` labelled "New level name", focused, prefilled with a suggestion:
  above the top floor the next floor name (L47); below the lowest basement
  the next basement (B3, or B1); between two floors the lower floor's name
  plus "A" (L5A, B1A), bumping to B, C... if taken.
- Enter or the check button ("Save level") saves; Escape or the cross button
  ("Cancel") removes the ghost. Only one ghost per building at a time; opening
  another closes the first.
- While saving, the ghost shows a spinner and its controls are disabled. On
  success the ghost becomes the real slab (locations query invalidated). On
  failure it stays, with the server message in `role="alert"` under it.
- Between two floors the ghost shows the note "L6 and above move up one" (or
  "B2 and below move down one" for basements), because positions shift (see
  "Positions").
- Inside a collapsed range there are no "+" controls; expand it first.

### Add many floors in place

- Next to the roof "+", a "Build up" `Button` ("Add floors to 10") turns the
  roof into a ghost stack: an `Input` "Up to" (accepts L50 / 50, same parsing
  as `parseFloor`) and, above the real top floor, dashed preview slabs for
  every floor that will be added (grouped into ranges of 5 like real floors,
  so 40 new floors stay compact). Floors the block already has are not
  previewed. A "Add 4 floors" button confirms; Cancel/Escape discards.
- Basements work the same from the basement end ("Dig down", "Down to" B3).
- These use the existing `POST .../floors` endpoint (lowest = the floor after
  the current top, highest = the typed floor; or the basement equivalent) and
  are offered only with canCreateFloors. The 50-floor limit and "no floor 0"
  messages appear inline.

### Empty blocks

- A block with no levels draws its "No levels yet" plot as the start of a
  ghost building: "From" and "To" inputs (defaulting to L1 and empty) with
  dashed preview slabs as you type, and an "Add floors" button
  ("Add floors to <block>"). Users without canCreateFloors but with level
  creation get a single ghost slab ("New level name", suggested "L1")
  instead.
- Users who cannot create levels see only "No levels yet".

## Positions

- Above ground (the insert sits between levels with positions `p` and `p+1`,
  `p >= 1`): the new level takes `p+1`, and every active level in the block
  with position `>= p+1` moves up by one.
- Basements (between `p` and `p-1`, `p <= 0`): the new level takes `p-1`, and
  every active level with position `<= p-1` moves down by one. Above-ground
  floors never move because of a basement insert.
- If the two levels already have a free position between them (a gap), the
  new level takes the free position next to the lower level (above ground) or
  the upper level (basements), and nothing moves.
- Deactivated levels keep their positions (positions are only unique among
  active levels).
- The shift and the insert happen in one transaction, under the same estate
  lock as other location writes.

## Data

No schema change. `Location.sortOrder` values are rewritten by the shift.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/estates/{estateId}/locations/{blockId}/levels/insert` | `InsertLevelRequest { name: string, belowId: uuid, aboveId: uuid }` - the two adjacent active levels of the block it goes between | 201 `LocationResponse` (the new level) | CREATE_LOCATIONS (same as add level), active estate |

- 400: `belowId`/`aboveId` not active levels of this block, not adjacent
  (another active level sits between them), on opposite sides of the Ground
  line, or name blank / too long.
- 404: estate or block missing or in another estate.
- 409: duplicate level name in the block; estate or block deactivated.
- Server package `com.proj.server.location`: `InsertLevelRequest` record,
  `LocationService.insertLevel`, a repository method that shifts positions
  with one `UPDATE`. JUnit tests first (service logic + a
  `@SpringBootTest` controller test), then `pnpm api:generate`.

## Web

- `lib/locations.ts`: `useInsertLevel(estateId)` mutation over the generated
  client; invalidates `locationsQueryKey(userId, estateId)`.
- `block-building.tsx` gains the "+" controls; the ghost slab and ghost
  stack live in their own files beside it (`ghost-level.tsx`,
  `ghost-floors.tsx`), with name suggestion and preview helpers as pure,
  unit-tested functions. Single top/bottom adds use the existing
  `useCreateLocation`; bulk uses the existing `addBlockFloors`; between uses
  `useInsertLevel`. All invalidate the locations key.
- Focus: after save or cancel, focus returns to the "+" that opened the
  ghost (or the new slab's Actions button after a save).
- shadcn: `Button`, `Input`, `Label`, `Spinner` (all present). No dialog.
- Docs: `.docs/api/locations.md` (new endpoint) and
  `.docs/frontend/locations.md`.

## Edge cases

- Bulk "Add floors" matches existing floors by position *or* name. After an
  insert, positions no longer equal floor numbers above the insert, so a
  later "Add floors L47-L50" could skip L47 because position 47 is now held
  by L46. See open question 1.
- Two managers insert in the same block at once: the estate lock serialises
  them; the second insert sees the shifted positions and still lands between
  the two levels it names (it goes by level IDs, not positions).
- A level named in the request was deactivated or moved meanwhile: 400, the
  ghost shows the error, the refetch shows the current building.
- Inserting inside a collapsed range: not offered; expand the range first.
- Tree view: no in-place adding (it keeps the Actions menu dialogs).
- The canvas is zoomed out: ghost inputs still work; Fit to view is not
  triggered while a ghost is open, so the view does not jump.
- Canvas keyboard shortcuts (+/-/0/arrows) never fire while typing in a ghost
  input (they already ignore keys from child controls).

## Out of scope

- Reordering existing levels by drag and drop.
- Renaming levels to match new positions.
- Inserting across the Ground line, or below the lowest basement / above the
  top floor in the tree view (the existing "Add level" already appends).

## Open questions

1. Bulk "Add floors" after an insert: should it (a) match existing floors by
   **name only**, placing new floors at the next free positions in floor
   order (recommended), or (b) keep matching by position too and accept that
   it may skip floors after an insert?
