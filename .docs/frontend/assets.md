# Assets and condition assessments (frontend)

Building assets registered in an estate, and their condition history. Paths
are relative to `apps/web/src/`; route folders below are under
`routes/_auth/estates/$estateId/assets/`. All require sign-in.

## Routes

| File | URL | Params | Title | Renders |
| --- | --- | --- | --- | --- |
| `index.tsx` | `/estates/$estateId/assets` | `estateId`; validated URL filters | "Assets" | `AssetRegisterPage` |
| `new/index.tsx` | `/estates/$estateId/assets/new` | `estateId` | "Register asset" | `NewAssetPage` |
| `$assetId/index.tsx` | `/estates/$estateId/assets/$assetId` | `estateId`, `assetId` | "Asset details" | `AssetDetailsPage` |
| `$assetId/edit/index.tsx` | `/estates/$estateId/assets/$assetId/edit` | `estateId`, `assetId` | "Edit asset" | `EditAssetPage` |

Entry point: Assets section beneath Locations on estate details. Owners have View assets and, for active estates, Register asset. Details link back to the register and estate.

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `NewAssetPage` (`assets/-components/asset-editor-page.tsx`) | `AssetForm` with no initial values. On save: toast "Asset {reference} registered.", navigate to the new asset's details. | - |
| `EditAssetPage` (same file) | Loads the asset. If deactivated, shows "can no longer be edited" instead of the form. On save: toast "Asset details updated.", navigate to details. | - |
| `AssetForm` (`assets/-components/asset-form.tsx`) | Read-only "Reference" when editing. Fields: `name` (req, max 200), `category` (req, select from `assetCategoryLabel`), `locationId` (req, select of `flattenLocations` paths from `useLocations`), `installedOn` (date, optional), `manufacturer`, `model`, `serialNumber` (optional, max 200). Client-side required checks; blank optional fields are omitted from the payload. | `Button`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` |
| `AssetDetailsPage` (`assets/$assetId/-components/asset-details-page.tsx`) | Name, Active/Retired status, reference, category, `locationPath`, installation date, manufacturer, model, serial number ("Not recorded" when absent). While active: "Edit asset" link and "Retire asset" button. Below: `AssetConditionSection` and `AssetDevicesSection` (see [devices.md](devices.md)); both disable writes when deactivated. | `Button`, `buttonVariants` (Edit asset link) |
| `DeactivateAssetDialog` (`assets/$assetId/-components/deactivate-asset-dialog.tsx`) | Always-open modal; exact reference plus retirement date and trimmed reason are required. Dates default to Singapore today and cannot precede known installation or exceed today. Submits the displayed lifecycle version. Closing blocked while pending. On success: toast "Asset retired. Its record has been preserved." | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Button`, `Input`, `Label`, `Textarea` |
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
| `useDeactivateAsset(estateId, assetId)` | `POST /estates/{estateId}/assets/{id}/deactivate` body `{ reference, retiredOn, retirementReason, expectedVersion }` | `setQueryData(assetQueryKey(...), data)` |

Every asset mutation sets the returned detail cache and invalidates `["estates", userId, "assets", estateId]`, refreshing lists and lifecycle history.

### `lib/assessments.ts`

Types: `Assessment` = `AssetAssessmentResponse`, `AssessmentInput` =
`CreateAssetAssessmentRequest`, `AssetCondition`. Helpers: `conditionLabel`,
`localToday()` (browser-local `YYYY-MM-DD`).

Query key: `assessmentsQueryKey(userId, estateId, assetId)` =
`["estates", userId, "assessments", estateId, assetId]`.

| Hook | Endpoint | On success |
| --- | --- | --- |
| `useAssessments(estateId, assetId)` | `GET /estates/{estateId}/assets/{assetId}/assessments` (current first: by assessed date, then recorded time) | query |
| `useRecordAssessment(estateId, assetId)` | `POST /estates/{estateId}/assets/{assetId}/assessments` | invalidate `assessmentsQueryKey(...)` and estate asset queries (latest condition) |

All queries: `enabled: ready`, `retry: false`, errors via `estateError`.

## Register and lifecycle

`assets/-components/asset-register-page.tsx` uses shadcn Table, Input, Label,
Select and Button. The separate table links reference/name to details and shows
category, hierarchical location, latest condition and Active/Retired status.
Search is debounced 300ms. URL query fields q/category/locationId/condition/status
are validated in assets/index.tsx; invalid values are omitted. Filters combine
with AND; Clear filters returns to the default active register. Loading, retry,
empty and no-match states are explicit. Browser back restores URL filters.

`useAssets(estateId, filters)` calls GET `/estates/{estateId}/assets`; key
`["estates", userId, "assets", estateId, "list", filters]`. Different filter
requests cannot overwrite each other's cache. `useLocations(estateId, true)`
fetches historical filter options; its key appends `"all"` to the ordinary
locations key, preserving active-only registration/edit pickers.

`$assetId/-components/asset-retirement-panel.tsx` shows retirement metadata,
Not recorded for legacy rows, and lifecycle history with before/after snapshots,
actor ID and Singapore timestamps. It uses shadcn Dialog/Input/Label/Textarea/Button.
Retired assets offer correction and exact-reference restoration dialogs. Pending
submissions block closing/duplicates; failures retain entered values. Ordinary
editing, assessment recording and device registration remain disabled while retired.

- `useAssetLifecycleEvents`: GET `/{id}/lifecycle-events`; key is detail key plus
  `"lifecycle"`.
- `useCorrectAssetRetirement`: PATCH `/{id}/retirement` with date/reason/version.
- `useRestoreAsset`: POST `/{id}/restore` with reference/version.

All paths above share `/estates/{estateId}/assets`. Correction/restoration refresh
the same estate asset cache prefix as other asset mutations. Replacements are
registered independently. Work-order/cost integration remains outside this feature.

Retirement dates use `retirementToday()`, which builds YYYY-MM-DD from Singapore
calendar parts instead of depending on locale-formatted text. Both retirement
and correction forms display Singapore today, the known installation date, and
an accessible inline explanation for dates before installation or in the future.
Date validation is shared through `retirementDateError()`; the API remains the
final authority for date validation.
