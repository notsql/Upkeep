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
| `LocationsSection` (`estates/$estateId/-components/locations-section.tsx`) | "Locations" section. Search box (filters by name, shows `path` breadcrumbs `A › B` and type). Otherwise a nested tree (`ul aria-label="Location hierarchy"`). Owners and shared members can browse/search. Write controls and panels only when the estate has loaded, `owned` is true, and it is active. Actions per node: "Add level" (blocks), "Add common area" (blocks and levels), "Edit", "Deactivate"; plus a top "Add block" button. One inline panel at a time (create / edit / deactivate) rendered under its target node. Internal subcomponents: `LocationTree`, `LocationItem`, `LocationActions`, `PanelView`, `SearchResults`, `DeactivateLocation` (inline confirm, not a dialog: "It stays on record... cannot be changed or reactivated"). | `Button`, `Input`, `Label` |
| `LocationForm` (`estates/$estateId/-components/location-form.tsx`) | Inline form (`aria-label` = title, e.g. "Add level to Block A", "Edit Level 2"). Fields: `name` (req, max 200); `sortOrder` "Position" for levels (new levels default to `nextLevelPosition`); "Inside" parent select when editing a level or common area (options from `flattenLocations`, filtered to allowed parent types). | `Button`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` |

## Data (`lib/locations.ts`)

Type `Location` = `LocationResponse` (`id`, `name`, `type`, `parentId`,
`sortOrder`, ...). `LocationNode` adds `children` and `path` (names from the
block down).

| Hook / helper | Endpoint / purpose | Query key |
| --- | --- | --- |
| `useLocations(estateId)` | `GET /estates/{estateId}/locations` (flat list, server-ordered) | `locationsQueryKey(userId, estateId)` = `["estates", userId, "locations", estateId]` |
| `buildLocationTree(list)` | Nest by `parentId`, keeping server sibling order | - |
| `flattenLocations(list)` | Depth-first list with `path`; feeds every location select | - |
| `searchLocations(list, query)` | Case-insensitive name match; empty query returns `[]` | - |
| `nextLevelPosition(list, blockId)` | Highest level `sortOrder` in the block + 1, else 1 | - |
| `locationTypeLabel` | Display labels per type | - |

Writes are inline `api` calls in `LocationsSection` (no mutation hooks):

| Action | Endpoint | Body |
| --- | --- | --- |
| Create | `POST /estates/{estateId}/locations` | `{ type, name, parentId?, sortOrder? (LEVEL only) }` |
| Edit | `PATCH /estates/{estateId}/locations/{id}` | `{ name, parentId?, sortOrder? (LEVEL only) }` |
| Deactivate | `POST /estates/{estateId}/locations/{id}/deactivate` | none |

After any successful write: close the panel and invalidate
`["estates", userId, "locations", estateId]`. Errors from `estateError` are
shown in the form / confirm panel. No toasts.
