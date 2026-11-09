# Building elevation

**Status:** built
**Owner:** Zheng Kai

A light first step towards [floor-plan-digital-twin.md](floor-plan-digital-twin.md):
draw each block as a building, using only the data the Locations page already
loads. No floor plans, no asset positions, no backend change.

## Problem

The Locations page is a text tree. A block with 46 levels reads as one row,
"10 · 46 levels · 0 common areas", and you have to expand it and scroll a list
to see how the building is laid out: where the basements are, which floors
have common areas, where a gap in the floor numbering is. Managers think of an
estate as buildings they walk, not as nested rows. A 2D elevation of each block
makes the estate recognisable at a glance and gives the page a "digital twin"
feel without the cost of real floor plans.

## Behaviour

### View toggle

- The locations card has no visible heading (the "Blocks and levels"
  heading is removed; the section keeps the accessible name "Blocks and
  levels"). A `ToggleGroup` labelled "View" with items "Building" and "Tree"
  sits top-right above the canvas. "Building" is selected when the page loads.
- The canvas fills the card edge to edge (no inner padding or second border),
  so there is no box inside a box.
- "Tree" shows the tree diagram (see "Tree view").
- While the location search has text, the card shows the tree (search results
  are tree-shaped) and the toggle is disabled. Clearing the search returns to
  the view that was selected before.
- The choice is component state only; reloading the page shows "Building".

### Building view

- Blocks are drawn side by side, wrapping on narrow screens, each as a
  building standing on a shared ground line, in the same order as the tree.
- Each building is a list with accessible name "<block name> floors". Its
  header (the "roof", a plain band with no parapet or other ornament on top)
  shows the block name, its summary ("46 levels · 0 common
  areas", same text as the tree) and the block's existing Actions menu.
- One slab per active level, highest `sortOrder` first (same order as
  `buildLocationTree`). Each slab is a list item showing the level name, and
  the names of its common areas as small chips (or nothing when it has none).
  No decorative windows or other ornament.
- Levels with `sortOrder` <= 0 (basements) sit below a ground line labelled
  "Ground", drawn with a darker fill. A block with no basements has nothing
  below the line.
- Common areas directly under the block (not on a level) are shown as chips
  on the ground line, under a "Grounds" label.
- Each slab has the existing per-level Actions menu (same items and
  permissions as in the tree), so add common area / edit / deactivate work from
  the building view and open the same dialogs. Common-area chips have no
  actions; they are edited from the tree.
- **Floor ranges.** Above and below ground are grouped separately.
  1. Pinned levels are always their own slab: the highest and lowest level
     on each side of ground, and every level with common areas.
  2. The other levels are grouped into fixed bands of 5 aligned to floor
     numbers: L1-L5, L6-L10, ... (band = ceil(position / 5)); B1-B5,
     B6-B10, ...; position 0 is its own band. A pinned level splits its
     band.
  3. A group of 2+ consecutive levels is a range; a group of 1 is a plain
     slab.
  Example, L1-L44 with a common area on L22: L44, L41-L43, L36-L40, ...,
  L26-L30, L23-L25, L22, L21, L16-L20, ..., L6-L10, L2-L5, L1. Ranges never
  contain common areas.
- A range slab is a `Button` showing "L41 – L45" and "5 levels", with
  `aria-expanded` and accessible name "Show L41 to L45". Activating it
  replaces the range with its individual slabs (each with its Actions menu),
  under a "Hide L41 to L45" button that collapses them again. Several ranges
  can be open at once. Open ranges are component state; they reset on reload
  and close when the levels in them change (a range is identified by its
  first and last level ID).
- A block with no levels is drawn as an empty plot reading "No levels yet".

### Tree view

- The tree is **not** a canvas. It is the original indented tree list (as
  before this feature: block rows with disclosure, nested levels and common
  areas, Actions menus), inside the card with normal page scrolling.
- One change: an expanded block lists its levels grouped with the same
  `floorSlabs` rule as the building view. A range is a row (a `Button`,
  "L41 – L45", "5 levels", accessible name "Show L41 to L45",
  `aria-expanded`) that expands in place to the individual level rows, each
  with its own disclosure (common areas) and Actions menu, under a
  "Hide L41 to L45" button. Grouping is the same rule as the building view,
  so common areas are never hidden inside a range.
- While searching, levels are not grouped: matching rows and their context
  show as before.
- Everything else is unchanged: list names ("Location hierarchy" / "Search
  results"), disclosure buttons and remembered expansion, Actions items and
  permissions, dialogs, empty and no-match states. Open ranges are component
  state.

### Canvas

- The building view uses a canvas region (`role="region"`, name "Estate
  canvas", focusable) filling the card body at a fixed height (about 60vh,
  min 24rem), with a dotted-grid background and no bordered box around the
  buildings themselves. Buildings float on the grid, standing on a ground
  line.
- Drag (mouse, pen or one-finger touch) on empty canvas pans. Dragging that
  starts on a button or menu does not pan, so clicks still work.
- Ctrl/Cmd + wheel and trackpad pinch zoom around the pointer; a plain wheel
  scrolls the page as usual. Zoom is clamped to 25%-200%.
- Overlay controls (bottom-right, shadcn `Button`s): "Zoom in", "Zoom out",
  "Fit to view", plus the current zoom as text. On load the canvas is fitted so
  every building is visible (never above 100%).
- Keyboard: with the canvas focused, arrow keys pan, `+`/`-` zoom, `0` fits.
- Pan/zoom is component state; it resets when the view is reopened.
- Loading, error, empty-estate and permission behaviour are the existing
  `LocationsSection` states, unchanged.

## Data

No change. Everything comes from `useLocations(estateId)` and
`buildLocationTree`.

## API

No change.

## Web

- `-components/locations-section/locations-buildings.tsx` - the row of
  buildings on the ground line.
- `-components/locations-section/block-building.tsx` - one block: roof, slabs,
  ground line, basements, grounds chips. Reuses `LocationActions` and
  `locationSummaries`.
- `locations-tree-card.tsx` gains the toggle and chooses the view;
  `use-locations-section.ts` holds the view state and the "searching forces
  tree" rule.
- shadcn: `Card`, `ToggleGroup`, `Badge` (chips), `Button`, `DropdownMenu`
  (via `LocationActions`). All already in `packages/ui`.
- No new dependency. Plain DOM + Tailwind, no canvas or SVG library, so
  Testing Library can query by role.
- Tests in `apps/web/tests/` mirroring the files above; `.docs/frontend/locations.md`
  updated in the same change.

## Edge cases

- Tall blocks or many blocks: the building view is a canvas (see "Canvas"),
  so anything larger than the viewport is reached by panning or zooming out.
- Gaps in floor numbering (L1, L2, L5): drawn as consecutive slabs; no
  placeholder floors are invented.
- A level with many common areas: chips wrap inside the slab; the slab grows.
- Very long block or level names: truncated with the full name in a `title`
  and still the full accessible name.
- Many blocks: the row wraps; each building keeps a fixed width.
- Deactivated locations are not loaded by this page, so never drawn.

## Out of scope

- Floor plan pages, uploads, asset markers, pan/zoom - all in
  [floor-plan-digital-twin.md](floor-plan-digital-twin.md).
- Asset counts or condition badges per floor (needs the assets endpoint;
  natural next step).
- Clicking a slab to navigate anywhere; isometric or 3D drawing.
- Remembering the selected view across reloads.

## Open questions

1. Resolved: searching falls back to the tree (agreed 2026-11-09).
