# Locations (frontend)

An estate's location hierarchy: blocks, levels and common areas. Paths are
relative to `apps/web/src/`.

## Routes

`/estates/$estateId/locations` (`routes/_auth/estates/$estateId/locations/index.tsx`,
title "Locations") renders `LocationsPage`
(`locations/-components/locations-page.tsx`): `PageLayout` + `PageHeader`
("Locations") + `LocationsSection`. Sidebar: Assets > Locations, shown when
`canViewManagement`. Location pickers also appear in the asset and
device forms (see [assets.md](assets.md), [devices.md](devices.md)).

## Hierarchy rules the UI enforces

| Type | Label | Allowed parent | Extra field |
| --- | --- | --- | --- |
| `BLOCK` | Block | none (top level); never moved | - |
| `LEVEL` | Level | a block | `sortOrder` ("Position", integer, unique in block; bottom-up, e.g. B1 = -1). Shown highest first in the tree and pickers. |
| `COMMON_AREA` | Common area | a block or a level | - |

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `LocationsSection` (`estates/$estateId/-components/locations-section/locations-section.tsx`) | The whole Locations page body (the page is just `PageLayout` + this). Renders `ListPageHeader` "Locations" (`icon={MapPin}`, no description) with the Filters toggle and, with canCreateLocations, `CreateButton` "Create" (`onClick` opens the "Add block" dialog; it has an `id` so closing that dialog returns focus to it). Below, the retractable `FilterBar` "Filter locations" (collapsed by default; search filters by name and reveals a matching hierarchy with parent context; "1 active" and its ghost Clear filters), then the "Blocks and levels" card (`SectionHeading` with a Building icon). Loading is `LoadingState` "Loading locations…"; a failed load is `ErrorState` + Retry; no locations is `EmptyState` "No locations yet" (description "Use Create to add the first block" when the user can create; no action - the header Create is the entry point); no search match is `EmptyState` "No matching locations" with an outline Clear filters. Otherwise the building view (default) or, via the "View" toggle and always while searching, a nested tree (`ul aria-label="Location hierarchy"`); see `LocationsTreeCard`. Owners and shared members can browse/search. Creation controls require a loaded active estate and canCreateLocations; bulk levels use canCreateFloors; editing uses canEditLocations; deactivation requires ownership. Owners get "Add levels" (blocks: opens `AddLevelsTabs`); assigned Managers get "Add level" (blocks: opens `LocationForm`). Both get "Add common area" (blocks and levels) and the header Create (add block). Owners and custom EDIT_LOCATIONS get "Edit"; only owners get "Deactivate". One Dialog at a time for create/edit; deactivation is its own `ConfirmDialog`; pending submissions prevent dismissal. Blocks are distinct surfaces; branches start collapsed and whole name/count buttons expand/collapse children. Each node has an Actions DropdownMenu; search results reveal parents and retain allowed actions. It composes `locations-filters.tsx`, `locations-tree-card.tsx` and `locations-dialog.tsx`; state and handlers live in `use-locations-section.ts`, and its update, add-floors and deactivate requests are `updateLocation`, `addBlockFloors` and `deactivateLocation` in `lib/locations.ts`. The pieces below live beside it in `-components/locations-section/` (the add-floors and location forms in their own subfolders). | `Alert`, `Button`, `Input`, `Label`, `DropdownMenu`, `Dialog` |
| `LocationTree`, `LocationItem`, `LocationActions`, `locationSummaries` (`estates/$estateId/-components/locations-section/location-tree.tsx`, `location-item.tsx`) | The tree view: the original indented list (`ul aria-label="Location hierarchy"`, or "Search results" while searching) inside the card (`px-4 pb-4`, normal page scrolling). Each node's disclosure button and count summary ("2 levels · 3 common areas"), and its Actions DropdownMenu, which opens a dialog by passing a `Panel`. An expanded block (not while searching) lists its levels grouped by `floorSlabs` in place of the plain level rows; its own common areas keep their rows. A band of 2+ levels is a range row: a ghost `Button` (`bg-muted/40`) reading "L41 – L45" and "5 levels" with a chevron, `aria-expanded` and name "Show L41 to L45"; activating it renders the normal `LocationItem` rows for those levels (own disclosure and Actions) under a "Hide L41 to L45" button. Open ranges are a `Set` of `<firstId>:<lastId>` in the block item's state; they reset on remount. While searching nothing is grouped. | `Button`, `DropdownMenu` |
| `LocationsTreeCard` (`estates/$estateId/-components/locations-section/locations-tree-card.tsx`) | The locations card: a `section aria-label="Blocks and levels"` (`id="locations"`) with no visible heading, filling a `Card` with no padding (`py-0 gap-0 overflow-hidden`) so the canvas sits edge to edge. A top bar (`border-b`) holds, right-aligned, a `ToggleGroup` `aria-label="View"` with items "Building" (selected on load) and "Tree". Shows `LocationsBuildings` for "Building" and `LocationTree` for "Tree"; empty-estate and no-match states always come from `LocationTree`. The choice is `useLocationsSection`'s `view` (plain component state, reset to "Building" on remount); while the search has text `view` is forced to "tree" and the toggle is disabled, and clearing the search returns to the chosen view. | `Card`, `ToggleGroup`, `ToggleGroupItem` |
| `LocationsBuildings` (`estates/$estateId/-components/locations-section/locations-buildings.tsx`) | The building view, drawn inside `CanvasShell` (`canvas-shell.tsx`, which owns the canvas section, the transformed layer and the zoom controls): a focusable `section aria-label="Estate canvas"` (`h-[60vh] min-h-96`, dotted-grid background from `--border`, `touch-none`). An inner layer (`transform: translate() scale()`, origin top-left) holds every block side by side in tree order, as 18rem grid columns (`grid-flow-col`, two rows), so each `BlockBuilding` subgrid stands on one shared, continuous ground line. Pan/zoom comes from `useCanvasView` (`use-canvas-view.ts`, plain component state, reset on remount): pointer drag on empty canvas pans (pointer capture; drags starting on `button, a, input, [role=menuitem]` are ignored); Ctrl/Cmd + wheel or pinch zooms around the pointer (plain wheel is not captured); zoom is clamped to 25%-200% (`clampZoom`, `zoomAround`). On load, and on content resize until the user moves the view, it fits all buildings centred, never above 100% (`fitView`, measured with a `ResizeObserver`; without layout it stays at 100% at the origin). Bottom-right overlay: outline icon `Button`s "Zoom out", "Zoom in" (±25% around the centre), "Fit to view", and the zoom percent (`aria-live="polite"`). Keyboard on the focused canvas itself (not on child controls): arrows pan 40px, `+`/`=` and `-` zoom, `0` fits. | `Button` |
| `BlockBuilding` (`estates/$estateId/-components/locations-section/block-building.tsx`) | One block as a 2D elevation, no ornament. Plain roof band: block name (`font-semibold`, truncated, full name in `title`), the `locationSummaries` text (muted, `text-xs`) and the block's `LocationActions`. Body `bg-card`, solid border, rounded top, rows divided by `border-border/60`. `ul aria-label="<block> floors"` holds the rows for levels with `sortOrder > 0`, highest first, grouped by `floorSlabs` (`floor-slabs.ts`): the highest and lowest level on each side of ground and every level with common areas are pinned as their own slab; the rest fall into fixed bands of 5 aligned to floor numbers (L1-L5, L6-L10, ...; basements B1-B5, B6-B10, ...; position 0 its own band), split by pinned levels. A group of 2+ is a range, a group of 1 a plain slab, so ranges never contain common areas (L1-L44 with an area on L22: L44, L41-L43, L36-L40, ... L23-L25, L22, L21, L16-L20, ... L2-L5, L1). Every row has the same `min-h-9`, `py-1.5` rhythm. A slab is `li aria-label=<level name>`: name in `text-sm font-medium tabular-nums`, its common areas as `Badge variant="secondary"` chips in `ul aria-label="<level> common areas"`, and its `LocationActions` (shown when canEdit or canCreate). A closed range is a ghost `Button` (`bg-muted/40`) reading "L41 – L45" (`rangeEnds`: nearest ground first, so basements read "B1 – B5") and "5 levels" with a chevron; `aria-expanded=false`, name "Show L41 to L45". Activating it shows a "Hide L41 to L45" button (`aria-expanded=true`) above `ul aria-label="L41 to L45 floors"` with its slabs, grouped by a left accent border. Open ranges are a `Set` of `<firstId>:<lastId>` in component state; several may be open; they reset on remount and close when the range's levels change. Actions menus stay in the DOM but are visually quiet (`QUIET_ACTIONS`: `opacity-0`, shown on group hover/focus-within and always on `hover:none` touch devices). Then the "Ground" line; levels with `sortOrder <= 0` (banded the same way) in `ul aria-label="<block> basements"` with `bg-muted`, muted text, dashed sides and rounded bottom; block-level common areas as chips in `ul aria-label="<block> grounds"` under a "Grounds" label. A block with no levels is a short plot: roof plus one compact `h-9` "No levels yet" row, bottom-aligned on the ground line (no "Ground" label). Chips have no actions. | `Badge`, `Button`, `DropdownMenu` (via `LocationActions`) |
| `Panel`, `panelTitle`, `dialogDescription` (`estates/$estateId/-components/locations-section/location-panel.ts`) | Which dialog is open (`create` block/level/common area, `edit`, `levels` gated by canCreateFloors, `deactivate`) and its title and description. | - |
| `PanelView` (`estates/$estateId/-components/locations-section/location-panel-view.tsx`) | Picks the dialog body for the open `Panel`: `LocationForm` or `AddLevelsTabs` (in-dialog shadcn Tabs "Range of floors" / "One custom level" - tabs are fine inside a dialog); `deactivate` renders nothing here; `parentOptions` lists where an edited location may move. | - |
| `DeactivateLocation` (`estates/$estateId/-components/locations-section/deactivate-location.tsx`) | `ConfirmDialog` "Deactivate <name>?": "It stays on record... cannot be changed or reactivated", destructive "Deactivate" / "Deactivating…", errors as an alert line. Rendered by `LocationsSection` for a `deactivate` panel. | `ConfirmDialog` |
| `AddLevelsTabs` (`estates/$estateId/-components/locations-section/add-levels-tabs.tsx`) | Body of the "Add levels to {block}" dialog. shadcn `Tabs`, default tab "Range of floors" (`AddFloorsForm`), alternative tab "One custom level" (`LocationForm` titled "Add level to {block}", position defaulting to `nextLevelPosition`). Hidden tab content is unmounted. | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| `AddFloorsForm` (`estates/$estateId/-components/locations-section/add-floors-form/add-floors-form.tsx`) | Form "Add floors to {block}" (ID-99), in the "Range of floors" tab. Fields "Lowest floor" and "Highest floor" accept `B2`, `L25` or a bare number (above ground); no floor 0; at most `MAX_FLOORS` (50). Previews the floors highest first in `ul aria-label="Floors to add"`, marking ones the block already has (same position or name among its active levels) as "already exists, will be skipped". On success it stays open and shows a `role="status"` summary of created and skipped names with a "Done" button that closes the dialog. Errors from `estateError` show in `role="alert"`; the range is kept. Sections: `add-floors-range-fields.tsx`, `add-floors-preview.tsx`, `add-floors-summary.tsx`; state in `use-add-floors-form.ts`, range checking and `AddFloorsResult` in `add-floors-range.ts`. | `Button`, `Input`, `Label` |
| `LocationForm` (`estates/$estateId/-components/locations-section/location-form/location-form.tsx`) | Dialog form (`aria-label` = title, e.g. "Add level to Block A", "Edit Level 2"). Fields: `name` (req, max 200); `sortOrder` "Position" for levels (new levels default to `nextLevelPosition`, including the Manager single-level form); "Inside" parent select when editing a level or common area (options from `flattenLocations`, filtered to allowed parent types). Position and Inside fields are `location-form-position-field.tsx` and `location-form-parent-field.tsx`. | `Button`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` |

## Data (`lib/locations.ts`)

Type `Location` = `LocationResponse` (`id`, `name`, `type`, `parentId`,
`sortOrder`, ...). `LocationNode` adds `children` and `path` (names from the
block down).

| Hook / helper | Endpoint / purpose | Query key |
| --- | --- | --- |
| `useLocations(estateId)` | `GET /estates/{estateId}/locations` (flat list, server-ordered) | `locationsQueryKey(userId, estateId)` = `["estates", userId, "locations", estateId]` |
| `buildLocationTree(list)` | Nest by `parentId`, keeping server sibling order except levels, which are listed highest floor first (… L2, L1, B1, B2 …) | - |
| `flattenLocations(list)` | Depth-first list with `path`; feeds every location select | - |
| `filterLocationTree(tree, query)` | Filter the existing tree by trimmed, case-insensitive name; retain ancestors and all descendants of matching parents. Blank search returns the full tree. Does not mutate its input. | - |
| `nextLevelPosition(list, blockId)` | Highest level `sortOrder` in the block + 1, else 1 | - |
| `parseFloor(text)` / `floorName(floor)` / `floorRange(lowest, highest)` / `MAX_FLOORS` | Floor text ("B2", "L25", "25") to a number and back (`L<n>` / `B<n>`), every floor highest first without 0, and the 50-floor limit | - |

`parseFloor` rejects numbers outside JavaScript's safe integer range, including
values that overflow to infinity. `floorRange` checks the floor count before
building the preview, excluding floor 0, and returns `undefined` for ranges over
50. The form shows its existing limit message without expanding a large range.

Creation uses `useCreateLocation` from `lib/locations.ts`. Edit/deactivate remain
inline `api` calls in `LocationsSection`:

| Action | Endpoint | Body |
| --- | --- | --- |
| Create | `POST /estates/{estateId}/locations` | `{ type, name, parentId?, sortOrder? (LEVEL only) }` |
| Edit | `PATCH /estates/{estateId}/locations/{id}` | `{ name, parentId?, sortOrder? (LEVEL only) }` |
| Deactivate | `POST /estates/{estateId}/locations/{id}/deactivate` | none |
| Add floors | `POST /estates/{estateId}/locations/{blockId}/floors` | `{ lowestFloor, highestFloor }` |

After any successful write: close the dialog and invalidate
`["estates", userId, "locations", estateId]`. Add floors invalidates the same
key but keeps the dialog open to show its result until "Done". Errors from `estateError` are
shown in the form / confirmation dialog. No toasts.

Creation requires a loaded active estate plus ownership or that estate's
`canManageEstate`. Non-owner creation controls stay hidden while access is
loading or unavailable. Council/Member/Crew/Resident/unassigned users and
Managers assigned only elsewhere get no creation controls. Creation dialogs
close when the cached access projection revokes permission; the API rechecks on
submission. Former owners retain creation through their MANAGER membership after
transfer. Location edit/deactivate, bulk-floor creation and estate deactivation remain owner-only. Manager level creation opens the single-level form directly, with its parent block and next position prefilled; common-area leaf rows have no empty Actions menu for Managers.

The owner-only asset register opts into `useLocations(estateId, true)` for inactive locations. It sends `includeInactive=true` and appends `"all"` to the query key. The server allows this option for owners and current MANAGER/CREW responders. Ordinary pickers and the member-readable estate hierarchy retain active-only defaults.

## Dashboard presentation

Locations has its own page; `LocationsSection` is a shadcn `Card` (section
named "Blocks and levels", no visible heading, `id="locations"`) with the search box and tree. Every
create/edit form opens in a `Dialog` (deactivation in a `ConfirmDialog`) from a
button (header Create, the node Actions menu); nothing is edited inline. Block groups, labelled expandable branches and compact Actions menus keep the
hierarchy readable on narrow screens. Dialogs return focus to the node menu; for a block
created from the header, focus follows the dialog's default. Server ordering and authorization stay the same; search now reveals hierarchy context.
Shared form/dialog colors and control sizes follow
[design-system.md](design-system.md).

## Counts, disclosure and search state

Block subtitles show their immediate level count and all common areas within the
block, including areas nested under levels. Level subtitles show their common-area
count; leaf areas retain Common area. Counts use the full active-location tree,
so filtering does not reduce them. Singular/plural and zero counts are explicit.
Successful create/edit/deactivate still invalidate the same locations key; refreshed
records update these summaries automatically.

Nonempty block/level rows are shadcn Buttons spanning the arrow, name and subtitle,
with aria-expanded/aria-controls and a native keyboard/touch activation target.
The Actions menu remains a sibling, so opening it does not change disclosure.
Empty branches have no fake expand action. Collapsed children are not mounted,
reducing initial DOM work for larger estates.

Location expansion is UI-only React Query data, key
`[userId, "location-expansion", estateId]`, with skipToken, enabled false,
initial empty IDs, staleTime/gcTime Infinity. It makes no request and survives
route unmounts within the current router's lifetime. Each account/estate starts
with independent collapsed state; revisiting restores its manual choices.
Reloading the app resets these choices. The existing per-router QueryClient
preserves SSR/account isolation; no local/session storage is added.

Name search remains trimmed and case-insensitive. Matching rows and ancestors
appear in a filtered nested Search results list, automatically open while search
is active. Matching a block or level includes its descendants. Context rows have
no collapse control while searching, so matches stay visible. Clearing search
restores manual disclosure choices. The previous separate flat SearchResults
component and its obsolete flat-search helper were removed. `filterLocationTree`
filters the already-built tree directly, without rebuilding/flattening it or
constructing a set of matching IDs. Summaries use the unfiltered tree. The dialog
header and form accessible name share the same `panelTitle` helper.

## Custom estate permissions

LocationsSection resolves the exact estate's canCreateLocations, canCreateFloors
and canEditLocations independently from canManageEstate. CREATE_LOCATIONS
shows Create (add block), Add common area and Add levels (including bulk floors).
EDIT_LOCATIONS shows rename/move controls without creation. EDIT_ESTATE alone
shows neither. Deactivation remains current-owner-only. All mutation controls
require a loaded active estate; an open panel disappears when its capability is
revoked. LocationTree receives the separate capabilities recursively. Existing
preset Manager creation and owner-only bulk/edit/deactivation behavior is
preserved. Query keys and invalidations are unchanged. Custom report readers
also use historical locations for filters/correction without gaining writes.
