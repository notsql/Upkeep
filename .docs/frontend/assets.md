# Assets and condition assessments (frontend)

Building assets registered in an estate, and their condition history. Paths
are relative to `apps/web/src/`; route folders below are under
`routes/_auth/estates/$estateId/assets/`. All require sign-in.

## Routes

| File | URL | Params | Title | Renders |
| --- | --- | --- | --- | --- |
| `new/index.tsx` | `/estates/$estateId/assets/new` | `estateId` | "Register asset" | `NewAssetPage` |
| `$assetId/index.tsx` | `/estates/$estateId/assets/$assetId` | `estateId`, `assetId` | "Asset details" | `AssetDetailsPage` |
| `$assetId/edit/index.tsx` | `/estates/$estateId/assets/$assetId/edit` | `estateId`, `assetId` | "Edit asset" | `EditAssetPage` |

Entry point: the "Register asset" link on the estate details page (owner, active
estate only). There is no asset list screen yet.

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `NewAssetPage` (`assets/-components/asset-editor-page.tsx`) | `AssetForm` with no initial values. On save: toast "Asset {reference} registered.", navigate to the new asset's details. | - |
| `EditAssetPage` (same file) | Loads the asset. If deactivated, shows "can no longer be edited" instead of the form. On save: toast "Asset details updated.", navigate to details. | - |
| `AssetForm` (`assets/-components/asset-form.tsx`) | Read-only "Reference" when editing. Fields: `name` (req, max 200), `category` (req, select from `assetCategoryLabel`), `locationId` (req, select of `flattenLocations` paths from `useLocations`), `installedOn` (date, optional), `manufacturer`, `model`, `serialNumber` (optional, max 200). Client-side required checks; blank optional fields are omitted from the payload. | `Button`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` |
| `AssetDetailsPage` (`assets/$assetId/-components/asset-details-page.tsx`) | Name, Active/Deactivated status, reference, category, `locationPath`, installation date, manufacturer, model, serial number ("Not recorded" when absent). While active: "Edit asset" link and "Deactivate asset" button. Below: `AssetConditionSection` and `AssetDevicesSection` (see [devices.md](devices.md)); both disable writes when deactivated. | `Button`, `buttonVariants` (Edit asset link) |
| `DeactivateAssetDialog` (`assets/$assetId/-components/deactivate-asset-dialog.tsx`) | Always-open modal; user types the asset `reference` to enable "Deactivate asset". Closing blocked while pending. On success: toast "Asset deactivated. Its record has been preserved." | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Button`, `Input`, `Label` |
| `AssetConditionSection` (`assets/$assetId/-components/asset-condition-section.tsx`) | "Condition" section: current condition (`role="status"`, `aria-label="Current condition"`, first item of the list, or "Not assessed yet"), "Record assessment" button (when `canRecord`), and a History list (condition, assessed date, notes, recorded by and at). On save: close form, toast "Assessment recorded." | `Button` |
| `AssessmentForm` (`assets/$assetId/-components/assessment-form.tsx`) | Fields: `condition` (req, `GOOD` / `NEEDS_ATTENTION` / `FAULTY`), `assessedOn` (req date, defaults to `localToday()`, not in the future), `notes` (req, max 2000, trimmed). | `Button`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Textarea` |

## Data

### `lib/assets.ts`

Types: `Asset` = `AssetResponse`, `AssetInput` = `CreateAssetRequest`,
`AssetCategory` (`LIFT`, `PUMP`, `GENERATOR`, `LIGHTING`, `FIRE_SAFETY`,
`HVAC`, `ELECTRICAL`, `OTHER`; labels in `assetCategoryLabel`).

Query key: `assetQueryKey(userId, estateId, assetId)` =
`["estates", userId, "assets", estateId, assetId]`.

| Hook | Endpoint | On success |
| --- | --- | --- |
| `useAsset(estateId, assetId)` | `GET /estates/{estateId}/assets/{id}` | query |
| `useCreateAsset(estateId)` | `POST /estates/{estateId}/assets` | `setQueryData(assetQueryKey(..., data.id), data)` |
| `useUpdateAsset(estateId, assetId)` | `PATCH /estates/{estateId}/assets/{id}` | `setQueryData(assetQueryKey(...), data)` |
| `useDeactivateAsset(estateId, assetId)` | `POST /estates/{estateId}/assets/{id}/deactivate` body `{ reference }` | `setQueryData(assetQueryKey(...), data)` |

No invalidations: each write returns the full asset and replaces the cache
entry.

### `lib/assessments.ts`

Types: `Assessment` = `AssetAssessmentResponse`, `AssessmentInput` =
`CreateAssetAssessmentRequest`, `AssetCondition`. Helpers: `conditionLabel`,
`localToday()` (browser-local `YYYY-MM-DD`).

Query key: `assessmentsQueryKey(userId, estateId, assetId)` =
`["estates", userId, "assessments", estateId, assetId]`.

| Hook | Endpoint | On success |
| --- | --- | --- |
| `useAssessments(estateId, assetId)` | `GET /estates/{estateId}/assets/{assetId}/assessments` (current first: by assessed date, then recorded time) | query |
| `useRecordAssessment(estateId, assetId)` | `POST /estates/{estateId}/assets/{assetId}/assessments` | invalidate `assessmentsQueryKey(...)` |

All queries: `enabled: ready`, `retry: false`, errors via `estateError`.
