# Building assets

**Status:** draft
**Owner:** Zheng Kai
**Jira:** [ID-46](https://notjira.atlassian.net/browse/ID-46) (epic [ID-4](https://notjira.atlassian.net/browse/ID-4) Unified Asset Record)

## Problem

Managing agents have no record of an estate's equipment. Without an
identifiable asset there is nothing to attach condition, maintenance or cost
history to (ID-2, ID-3).

## Behaviour

This feature covers the asset record's whole lifecycle: create, read one, update
and soft-delete. Listing and search belong to [asset-search](asset-search.md).

- An estate's owner can register an asset in that estate. It needs a name, a
  category and a location. Installation date, manufacturer, model and serial
  number are optional.
- Category is one of LIFT, PUMP, GENERATOR, LIGHTING, FIRE_SAFETY, HVAC,
  ELECTRICAL or OTHER.
- The location must be an active location in the same estate
  ([location-hierarchy](location-hierarchy.md)). Free-text locations do not
  exist.
- The server assigns every asset a reference `<ESTATE CODE>-A<nnnn>`, for
  example `SUNRISE-A0001`. It is unique within the estate, never reused and
  never editable. See decision 0015.
- Text fields are trimmed. Blank optional fields are stored as null.
- The owner can read an asset, including its full location path, for example
  "Blk 101 › Level 1 › Lift lobby".
- The owner can edit every field except the reference. That includes moving the
  asset to another active location in the same estate.
- The owner can deactivate an asset by typing its exact reference. The row
  stays and gets a `deactivatedAt` timestamp. Deactivating it again keeps the
  original timestamp.
- A deactivated asset stays readable but cannot be edited (409).
- Nothing can be created or edited in an inactive estate (409). This closes the
  deferred criterion in [estate-management](estate-management.md).
- Only the estate's owner can see or change its assets. Anyone else gets 404,
  the same as for an unknown ID.

## Data

Prisma `Asset`:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | |
| `estateId` | UUID | FK → Estate |
| `locationId` | UUID | Required. Composite FK `(locationId, estateId)` → Location, so Postgres rejects a location from another estate. |
| `reference` | varchar(60) | `@@unique([estateId, reference])` |
| `name` | varchar(200) | |
| `category` | varchar(30) | Stored as a string, like `Location.type` |
| `installedOn` | date? | |
| `manufacturer`, `model`, `serialNumber` | varchar(200)? | |
| `createdAt`, `updatedAt`, `deactivatedAt?` | timestamptz | |

Also `@@index([estateId])` and `@@index([locationId])`. Location needs a
matching `@@unique([id, estateId])` if the location branch does not already
provide one. Rows are never deleted.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | /estates/{estateId}/assets | CreateAssetRequest | 201 AssetResponse | Owner |
| GET | /estates/{estateId}/assets/{id} | - | AssetResponse | Owner |
| PATCH | /estates/{estateId}/assets/{id} | UpdateAssetRequest (all editable fields) | AssetResponse | Owner |
| POST | /estates/{estateId}/assets/{id}/deactivate | DeactivateAssetRequest (reference) | AssetResponse | Owner |

`AssetResponse` carries these fields:
- `id`, `estateId`, `reference`, `name`, `category`
- `locationId` and `locationPath`
- `installedOn`, `manufacturer`, `model`, `serialNumber`
- `createdAt`, `updatedAt`, `deactivatedAt`

## Edge cases

- Validation failures return 400. A wrong deactivation reference returns 400.
- An unknown or foreign estate, asset or location returns 404.
- An inactive estate, asset or location returns 409.
- Every write locks the estate row (`EstateRepository.findOwned(id, owner, true)`)
  and then the asset row. That serialises reference generation, and a write
  cannot slip past a concurrent estate deactivation.
- A PATCH body's `reference` is ignored.
- If a database constraint still fires, the API returns 409 without SQL detail.
- Editing an estate's code does not rewrite existing asset references.
- The UI keeps entered data on failure and blocks repeated pending submits.
- Query keys include the signed-in user ID.

## Out of scope

- Listing and search ([asset-search](asset-search.md)).
- The searchable location picker ([asset-location-picker](asset-location-picker.md)).
  This feature uses a plain `<select>`.
- Reactivation, hard deletion, bulk import, photos and documents.
- Condition, maintenance history and costs (ID-47, ID-2).
- Access for non-owners (estate-access branch).

## Dependencies

- `feat/location-hierarchy` (the `Location` model, `/locations` endpoints and
  `apps/web/src/lib/locations.ts`) must be merged, or be this branch's base.

## Implementation phases

Test-first: every test is seen failing before the phase that makes it pass
([testing.md](../testing.md)).

### 0. Branch
- [ ] Rebase `feat/building-assets` onto `feat/location-hierarchy`, or onto
  `main` once that branch has merged.

### 1. Data (`add-model` skill)
- [ ] Add `Asset` to `packages/db/prisma/schema/schema.prisma` as specified above.
- [ ] `pnpm db:migrate`, then `pnpm db:generate`, then
  `./mvnw -pl com.proj:server compile`.

### 2. Server tests (red)
- [ ] `apps/server/src/test/java/com/proj/server/asset/AssetControllerTests.java`,
  modelled on `LocationControllerTests`:
  - [ ] POST returns 201 with `<CODE>-A0001`. The next asset gets `A0002`.
  - [ ] Optional fields are null when omitted. Text is trimmed.
  - [ ] A missing name, category or location returns 400.
  - [ ] Another owner's estate returns 404. An inactive estate returns 409.
  - [ ] A location from another estate returns 404. An inactive location
    returns 409.
  - [ ] GET returns the location path. An unknown or foreign asset returns 404.
  - [ ] PATCH updates the fields and can move the location. The reference is
    unchanged.
  - [ ] PATCH with a null location returns 400. A foreign location returns 404.
    An inactive asset, location or estate returns 409. Another owner gets 404.
  - [ ] Deactivating with the correct reference sets `deactivatedAt`. A wrong
    reference returns 400. Repeating it keeps the timestamp. The asset is still
    readable through GET. Another owner gets 404.
  - [ ] A missing JWT subject is rejected on every endpoint.
- [ ] Run `./mvnw -pl com.proj:server test -Dtest=AssetControllerTests` and
  confirm the tests fail.

### 3. API (green, using the `add-endpoint` skill)
- [ ] Package `com.proj.server.asset`:
  - `AssetController`, `AssetService`, `AssetRepository`
  - `CreateAssetRequest`, `UpdateAssetRequest`, `DeactivateAssetRequest`,
    `AssetResponse`
  - `AssetCategory`, `AssetException`, `AssetExceptionHandler`
- [ ] Transactions and locking as described under Edge cases.
- [ ] Make the tests pass, then run `pnpm api:generate` and `pnpm check-types`.

### 4. Web tests (red)
- [ ] `apps/web/tests/lib/assets.test.ts`: the query keys include the user and
  estate IDs, and failed requests throw.
- [ ] `apps/web/tests/components/assets/asset-form.test.tsx`:
  - the labelled fields render
  - the location `<select>` lists only active locations
  - the required errors show
  - submit posts the payload
  - the data is kept on a server error
  - there is no double submit
  - edit mode is pre-filled with a read-only reference
- [ ] `apps/web/tests/components/assets/deactivate-asset-dialog.test.tsx`:
  - confirm stays disabled until the exact reference is typed
  - cancel sends no request
  - a server error keeps the dialog open
- [ ] Run `pnpm nx test web` and confirm the tests fail.

### 5. Web (green)
- [ ] `apps/web/src/lib/assets.ts`, following `lib/estates.ts`.
- [ ] `components/assets/asset-form.tsx` and `components/assets/deactivate-asset-dialog.tsx`.
  The dialog is modelled on `deactivate-estate-dialog.tsx`.
- [ ] Routes under `routes/_authenticated/`:
  - `estates.$estateId.assets.new.tsx`
  - `estates.$estateId.assets.$assetId.tsx`, a minimal detail page with Edit
    and Deactivate
  - `estates.$estateId.assets.$assetId.edit.tsx`
- [ ] A "Register asset" link on `estate-details-page.tsx`.

### 6. Finish
- [ ] `pnpm fix`, `pnpm check-types`, `pnpm test`.
- [ ] Commit the migration, jOOQ sources, `openapi.json` and `schema.ts` with
  the code.
- [ ] Update the deferred criterion in `estate-management.md`. Set this spec's
  status to built.

## Verification

- `AssetControllerTests` covers every rule under Behaviour and Edge cases.
- The web tests cover the form, the dialog and the query keys.
- Manual check on a Neon feature branch:
  1. Register, view, edit and deactivate an asset.
  2. Confirm the 404 on another owner's estate and the 409 on an inactive estate.
