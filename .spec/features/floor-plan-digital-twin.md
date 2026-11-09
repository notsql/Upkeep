# Floor plan digital twin

**Status:** draft
**Owner:** Zheng Kai

## Problem

The Locations page is a text tree. A manager can see that "Block A › L3" holds
six assets, but not *where* on the floor they are, which ones are faulty, or
how to walk to them. Finding a pump room fault today means opening the asset
register, filtering by location and reading `locationPath` strings. A 2D view
of each building and floor - a light "digital twin" - lets them see the estate
the way they walk it: pick a block, pick a floor, see the equipment on it.

## Behaviour

Two new views, both read from data the app already has plus two small
additions (a floor-plan image per level, an x/y position per asset).

### Block elevation (Locations page)

- Each block on the Locations page has a "Floors" view beside the existing
  tree: a vertical stack of floor slabs, highest level first (same order as
  `buildLocationTree`), one slab per active level.
- Each slab shows the level name and its asset count (assets on the level or
  in any common area under it), and a badge counting assets whose
  `currentCondition` is `FAULTY` or `NEEDS_ATTENTION`.
- Each slab is a link (accessible name "<level name>, <n> assets") to that
  level's floor view.
- A block with no levels shows "No levels yet" in place of the stack.
- The existing tree, filters and dialogs keep working unchanged.

### Floor view (`/estates/$estateId/locations/$locationId/`)

- Only `LEVEL` locations have a floor view. Any other location ID, or a level
  from another estate, shows the standard not-found state.
- Header: level path ("Block A › L3"), with Previous / Next floor buttons that
  move one level down / up within the block; each is disabled at the ends.
- The plan surface pans (drag, scroll) and zooms (wheel, pinch, and +/-/reset
  buttons) using `react-zoom-pan-pinch`. Markers keep a constant on-screen
  size while zooming.
- Background is the level's uploaded floor-plan image when it has one;
  otherwise a neutral grid with the hint "No floor plan uploaded".
- Every active asset on the level or in its common areas that **has** a
  position is drawn as a marker at that position. Each marker is a `button`
  with accessible name "<asset name>, <condition label>" and is coloured by
  `currentCondition` (Good / Needs attention / Faulty / Unassessed), with a
  legend.
- Activating a marker (click, Enter, Space) opens a side `Sheet` with the
  asset's name, reference, category, location path, condition and a
  "View asset" link to `/estates/$estateId/assets/$assetId`.
- Assets on the level **without** a position are listed in a "Not on plan"
  panel beside the surface; the list is also the screen-reader fallback.
  Clicking one opens the same `Sheet`.
- A "Show" filter limits markers by condition; it does not change the
  "Not on plan" list.

### Editing the plan (permissioned)

- Users with canEditLocations see "Upload floor plan" (PNG/JPEG, max 10 MB)
  and, once one exists, "Replace" and "Remove". Removing a plan keeps asset
  positions.
- Users with asset-edit permission see an "Arrange" toggle. While arranging:
  - selecting an asset in "Not on plan" then clicking the plan places it there;
  - dragging a marker moves it;
  - with a marker focused, arrow keys nudge it (1% of the plan per press,
    10% with Shift);
  - "Remove from plan" on a selected marker clears its position;
  - each change saves immediately; a failed save reverts the marker and shows
    a toast.
- Positions are stored as fractions of the plan (0-1 on each axis), so they
  survive a replaced plan image of a different resolution.
- Users without these permissions never see Upload / Arrange controls, and
  the server rejects the writes regardless of the UI.

## Data

`packages/db/prisma/schema/schema.prisma`:

- `Location` gains `floorPlanStorageKey String? @unique @db.VarChar(500)`,
  `floorPlanContentType String? @db.VarChar(50)` and
  `floorPlanUpdatedAt DateTime? @db.Timestamptz(6)`. A hand-written CHECK
  allows them only on `type = 'LEVEL'` and requires all three or none.
- `Asset` gains `planX Float?` and `planY Float?`. A CHECK requires both or
  neither, each between 0 and 1.
- Moving an asset to a different level (or out of a level) clears
  `planX`/`planY` in the same update.

Images go in the existing S3-compatible bucket via a new
`FloorPlanImageStore`, mirroring `InspectionImageStore` and reusing
`ResidentImageValidator` for type/size checks. Expand-only migration (all
columns nullable), so it is safe against the running server (decision 0029).

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/locations/{id}/floor-plan` | - | 200 image bytes (`Content-Type` from the stored type, `nosniff`, private cache); 404 when none | view estate management |
| PUT | `/estates/{estateId}/locations/{id}/floor-plan` | multipart `file` | 200 `LocationResponse` | canEditLocations, active estate |
| DELETE | `/estates/{estateId}/locations/{id}/floor-plan` | - | 204 | canEditLocations, active estate |
| PUT | `/estates/{estateId}/assets/{id}/plan-position` | `{ x: number, y: number }` (0-1) | 200 `AssetResponse` | asset edit, active estate and asset |
| DELETE | `/estates/{estateId}/assets/{id}/plan-position` | - | 200 `AssetResponse` | asset edit |

Contract changes to existing DTOs:

- `LocationResponse` adds `floorPlanUpdatedAt: string | null` (the web app
  appends it as a cache-busting query on the image URL).
- `AssetResponse` adds `planX: number | null`, `planY: number | null`.

The floor's assets come from the existing
`GET /estates/{estateId}/assets?locationId={levelId}&status=ACTIVE`, which
already includes descendant common areas. No new list endpoint.

Status codes follow the existing estate conventions: 400 invalid body / file /
non-level location, 401, 404 foreign or missing, 409 inactive estate,
location or asset.

## Web

- Routes: `routes/_auth/estates/$estateId/locations/$locationId/index.tsx`
  with its parts in `$locationId/-components/` (`floor-view`, `floor-plan-surface`,
  `asset-marker`, `unplaced-assets`, `asset-sheet`, `floor-plan-upload`).
  The elevation lives in `-components/locations-section/block-elevation.tsx`.
- Hooks in `lib/floor-plans.ts`: `useFloorAssets`, `useUploadFloorPlan`,
  `useRemoveFloorPlan`, `useSetPlanPosition` (optimistic, reverts on error),
  `useClearPlanPosition`. Query keys start with the user ID. Position writes
  invalidate the floor's asset query and the asset detail query.
- The image is fetched through the authenticated client as a blob and shown
  via an object URL (the bearer token cannot ride on a plain `<img src>`).
- shadcn: `Card`, `Button`, `Badge`, `Sheet`, `ToggleGroup`, `Tooltip`,
  `Select`, `Alert`. Add any missing ones with the shadcn CLI.
- New dependency: `react-zoom-pan-pinch` (`^4.2.0`, in the catalog). Markers
  are plain SVG/DOM so Testing Library can query them by role - no canvas
  library.

## Edge cases

- A level that is deactivated: view is read-only, Upload/Arrange hidden, server
  returns 409 on writes.
- An asset moved to another level elsewhere while the floor view is open: its
  position is cleared server-side; the next refetch moves it to "Not on plan"
  of the new level and drops it from this one.
- Two arrangers drag the same marker: last write wins; no locking.
- Retired / deactivated assets are not drawn.
- Many assets at one spot: markers overlap; the "Not on plan"/legend lists and
  the Sheet remain the accessible path. No clustering in v1.
- Very large floor plans: rejected over 10 MB; no server-side resizing.
- Upload fails mid-way: previous plan stays; old object is deleted only after
  the row update commits.
- jsdom has no layout: tests drive markers via keyboard and the "place" flow
  via the store-level hook, not by pixel drags.

## Out of scope

- 3D, isometric or BIM/IFC/CAD import; drawing walls or rooms in-app.
- Geometry for common areas (zones on the plan). They are listed, not drawn.
- Live sensor overlays or animation on markers (failure-risk / flatline
  badges can come later from their existing endpoints).
- Placing assets that sit directly on a block (not on a level) - they are
  listed on the block, not on any plan.
- Resident-facing floor view.
- Marker clustering, heatmaps, multiple plans per level.

## Open questions

1. Is canEditLocations the right permission for uploading plans, or should it
   be owner-only like deactivation?
2. Should asset positioning use asset-edit permission, or be open to Managers
   who cannot edit asset details?
3. Should the elevation replace the tree as the default Locations view, or sit
   beside it (spec assumes beside, via a tree / floors toggle per block)?
4. Is a grid without an uploaded image useful enough, or should the floor view
   require a plan before Arrange is available?
