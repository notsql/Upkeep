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
| `LEVEL` | Level | a block | `sortOrder` ("Position", integer, unique in block; bottom-up, e.g. B1 = -1) |
| `COMMON_AREA` | Common area | a block or a level | - |

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `LocationsSection` (`estates/$estateId/-components/locations-section.tsx`) | "Locations" section. Search box (filters by name and reveals a matching hierarchy with parent context). Otherwise a nested tree (`ul aria-label="Location hierarchy"`). Owners and shared members can browse/search. Write controls and panels only when the estate has loaded, `owned` is true, and it is active. Actions per node: "Add level" (blocks), "Add common area" (blocks and levels), "Edit", "Deactivate"; plus a top "Add block" button. One Dialog at a time for create/edit/deactivate; pending submissions prevent dismissal. Blocks are distinct surfaces; branches start collapsed and whole name/count buttons expand/collapse children. Each node has an Actions DropdownMenu; search results reveal parents and retain allowed actions. Internal subcomponents: `LocationTree`, `LocationItem`, `LocationActions`, `PanelView`, `DeactivateLocation` (dialog confirmation: "It stays on record... cannot be changed or reactivated"). | `Button`, `Input`, `Label`, `DropdownMenu`, `Dialog` |
| `LocationForm` (`estates/$estateId/-components/location-form.tsx`) | Dialog form (`aria-label` = title, e.g. "Add level to Block A", "Edit Level 2"). Fields: `name` (req, max 200); `sortOrder` "Position" for levels (new levels default to `nextLevelPosition`); "Inside" parent select when editing a level or common area (options from `flattenLocations`, filtered to allowed parent types). | `Button`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` |

## Data (`lib/locations.ts`)

Type `Location` = `LocationResponse` (`id`, `name`, `type`, `parentId`,
`sortOrder`, ...). `LocationNode` adds `children` and `path` (names from the
block down).

| Hook / helper | Endpoint / purpose | Query key |
| --- | --- | --- |
| `useLocations(estateId)` | `GET /estates/{estateId}/locations` (flat list, server-ordered) | `locationsQueryKey(userId, estateId)` = `["estates", userId, "locations", estateId]` |
| `buildLocationTree(list)` | Nest by `parentId`, keeping server sibling order | - |
| `flattenLocations(list)` | Depth-first list with `path`; feeds every location select | - |
| `filterLocationTree(tree, query)` | Filter the existing tree by trimmed, case-insensitive name; retain ancestors and all descendants of matching parents. Blank search returns the full tree. Does not mutate its input. | - |
| `nextLevelPosition(list, blockId)` | Highest level `sortOrder` in the block + 1, else 1 | - |

Writes are inline `api` calls in `LocationsSection` (no mutation hooks):

| Action | Endpoint | Body |
| --- | --- | --- |
| Create | `POST /estates/{estateId}/locations` | `{ type, name, parentId?, sortOrder? (LEVEL only) }` |
| Edit | `PATCH /estates/{estateId}/locations/{id}` | `{ name, parentId?, sortOrder? (LEVEL only) }` |
| Deactivate | `POST /estates/{estateId}/locations/{id}/deactivate` | none |

After any successful write: close the dialog and invalidate
`["estates", userId, "locations", estateId]`. Errors from `estateError` are
shown in the form / confirmation dialog. No toasts.

The owner-only asset register opts into `useLocations(estateId, true)` for inactive locations. It sends `includeInactive=true` and appends `"all"` to the query key. The server restricts this option to owners. Ordinary pickers and the member-readable estate hierarchy retain active-only defaults.

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
