# Asset-centric navigation

**Status:** approved 2026-11-07
**Owner:** Ong Zheng Kai

Frontend-only UX refactor of `apps/web`. No new endpoints, no contract change,
no Prisma change. Paths below are relative to `apps/web/src/`; estate routes
are under `routes/_auth/estates/$estateId/`.

## Problem

Monitoring an asset is spread over five sidebar items (Assets, Devices,
Readings, Device monitoring, Failure risk). To answer "is this pump OK?" a
manager visits the asset, then the estate device list, then Device monitoring
(flatlines), then Failure risk, then Readings filtered to the asset. Nothing
shows an asset together with its devices, flatline state, risk and readings,
and nothing ranks every device in the estate by how urgently it needs a look.

## Behaviour

Each phase below ships as its own PR and is shippable alone. The sidebar
entries are removed last, so nothing disappears before its replacement exists.

### Phase 1 - Asset Overview becomes the monitoring home

`assets/$assetId/_details/index.tsx` (`AssetOverview`) keeps its detail card
and condition section, and gains, in this order:

- The failure-risk forecast card (`AssetForecastCard`, existing PUMP-only rule
  unchanged), shown only to owners (it calls an owner-only endpoint today).
- A **Devices** section listing the asset's devices from `useDevices(estateId,
  assetId)`: identifier, `DeviceStatusBadge`, last seen. Each active device
  also shows its flatline state per metric (Possible flatline / Paused until
  <time> / Monitoring) and, when the review entry has `canManage`, a **Pause
  for maintenance** button opening the existing `PauseSensorDialog`.
- Flatline state comes from `useFlatlineReview(estateId, "ALL", page)` pages,
  filtered client-side to this asset's device IDs.
- An **Add device** action (link to `assets/$assetId/devices/new`) shown when
  the asset is active and the viewer is the owner (same `canRegister` rule as
  `AssetDevicesSection`).
- A **Readings** section showing the latest 50 readings for this asset from
  `useEstateReadings(estateId, { assetId })` (sensor and manual, with source,
  recorder and flag badges, reusing `reading-table.tsx`), with a "View all
  readings" link to `/estates/$estateId/assets/$assetId/readings`.
- With `canRecordReadings`, a **Record manual reading** action linking to the
  manual-entry form preselected to this asset.

Decision: the per-asset readings sub-page is **linked from**, not folded into,
Overview. Overview shows the recent page only; filters, pagination and CSV
export stay on the sub-page. The sub-page is rebuilt on the estate readings
components (`useEstateReadings` with `assetId` fixed, plus `ReadingExport`),
because the legacy `GET /assets/{assetId}/readings` is owner-only while
`GET /estates/{id}/readings?assetId=` serves Owner, Manager and Crew. The old
`assets/$assetId/readings/-components/readings-page/*` is deleted.

The asset's **Devices** sub-tab stays (credentials, replace, deactivate live
there); Overview's device list links to it as "Manage devices".

Testable statements:

- Overview lists every device of the asset with its status badge.
- A device whose review entry state is flatlined shows "Possible flatline".
- Pause for maintenance appears only when the review entry has `canManage`.
- Add device appears only for the owner of an active asset.
- A failing flatline-review request shows an inline error in the Devices
  section and the device list still renders without flatline state.
- A failing readings request shows an inline error in the Readings section
  only; condition and devices still render.
- The forecast card is not mounted (no request made) for non-owners.

### Phase 2 - Assets > By location

`assets/route.tsx` (new) renders an `AssetsLayout` (same pattern as
`SensorsLayout`): `ListPageHeader` + `SubNav` "Asset views" with **By
location** (`/assets`, exact) and **All devices** (`/assets/devices`, added in
phase 3; hidden until then).

`assets/index.tsx` keeps `AssetRegisterPage`'s search, filters, sort, Create
and retired toggle, but renders rows grouped by block, then level:

- Group keys come from the asset's location in `useLocations(estateId)`:
  the top-level ancestor is the block, the next is the level. Assets located
  directly on a block go in a "Block-wide" level group; assets without a
  resolvable location go in a final "Unknown location" group.
- Groups are ordered by the location tree's `position`; within a group the
  user's chosen sort applies.
- Each row shows name/reference (link to the asset), `ConditionBadge`, a
  failure-risk flag badge when the owner's `useEstateFailureRisk` entry has
  flag reasons, and a device summary from `useEstateDevices`: "No devices",
  "2 devices online", or "1 of 2 offline" (offline + awaiting counted as not
  online; deactivated devices excluded).
- Grouping applies to desktop table and mobile cards alike.

Testable statements:

- Assets on two levels of one block render under one block heading with two
  level subheadings.
- The risk flag column is absent (and the request not made) for non-owners.
- If the failure-risk or devices request fails, the asset rows still render;
  the affected column shows "Unavailable" and one inline Alert with Retry
  names the failed source.
- While devices/risk load, those cells show a skeleton and row order does not
  change when they resolve (order depends only on asset data and sort).

### Phase 3 - Assets > All devices

New route `assets/devices/index.tsx` (`/estates/$estateId/assets/devices`,
title "All devices"). Every device in the estate from `useEstateDevices`,
joined client-side with all pages of the flatline review.

- A new hook `useAllFlatlineReview(estateId, view)` in
  `lib/flatlined-sensors.ts` loads page 0, then the remaining pages
  (`useQueries` over `totalPages`), and returns the concatenated entries plus
  a single loading/error state.
- Severity rank, worst first: **Possible flatline** (any metric of the device
  flatlined in the REVIEW view) > **Offline** > **Awaiting first reading** >
  **Online** > **Deactivated**. Ties sort by asset name, then identifier.
  Paused devices rank by their device status, with a "Paused until" badge.
- Each row: device identifier/model, asset link, location, last seen,
  `DeviceStatusBadge`, flatline badges per affected metric, and an inline
  **Pause for maintenance** (`PauseSensorDialog`) per metric when `canManage`.
- A **Metric policies** button opens a `Dialog` containing the existing
  `MetricPolicySettings` (read-only for Council/inactive estates, as today).
- Refreshes every 60 seconds (as `/devices` does today).
- `sensors/-components/*` used here move to `assets/devices/-components/`;
  `devices/` and `sensors/` route folders are deleted in phase 4.

Testable statements:

- A flatlined online device sorts above an offline device.
- Offline sorts above Awaiting first reading, above Online, above Deactivated.
- With 30 review entries (2 pages) a flatline on page 2 still shows.
- A failed flatline request shows an inline Alert with Retry; devices still
  render ranked by device status alone, and rows do not reorder later until
  the user retries (rank is computed once both sources settle).
- Metric policies opens a dialog listing every metric.

### Phase 4 - Sidebar cleanup and redirects

- New folder routes `readings/$assetId/index.tsx` (that asset's readings,
  reusing the `/readings` browser with the asset fixed; the API call still
  sends `assetId` as a query param) and `readings/$assetId/new/index.tsx`
  (manual entry with the asset fixed). Same gates as `/readings` and
  `/readings/new`. Existing `?assetId=` links redirect to the path form.
- Work order detail (linked asset only) gains "View readings" and "Record
  reading" links to those routes, so Crew reach readings without the
  sidebar item (Open question 1).

- Sidebar Assets group: Locations, Assets. Devices, Readings, Device
  monitoring and Failure risk are removed.
- Redirects (`beforeLoad` `redirect`, `replace: true`):

| Old URL | New URL |
| --- | --- |
| `/devices` | `/assets/devices` |
| `/sensors`, `/sensors/all` | `/assets/devices` |
| `/failure-risk` | `/assets` (By location, which shows risk flags) |
| `/readings?assetId=…` | `/readings/$assetId` |
| `/readings` | kept, not redirected (Open question 1) |
| `/readings/new?assetId=…` | `/readings/$assetId/new` |
| `/readings/new` | unchanged (manual entry stays where it is) |

- `canOpenAssets` and the `_auth` guard admit the union of today's audiences
  (see table); each source inside a view is mounted only when its own
  predicate holds, so no view issues a request its viewer would get 403/404
  for.
- `estateDestination(…, "readings")` maps to the new readings location.

Role x view after phase 4 (O = owner, M = Manager member, C = Council,
Cr = Crew, I = inspection-only reader):

| What | O | M | C | Cr | I | Today's source |
| --- | --- | --- | --- | --- | --- | --- |
| Assets > By location (list) | yes (full) | as I | no | as I | yes (no device/risk cols) | `canOpenAssets` |
| Risk flag column / forecast card | yes | no | no | no | no | `canOpenFailureRisk` |
| Device summary column | yes | yes | no | no | no | devices list: owner/MANAGER |
| Assets > All devices | yes | yes | yes, read-only (OQ2) | no | no | `canOpenDevices` ∪ `canOpenSensors` |
| Metric policies (edit) | yes | yes | read only | no | no | review `canManage` |
| Asset Overview devices + flatline | yes | yes | ? (OQ2) | no | no | asset devices: owner/MANAGER |
| Asset Overview readings | yes | yes | no | ? (OQ3) | no | `canViewReadings` |
| Readings `/readings` (filtered by asset) | yes, linked from Assets | yes, linked from Assets | - | via work-order link only | - | `canOpenReadings` |
| Manual reading entry `/readings/new` | yes | yes | no | yes | no | `canRecordReadings` (unchanged) |

No role may lose a capability it has today; where the table has "?" the
current page is kept reachable until the human decides.

## Data

None. No Prisma model is added or changed.

## API

None added or changed. Endpoints consumed, all existing:

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/assets` | filters | `AssetResponse[]` (paged) | `canViewAssets` |
| GET | `/estates/{estateId}/locations` | - | location tree | `canViewManagement` |
| GET | `/estates/{estateId}/devices` | - | `EstateDeviceResponse[]` | owner or MANAGER |
| GET | `/estates/{estateId}/assets/{assetId}/devices` | - | `DeviceResponse[]` | owner or MANAGER |
| GET | `/estates/{estateId}/flatlined-sensors` | `view`, `page`, `size=25` | `FlatlineReviewResponse` | owner, MANAGER, COUNCIL (read) |
| GET/PUT | `/estates/{estateId}/flatline-policies[/{metric}]` | `SetFlatlinePolicyRequest` | policies | read as above; write owner/MANAGER |
| POST | `/estates/{estateId}/devices/{deviceId}/flatline-pauses/{metric}` | `CreateFlatlinePauseRequest` | `FlatlinePauseResponse` | owner/MANAGER |
| GET | `/estates/{estateId}/failure-risk` | - | `FailureRiskResponse[]` | owner |
| GET | `/estates/{estateId}/assets/{assetId}/failure-risk` | - | `FailureRiskResponse` | owner |
| GET | `/estates/{estateId}/readings` | `assetId`, filters, page | reading page | Owner, Manager, Crew |
| GET | `/estates/{estateId}/readings/export` | filters | CSV | Owner, Manager, Crew |

Hooks stay in `lib/devices.ts`, `lib/flatlined-sensors.ts`, `lib/readings.ts`,
`lib/failure-risk.ts`, `lib/locations.ts`; the only new hook is
`useAllFlatlineReview`. Grouping, ranking and device summaries are pure
functions in a new `lib/asset-monitoring.ts` (unit-tested). Query keys are
unchanged; the pause mutation's existing invalidation of the flatline review
key refreshes both Overview and All devices.

## Edge cases

- **Partial failure:** each source (assets, locations, devices, flatline,
  risk, readings) has its own loading and error state. Only an assets-request
  failure blanks the list; any other failure degrades a column/section and
  shows an Alert with Retry.
- **No reordering while loading:** By location sorts only on asset data;
  All devices computes rank once devices and flatline review have both
  settled (success or error), showing a table skeleton until then.
- **Paging race:** review pages fetched separately can shift if entries change
  between requests; duplicates are dropped by `deviceId + metric`.
- **Many review pages:** an estate with N entries makes ceil(N/25) requests;
  acceptable for current estate sizes (see Open question 5).
- **Retired assets / deactivated devices:** retired assets keep their
  "Retired" badge and group; deactivated devices rank last and get no actions.
- **Inactive estate:** reads work; Add device, Pause and policy edits hidden,
  matching today.
- **Device location differs from asset location:** All devices shows both,
  as `/sensors` does today.
- **Old bookmarks** land on the replacement view via redirect, never a 404,
  for any viewer who could open the old page.
- **Inspection-only viewers** keep `InspectionAssetPage`; none of the new
  sections mount for them.

Tests first: every statement above becomes a Vitest + Testing Library test
under `apps/web/tests/` mirroring `src/` (e.g.
`tests/routes/_auth/estates/$estateId/assets/devices/index.test.tsx`,
`tests/lib/asset-monitoring.test.ts`), written and seen failing before the
implementation. UI is built from `packages/ui` shadcn components with
folder-based routes. Each phase updates `.docs/frontend/` (assets.md,
devices.md, flatlined-sensors.md, readings.md, failure-risk.md, shell.md) and
`.docs/README.md`.

## Out of scope

- User-defined device groups (a later, separate spec).
- Re-ranking All devices on refresh. Rows keep their first ranked order;
  polling updates cells in place. A "devices changed status - Re-sort"
  notice is a later, separate change.
- Any new or changed endpoint, including an asset-scoped flatline query or a
  device-summary field on the asset list.
- A separate "Needs attention" view; severity triage lives in All devices.
- A Monitoring tab on asset details; Overview is the monitoring home.
- Changing who may call any endpoint.
- Changing manual-entry or CSV export behaviour.
- Live push updates (polling stays as today).

## Open questions (all resolved)

1. **Resolved: Crew reach readings through their work orders.** A work order
   detail with a linked asset shows "View readings"
   (`/estates/$estateId/readings/$assetId`, when `canViewReadings`) and
   "Record reading" (`/estates/$estateId/readings/$assetId/new`, when
   `canRecordReadings`). The asset is a path segment, not a search param.
   Crew get no Readings sidebar item and no All devices view. `/readings`
   stays (not redirected) for estate-wide browsing and CSV export by
   owners/Managers, linked from Assets.
2. **Resolved: Council** sees All devices built from the flatline review
   alone (no device status or last seen), read-only.
3. **Resolved: only owners get the full asset view.** `canViewAssets` is
   owner-only (`AccessService`), and stays so: no access widening in this
   spec. Managers and Crew reach Assets only through inspection access
   (`canViewInspectionResults`) and see the inspection-reader view (I). So
   Crew cannot reach readings by clicking an asset; they use the work-order
   links in Open question 1.
4. **Resolved: failure risk stays owner-only.**
5. **Resolved: loading every review page** one request at a time is accepted
   for current estate sizes; a larger page size or asset filter is a later
   backend spec if needed.
