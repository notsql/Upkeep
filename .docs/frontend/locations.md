# Locations (frontend)

An estate's location hierarchy: blocks, levels and common areas. Paths are
relative to `apps/web/src/`.

## Routes

No route of its own. `LocationsSection` renders inside the estate details page
at `/estates/$estateId` (`routes/_auth/estates/$estateId/index.tsx`,
see [estates.md](estates.md)). Location pickers also appear in the asset and
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
| `LocationsSection` (`estates/$estateId/-components/locations-section.tsx`) | "Locations" section. Search box (filters by name and reveals a matching hierarchy with parent context). Otherwise a nested tree (`ul aria-label="Location hierarchy"`). Owners and shared members can browse/search. Creation controls require a loaded active estate and ownership or target-estate `canManageEstate`; edit/deactivate require ownership. Owners get "Add levels" (blocks: opens `AddLevelsTabs`); assigned Managers get "Add level" (blocks: opens `LocationForm`). Both get "Add common area" (blocks and levels) and a top "Add block" button. Only owners get "Edit" and "Deactivate". One Dialog at a time for create/edit/deactivate; pending submissions prevent dismissal. Blocks are distinct surfaces; branches start collapsed and whole name/count buttons expand/collapse children. Each node has an Actions DropdownMenu; search results reveal parents and retain allowed actions. State, queries and writes only; the pieces below live beside it in the same `-components/` folder. | `Alert`, `Button`, `Input`, `Label`, `DropdownMenu`, `Dialog` |
| `LocationTree`, `LocationItem`, `LocationActions`, `locationSummaries` (`estates/$estateId/-components/location-tree.tsx`) | The nested tree or search results, each node's disclosure button and count summary ("2 levels · 3 common areas"), and its Actions DropdownMenu, which opens a dialog by passing a `Panel`. | `Button`, `DropdownMenu` |
| `Panel`, `panelTitle`, `dialogDescription` (`estates/$estateId/-components/location-panel.ts`) | Which dialog is open (`create` block/level/common area, `edit`, owner-only `levels`, `deactivate`) and its title and description. | - |
| `PanelView` (`estates/$estateId/-components/location-panel-view.tsx`) | Picks the dialog body for the open `Panel`: `LocationForm`, `AddLevelsTabs` or `DeactivateLocation`; `parentOptions` lists where an edited location may move. | - |
| `DeactivateLocation` (`estates/$estateId/-components/deactivate-location.tsx`) | Deactivation confirmation: "It stays on record... cannot be changed or reactivated". | `Button` |
| `AddLevelsTabs` (`estates/$estateId/-components/add-levels-tabs.tsx`) | Body of the "Add levels to {block}" dialog. shadcn `Tabs`, default tab "Range of floors" (`AddFloorsForm`), alternative tab "One custom level" (`LocationForm` titled "Add level to {block}", position defaulting to `nextLevelPosition`). Hidden tab content is unmounted. | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` |
| `AddFloorsForm` (`estates/$estateId/-components/add-floors-form.tsx`) | Form "Add floors to {block}" (ID-99), in the "Range of floors" tab. Fields "Lowest floor" and "Highest floor" accept `B2`, `L25` or a bare number (above ground); no floor 0; at most `MAX_FLOORS` (50). Previews the floors highest first in `ul aria-label="Floors to add"`, marking ones the block already has (same position or name among its active levels) as "already exists, will be skipped". On success it stays open and shows a `role="status"` summary of created and skipped names with a "Done" button that closes the dialog. Errors from `estateError` show in `role="alert"`; the range is kept. | `Button`, `Input`, `Label` |
| `LocationForm` (`estates/$estateId/-components/location-form.tsx`) | Dialog form (`aria-label` = title, e.g. "Add level to Block A", "Edit Level 2"). Fields: `name` (req, max 200); `sortOrder` "Position" for levels (new levels default to `nextLevelPosition`, including the Manager single-level form); "Inside" parent select when editing a level or common area (options from `flattenLocations`, filtered to allowed parent types). | `Button`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` |

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

Locations is a `section-surface` within estate overview, with `id="locations"`
and scroll margin for the sticky header. It has no separate desktop/mobile
navigation destination; users reach it within Overview. Direct #locations links
remain valid and keep Overview selected. Block groups, labelled expandable branches and compact Actions menus keep the
hierarchy readable on narrow screens. Dialogs return focus to the node menu,
falling back to Add block after removal. Server ordering and authorization stay the same; search now reveals hierarchy context.
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
