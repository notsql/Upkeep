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

Entry point: Assets section beneath Locations on estate details. Owners have View assets and, for active estates, Register asset. Owners also get a "Failure risk" link to `/estates/$estateId/failure-risk` (see [failure-risk.md](failure-risk.md)). Details link back to the register and estate.

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `NewAssetPage` (`assets/-components/asset-editor-page.tsx`) | `AssetForm` with no initial values. On save: toast "Asset {reference} registered.", navigate to the new asset's details. | - |
| `EditAssetPage` (same file) | Loads the asset. If deactivated, shows "can no longer be edited" instead of the form. On save: toast "Asset details updated.", navigate to details. | - |
| `AssetForm` (`assets/-components/asset-form.tsx`) | Read-only "Reference" when editing. Fields: `name` (req, max 200), `category` (req, select from `useAssetCategories`; placeholder "Loading categories…" while pending, error shown in a destructive `Alert`), `locationId` (req, select of `flattenLocations` paths from `useLocations`), `installedOn` (date, optional), `manufacturer`, `model`, `serialNumber` (optional, max 200). Manufacturer and model are `SuggestField` comboboxes (free text, max 200): typing suggests names from `useManufacturers`; model suggestions come from `useAssetModels` only once a listed manufacturer was picked and a category is set. Any text is accepted; an unlisted name is added to the catalogue on save. Client-side required checks; blank optional fields are omitted from the payload. Each field is a `Field` with `FieldLabel`; missing required fields show a `FieldError` (`role="alert"`) linked by `aria-describedby`; a save failure shows a destructive `Alert`. | `Button`, `Input`, `Field`, `FieldSet`, `FieldLegend`, `FieldLabel`, `FieldDescription`, `FieldError`, `Alert`, `AlertDescription`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxList`, `ComboboxItem` |
| `AssetDetailsPage` (`assets/$assetId/-components/asset-details-page.tsx`) | Name, Active/Retired status, reference, category (label from `useAssetCategories`, code as fallback), `locationPath`, installation date, manufacturer, model, serial number ("Not recorded" when absent). While active: "Edit asset" link and "Retire asset" button. Below: `AssetForecastCard` (category `PUMP` only), `AssetMaintenanceSection`, `AssetConditionSection` and `AssetDevicesSection` (see [devices.md](devices.md)); writes are disabled when deactivated. Load errors and the retired notice (`role="note"`) are `Alert`s. | `Button`, `buttonVariants` (Edit asset link), `Alert`, `AlertDescription` |
| `DeactivateAssetDialog` (`assets/$assetId/-components/deactivate-asset-dialog.tsx`) | Always-open modal; exact reference plus retirement date and trimmed reason are required. Dates default to Singapore today and cannot precede known installation or exceed today. Submits the displayed lifecycle version. Closing blocked while pending. On success: toast "Asset retired. Its record has been preserved." | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Button`, `Input`, `Label`, `Textarea` |
| `AssetConditionSection` (`assets/$assetId/-components/asset-condition-section.tsx`) | "Condition" section: current condition (`role="status"`, `aria-label="Current condition"`, first item of the list, or "Not assessed yet"), "Record assessment" button (when `canRecord`), and a History list (condition, assessed date, notes, recorded by and at). Assessments whose `recordedByUserId` is `system:anomaly-model` show "Recorded by Anomaly detection". Record assessment opens a Dialog with Cancel; pending submission blocks dismissal. On save: close dialog, toast "Assessment recorded." History entries are `Card`s; load errors a destructive `Alert`. | `Button`, `Dialog`, `Card`, `CardContent`, `Alert`, `AlertDescription`, `ConditionBadge` |
| `AssetForecastCard` (`assets/$assetId/-components/asset-forecast-card.tsx`) | "Breakdown forecast" card from `useAssetFailureRisk`. Loading "Loading forecast…", error in a destructive `Alert`. Flag reasons as destructive badges after "Flagged for a check:". If `noForecastReason` gives "Not supported" / "Not enough data", shows that; else Within 30/60/90 days (`formatProbability`), Recommended check (`timeframeLabel`), Breakdowns observed. Always "Expected end of life: {date or Not recorded}". See [failure-risk.md](failure-risk.md). | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Badge`, `Alert`, `AlertDescription` |
| `AssetMaintenanceSection` (`assets/$assetId/-components/asset-maintenance-section.tsx`) | "Maintenance" section: "Record repair" button (when `canRecord`, i.e. not deactivated) opens `RecordEventDialog` defaulting to `BREAKDOWN_REPAIR`. Lists events: an outline "Manual entry" badge, type label, `occurredOn`, a secondary "Previous unit" badge when `countsTowardForecast` is false, notes, then a `<dl>` of the known details (Findings, Work performed, Service provider, Parts replaced, Downtime (minutes); null ones are omitted, `0` downtime is shown), recorded by and at. Each event is a `Card`. Empty: "No maintenance recorded yet." (`Empty`, `role="status"`); load errors a destructive `Alert`. On save: close dialog, toast "Event recorded." | `Button`, `Badge`, `Card`, `CardContent`, `Empty`, `Alert`, `AlertDescription` |
| `RecordEventDialog` (`assets/$assetId/-components/record-event-dialog.tsx`) | Always-open "Record event" modal. Fields: `type` (req select, `assetEventTypeLabel`), `occurredOn` "Event date" (req, defaults to `localToday()`, not in the future), `notes` (req, max 2000, trimmed). A second `FieldSet` "Maintenance details" ("Optional. Leave blank if not known.") holds Findings, Work performed and Parts replaced (`Textarea`, max 2500), Service provider (`Input`, max 200) and Downtime (minutes) (number `Input`, min 0); blank details are left out of the request, and downtime that is not a whole number shows "Downtime must be a whole number of minutes." Cancel and the close button are disabled while pending; failures keep input and show the error in a destructive `Alert`. Missing required fields show a `FieldError` (`role="alert"`) per field. Buttons sit in `DialogFooter`. | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Button`, `Input`, `Field`, `FieldSet`, `FieldLegend`, `FieldDescription`, `FieldLabel`, `FieldError`, `Alert`, `AlertDescription`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Textarea` |
| `AssessmentForm` (`assets/$assetId/-components/assessment-form.tsx`) | Fields: `condition` (req, `GOOD` / `NEEDS_ATTENTION` / `FAULTY`), `assessedOn` (req date, defaults to `localToday()`, not in the future), `notes` (req, max 2000, trimmed). | `Button`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Textarea` |

## Data

### `lib/assets.ts`

Types: `Asset` = `AssetResponse`, `AssetInput` = `CreateAssetRequest`.
Category codes and labels come from the server (`lib/catalogue.ts`); there is
no client-side category list.

Query key: `assetQueryKey(userId, estateId, assetId)` =
`["estates", userId, "assets", estateId, assetId]`.

| Hook | Endpoint | On success |
| --- | --- | --- |
| `useAsset(estateId, assetId)` | `GET /estates/{estateId}/assets/{id}` | query |
| `useCreateAsset(estateId)` | `POST /estates/{estateId}/assets` | `setQueryData(assetQueryKey(..., data.id), data)` |
| `useUpdateAsset(estateId, assetId)` | `PATCH /estates/{estateId}/assets/{id}` | `setQueryData(assetQueryKey(...), data)` |
| `useDeactivateAsset(estateId, assetId)` | `POST /estates/{estateId}/assets/{id}/deactivate` body `{ reference, retiredOn, retirementReason, expectedVersion }` | `setQueryData(assetQueryKey(...), data)` |

Every asset mutation sets the returned detail cache and invalidates `["estates", userId, "assets", estateId]`, refreshing lists and lifecycle history.

### `lib/catalogue.ts`

Types: `AssetCategoryOption` = `AssetCategoryResponse`, `Manufacturer` =
`ManufacturerResponse`, `AssetModel` = `AssetModelResponse`. Helper:
`categoryLabel(categories, code)` (label, or the code while unknown), used by
the register table/cards.

| Hook | Endpoint | Query key |
| --- | --- | --- |
| `useAssetCategories()` | `GET /asset-categories` (ordered by label; `staleTime: Infinity`) | `["catalogue", userId, "categories"]` |
| `useManufacturers(query)` | `GET /manufacturers?query=` (enabled only for non-blank `query`) | `["catalogue", userId, "manufacturers", query]` |
| `useAssetModels(manufacturerId, category, query)` | `GET /manufacturers/{manufacturerId}/models?category=&query=` (enabled once both are set) | `["catalogue", userId, "models", manufacturerId, category, query]` |

Read-only; no mutations. The register filter and the `category` URL search
param also use the server's categories: any non-blank code passes validation
and the server rejects unknown ones. API: [api/catalogue.md](../api/catalogue.md).

### `lib/asset-events.ts`

Types: `AssetEvent` = `AssetEventResponse`, `AssetEventInput` =
`CreateAssetEventRequest` (`type`, `occurredOn`, `notes`), `AssetEventType`.
Labels: `assetEventTypeLabel` (`BREAKDOWN_REPAIR` "Breakdown repair",
`PREVENTIVE` "Preventive maintenance").

Query key: `assetEventsQueryKey(userId, estateId, assetId)` = asset detail key
plus `"events"`.

| Hook | Endpoint | On success |
| --- | --- | --- |
| `useAssetEvents(estateId, assetId)` | `GET /estates/{estateId}/assets/{assetId}/events` | query |
| `useRecordAssetEvent(estateId, assetId)` | `POST /estates/{estateId}/assets/{assetId}/events` | invalidate `assetEventsQueryKey(...)` and `estateFailureRiskQueryKey(userId, estateId)` (estate and per-asset forecasts) |

API: [api/asset-events.md](../api/asset-events.md). Anomaly-detection
assessments: [api/anomaly-check.md](../api/anomaly-check.md).

### `lib/assessments.ts`

Types: `Assessment` = `AssetAssessmentResponse`, `AssessmentInput` =
`CreateAssetAssessmentRequest`, `AssetCondition`. Helpers: `conditionLabel`,
`localToday()` (browser-local `YYYY-MM-DD`).

Query key: `assessmentsQueryKey(userId, estateId, assetId)` =
`["estates", userId, "assessments", estateId, assetId]`.

| Hook | Endpoint | On success |
| --- | --- | --- |
| `useAssessments(estateId, assetId)` | `GET /estates/{estateId}/assets/{assetId}/assessments` (current first: by assessed date, then recorded time) | query |
| `useRecordAssessment(estateId, assetId)` | `POST /estates/{estateId}/assets/{assetId}/assessments` | invalidate `assessmentsQueryKey(...)`, estate asset queries (latest condition), the dashboard, and `estateFailureRiskQueryKey(userId, estateId)` (estate and per-asset forecast condition flags) |

All queries: `enabled: ready`, `retry: false`, errors via `estateError`.

## Register and lifecycle

`assets/-components/asset-register-page.tsx` uses shadcn Table, Input, Field/FieldLabel,
Select, Button, Alert (load errors with an `AlertAction` retry button; the
inactive-estate notice, `role="note"`) and Empty (no assets / no matches,
`role="status"`). The separate table links reference/name to details and shows
category, hierarchical location, latest condition and Active/Retired status.
Search is debounced 300ms.
Location filter options are memoized by the locations response, avoiding another
hierarchy build on each search keystroke; location changes refresh the options.
URL query fields q/category/locationId/condition/status
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

## Dashboard presentation

Register/detail/editor screens share `page-layout` and `PageHeader` breadcrumbs
through Estates / the actual estate name / Assets. The register shows a compact desktop filter grid and a named Assets table with
a focusable overflow region. Below 768px it renders cards retaining all six
fields. Each mobile card is one routed link labelled with its asset name and
reference; tapping any part, including location/condition/status, opens details.
There are no nested links/buttons. Keyboard focus, mouse hover and touch press
highlight the card; motion-reduced preferences disable its transition. Desktop
table names/references remain links. Search stays visible; Filters opens an
Apply/Clear secondary filters/Cancel dialog. Draft changes do not query until
Apply; cancellation discards them. The count excludes search/default Active.
Page Clear resets filters while preserving sorting; dialog Clear retains search. Condition uses shared
ConditionBadge with green/amber/red/neutral labels. LifecycleStatusBadge uses green Active
and red Retired labels, shared with estate status styling. Table order, linked
references/names, URL filters and back navigation retain their existing behavior.

Editors use a narrow form surface and shared `FormActions`; creation Cancel
returns to the register, edit Cancel to asset details. Both actions disable while
saving. Required/optional guidance is visible without changing payload fields.
Details group management actions in PageHeader, use a compact responsive summary
and separate lifecycle, condition/history and device surfaces. Record assessment
opens an existing Dialog with Cancel; it blocks closing while saving, preserves
failed input, and retains current-condition/history ordering. Condition history
uses ConditionBadge. Device registration links to its dedicated page (see
[devices.md](devices.md)). Dialogs use the shared theme and fit within a scrollable viewport.
See [design-system.md](design-system.md). Existing endpoint hooks, permissions,
retirement dates, version checks and invalidations above remain in effect.

Register, detail and create/edit screens read `useEstate(estateId)` using
`["estates", userId, "details", estateId]` to name the estate in breadcrumbs.
This existing query is cached and session-gated; Estate is a loading fallback. For an inactive estate, Register asset is hidden and the screen explains
that existing assets remain available. Backend write restrictions are unchanged.

Creating, retiring or restoring an asset and recording a condition assessment also
invalidate `["estates", userId, "dashboard"]` so Home reflects operational changes.
See [dashboard.md](dashboard.md).

## Register sorting

All six desktop headers use `components/sortable-table-head.tsx`: Reference,
Name, Category, Location, Current condition and Status. The shadcn header Button
shows ascending/descending icons and TableHead exposes aria-sort. Default is
Reference ascending. Selecting another text/status column starts ascending;
Current condition starts descending (worst first). Repeat selection reverses.

`lib/asset-sorting.ts` sorts a copy of the entire filtered API array. Text uses
natural English comparison, case-insensitively; categories use displayed labels
and locations use full displayed paths. Condition orders Good, Needs attention,
Faulty with unassessed last in either direction; Status orders Active, Retired.
Reference and ID break ties. All matching records remain present.

`assets/-components/asset-sort-controls.tsx` provides the same choices for mobile
cards through shadcn Select (Sort assets by) and a Reverse asset sort direction
Button. Cards and the desktop table use the same ordered array. The route
validates and persists `sortBy`/`direction` in URL search. These are presentation
state and are stripped before calling `useAssets`; its generated API filters,
query key and endpoints remain unchanged. Sorting preserves filters, clearing
filters preserves sorting, and refresh/browser back restore both.
Sorting uses `resetScroll: false`, keeping the current page position as rows or
cards reorder. Other asset navigation retains its existing scroll behavior.

## Completed work orders in maintenance

`$assetId/-components/asset-maintenance-section.tsx` combines manual AssetEvent
entries with canonical completed work from useAssetWorkOrderCompletions, ordered
newest first with stable ID ties. Each completion appears once, labelled Work
order with reference, saved work location, findings/work performed, parts notes,
SGD costs, minutes, closer and server time. Reference links require independent
canViewWorkOrders. Unknown costs/downtime are displayed distinctly from zero.
The shared CompletionOutcome component also serves work-order detail. Existing
Record repair and forecast/manual-event APIs retain their behavior. Completion
reads retain owner-only asset permission, including moved/retired asset history;
non-owner Managers use work-order outcomes instead. See [work-orders.md](work-orders.md).


Authorized corrections retain the same canonical completion entry in Maintenance.
The displayed outcome/costs are current, with Edited author/time when corrected;
original completion time still determines the entry's place in history. Revision
snapshots and correction reasons are available from the work-order detail, subject
to independent work-order access. Correction never creates an AssetEvent or
changes condition/forecast inputs.

## Restricted inspection context

The existing asset list/detail route components select owner screens with
canViewAssets. Otherwise authorised inspection readers mount limited
inspection-asset-list/inspection-asset-page components and hooks, without owner
condition, maintenance, readings, device or forecast queries. Active eligible
assets expose Create inspection record for Owners/Managers/Crew. The result
form/detail routes and history table are documented in
[inspections](inspections.md). Both Owner and restricted Manager/Crew asset
details mount the shared Inspection records table, with paged canonical reads,
saved-record links and work-order follow-up under independent permissions.
