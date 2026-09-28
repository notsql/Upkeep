# Asset search and details

**Status:** draft
**Owner:** Zheng Kai
**Jira:** [ID-47](https://notjira.atlassian.net/browse/ID-47) (epic [ID-4](https://notjira.atlassian.net/browse/ID-4) Unified Asset Record)

## Problem

Once an estate has more than a handful of assets, a managing agent cannot find
the equipment that needs investigating, or see its state at a glance.

## Behaviour

- An estate's asset register lists its assets, active only by default. There
  are also inactive and all filters.
- Search matches the name or the reference, case-insensitively and as a
  substring.
- The list can be filtered by:
  - category
  - location, where choosing a block or level includes everything beneath it
  - condition
- Filters combine with AND.
- Each row shows the reference, name, category, location path and condition.
- Every asset has a condition: GOOD, FAIR, POOR, FAILED or UNKNOWN. New assets
  start as UNKNOWN. The owner can set the condition on the edit form until work
  orders (ID-2) take it over.
- The detail page shows the asset's fields, its current condition, its
  maintenance history and its total recorded cost. Until ID-2 exists, history
  is always empty and cost is absent. The page says "No work orders yet".
- Only users authorised for the estate can list or view its assets. Anyone else
  gets 404.

## Data

Add `condition` (varchar(20), default `UNKNOWN`) to `Asset`, and add
`@@index([estateId, category])`. Nothing else changes. History and costs will
come from ID-2's tables.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/assets | Optional `q`, `category`, `locationId`, `condition`, and `status` = ACTIVE/INACTIVE/ALL | AssetResponse[] | Owner, or estate-access reader |
| GET | /estates/{estateId}/assets/{id} | - | AssetResponse | Owner, or estate-access reader |

`AssetResponse` gains three fields:
- `condition`
- `maintenanceHistory`: an array, always `[]` for now
- `totalRecordedCost`: a nullable number, always null for now

`CreateAssetRequest` and `UpdateAssetRequest` accept an optional `condition`.

## Edge cases

- An empty result is `[]`, not an error. The UI tells "no assets yet" apart
  from "nothing matches these filters".
- A `locationId` from another estate returns 404. A deactivated location can
  still be used as a filter.
- The descendant filter uses a recursive CTE over `Location` in a single query.
- Unknown `category`, `condition` or `status` values return 400.
- The query key includes the user ID, the estate ID and every filter.
- The search input is debounced so each keystroke does not send a request.

## Out of scope

- Search across estates, pagination and sorting by column. Revisit at
  thousands of assets per estate.
- Recording maintenance or costs (ID-2).
- Condition being changed automatically by work orders (ID-2).

## Dependencies

- [building-assets](building-assets.md) and
  [asset-location-picker](asset-location-picker.md). The location filter reuses
  the picker.
- Read access for non-owners uses `feat/scope-users-to-estate`'s `EstateAccess`
  once it merges. Until then, access is owner-only through `findOwned`.

## Implementation phases

### 1. Data
- [ ] Add `condition` and the index to `Asset`.
- [ ] `pnpm db:migrate`, then `pnpm db:generate`, then compile.

### 2. Server tests (red)
Add these cases to `AssetControllerTests`:
- [ ] `q` matches the name and the reference, case-insensitively.
- [ ] The `category`, `condition` and `status` filters each work. Combined
  filters AND together.
- [ ] `locationId` on a block returns the assets on its levels and in its
  common areas.
- [ ] An empty result is `[]`. A foreign `locationId` returns 404. Bad enum
  values return 400.
- [ ] Another owner's estate returns 404.
- [ ] The detail has `condition: UNKNOWN`, `maintenanceHistory: []` and
  `totalRecordedCost: null`. Create and PATCH accept `condition`.
- [ ] If estate access has merged: a granted reader can list and view, but
  cannot create, edit or deactivate.
- [ ] Confirm the tests fail.

### 3. API (green)
- [ ] The list endpoint with `@RequestParam(required = false)` params, and
  `AssetResponse` gains its three fields.
- [ ] Read scope reuses the estate-access helper if it exists, otherwise
  `findOwned`.
- [ ] Make the tests pass, then run `pnpm api:generate` and `pnpm check-types`.

### 4. Web tests (red)
- [ ] `apps/web/tests/components/assets/asset-list.test.tsx`:
  - a labelled search box
  - the category, condition, status and location filters
  - the columns in each row
  - separate empty-register and no-match states
  - the error state
- [ ] `apps/web/tests/components/assets/asset-details.test.tsx`:
  - the fields and condition render
  - the "No work orders yet" state shows
  - Edit and Deactivate are hidden on an inactive asset
- [ ] Extend `asset-form.test.tsx` with the condition field.
- [ ] Confirm the tests fail.

### 5. Web (green)
- [ ] `routes/_authenticated/estates.$estateId.assets.index.tsx` and
  `components/assets/asset-list.tsx`.
- [ ] `components/assets/asset-details.tsx`, used by the existing detail route.
- [ ] Add the condition field to `asset-form.tsx`. Link "Assets" from
  `estate-details-page.tsx`.

### 6. Finish
- [ ] `pnpm fix`, `pnpm check-types`, `pnpm test`.
- [ ] Commit the migration, jOOQ sources and the generated contract.
- [ ] Set this spec's status to built.

## Verification

- The server and web tests above.
- Manual check:
  1. Register assets across two blocks.
  2. Search by a partial reference.
  3. Filter by a block and confirm that its levels' assets appear.
  4. Open one asset and see the empty history.
