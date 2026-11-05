# Assets and condition assessments (frontend)

The asset detail page now includes the route-local `AssetDocumentsSection` before
inspection history. It uses a shadcn Card/Table to show authorized linked files
with type, size, upload date and Download. Owners can Unlink even when the asset
is retired; inactive estates retain reads only. See
[asset-documents.md](asset-documents.md) for its routes, API calls, query keys,
reviewed-version confirmation and conflict handling.

Building assets registered in an estate, and their condition history. Paths
are relative to `apps/web/src/`; route folders below are under
`routes/_auth/estates/$estateId/assets/`. All require sign-in.

## Routes

| File | URL | Params | Title | Renders |
| --- | --- | --- | --- | --- |
| `index.tsx` | `/estates/$estateId/assets` | `estateId`; validated URL filters | "Assets" | `AssetRegisterPage` |
| `new/index.tsx` | `/estates/$estateId/assets/new` | `estateId` | "Register asset" | `NewAssetPage` |
| `$assetId/route.tsx` | - | - | - | Plain `Outlet` parent, so `_details` below is pathless and does not swallow `edit`, `inspections/new`, `devices/new` and the rest |
| `$assetId/_details/route.tsx` | (pathless layout) | `estateId`, `assetId` | - | `AssetDetailsLayout` around an `Outlet`; `InspectionAssetPage` instead for inspection-only viewers (`!canViewAssets`) |
| `$assetId/_details/index.tsx` | `/estates/$estateId/assets/$assetId` | `estateId`, `assetId`; legacy `?tab=` (`maintenance`, `inspections`, `documents`, `costs`, `devices`) redirects (replace) to the matching sub-page | "Asset details" | `AssetOverview` |
| `$assetId/_details/maintenance/index.tsx` | `…/assets/$assetId/maintenance` | `estateId`, `assetId` | "Asset maintenance" | `AssetMaintenance` |
| `$assetId/_details/inspections/index.tsx` | `…/assets/$assetId/inspections` | `estateId`, `assetId` | "Asset inspections" | `InspectionHistoryTable` |
| `$assetId/_details/documents/index.tsx` | `…/assets/$assetId/documents` | `estateId`, `assetId` | "Asset documents" | `AssetDocumentsSection` |
| `$assetId/_details/costs/index.tsx` | `…/assets/$assetId/costs` | `estateId`, `assetId` | "Asset costs" | `AssetCostsSection` |
| `$assetId/_details/devices/index.tsx` | `…/assets/$assetId/devices` | `estateId`, `assetId` | "Asset devices" | `AssetDevices` |
| `$assetId/edit/index.tsx` | `/estates/$estateId/assets/$assetId/edit` | `estateId`, `assetId` | "Edit asset" | `EditAssetPage` |

Entry point: sidebar Assets › Assets (`canOpenAssets`: `canViewAssets || canViewInspectionResults`); the register's `ListPageHeader` "Create" (`CreateButton`) opens Register asset. The `_auth` guard lets inspection-only viewers (`canViewInspectionResults`) open `/assets/$assetId` and `/assets/$assetId/inspections`; the other sub-pages need `canViewManagement && canViewAssets`. The register has no breadcrumbs; deeper pages use section-first breadcrumbs (`Assets › <asset name>`, `Assets › Register asset`, `Assets › <asset name> › Edit`). No back links; see the page header convention in [design-system.md](design-system.md).

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `NewAssetPage` (`assets/-components/asset-editor-page.tsx`) | `AssetForm` with no initial values. On save: toast "Asset {reference} registered.", navigate to the new asset's details. | - |
| `EditAssetPage` (`assets/-components/edit-asset-page.tsx`) | Loads the asset. If deactivated, shows "can no longer be edited" instead of the form. On save: toast "Asset details updated.", navigate to details. | - |
| `AssetForm` (`assets/-components/asset-form/asset-form.tsx`) | Read-only "Reference" when editing. Fields: `name` (req, max 200), `category` (req, select from `useAssetCategories`; placeholder "Loading categories…" while pending, error shown in a destructive `Alert`), `locationId` (req, select of `flattenLocations` paths from `useLocations`), `installedOn` (optional `DatePicker`), `manufacturer`, `model`, `serialNumber` (optional, max 200). Manufacturer and model are `SuggestField` comboboxes (free text, max 200): typing suggests names from `useManufacturers`; model suggestions come from `useAssetModels` only once a listed manufacturer was picked and a category is set. Any text is accepted; an unlisted name is added to the catalogue on save. Client-side required checks; blank optional fields are omitted from the payload. Each field is a `Field` with `FieldLabel`; missing required fields show a `FieldError` (`role="alert"`) linked by `aria-describedby`; a save failure shows a destructive `Alert`. | `Button`, `Input`, `Field`, `FieldSet`, `FieldLegend`, `FieldLabel`, `FieldDescription`, `FieldError`, `Alert`, `AlertDescription`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxList`, `ComboboxItem` |
| `AssetDetailsLayout` (`assets/$assetId/-components/asset-details-page/asset-details-page.tsx`) | The shared frame of every asset sub-page. `DetailPageHeader`: breadcrumbs `Assets › <name>`, title = name, Active/Retired status badge, `meta` = reference. While active the actions are outline "Edit" link, primary "Create inspection record" (`Plus`, inspection creators on an active estate) and destructive "Retire asset" (opens `DeactivateAssetDialog`). Then the retired notice (`Alert role="note"`) and a `SubNav` ("Asset sections": Overview (exact), Maintenance, Inspections, Documents, Costs, Devices - each a route, see Routes). The child sub-page renders only once `useAsset` has loaded. Loading is `LoadingState`; a load error is `ErrorState` (Retry refetches). | `Button`, `buttonVariants`, `Alert`, `AlertDescription`; `DetailPageHeader`, `SubNav`, `ErrorState` |
| `AssetOverview` (`asset-overview.tsx`, same folder) | Details `DetailCard` (reference, category label from `useAssetCategories` with code fallback, `locationPath`, installation date, manufacturer, model, serial number; "Not recorded" when absent), `AssetConditionSection`, and `AssetForecastCard` for category `PUMP` only. | - |
| `AssetMaintenance` (`asset-maintenance.tsx`, same folder) | `AssetMaintenanceSection`, `AssetServiceIntervalCard` for owner or Manager only (see [service-intervals.md](service-intervals.md); locked with a reason for an inactive estate or a retired asset) and `AssetRetirementPanel`. | - |
| `AssetDevices` (`asset-devices.tsx`, same folder) | `AssetDevicesSection` (see [devices.md](devices.md)), registration allowed while the asset is active. | - |
| `DeactivateAssetDialog` (`assets/$assetId/-components/asset-details-page/deactivate-asset-dialog.tsx`) | Always-open shared `ConfirmDialog` ("Retire <name>?", destructive "Retire asset", "Retiring…" while pending, `confirmDisabled` until the typed reference, date and reason are valid); exact reference plus retirement date and trimmed reason are required. Dates default to Singapore today and cannot precede known installation or exceed today. Submits the displayed lifecycle version. Closing blocked while pending. On success: toast "Asset retired. Its record has been preserved." | `ConfirmDialog`, `Input`, `Label`, `Textarea`, `DatePicker` |
| `AssetConditionSection` (`assets/$assetId/-components/asset-overview/asset-condition-section/asset-condition-section.tsx`) | "Condition" section: current condition (`role="status"`, `aria-label="Current condition"`, first item of the list, or "Not assessed yet"), "Record assessment" button (when `canRecord`), and a History list (condition, assessed date, notes, recorded by and at). Assessments whose `recordedByUserId` is `system:anomaly-model` show "Recorded by Anomaly detection". Record assessment opens a Dialog with Cancel; pending submission blocks dismissal. On save: close dialog, toast "Assessment recorded." A `SectionCard` (`HeartPulse`) with Record assessment as its header action. History entries are `Card`s; load errors an `ErrorState` (Retry). | `Button`, `Dialog`, `Card`, `CardContent`, `ConditionBadge`; `SectionCard`, `ErrorState` |
| `AssetForecastCard` (`assets/$assetId/-components/asset-overview/asset-forecast-card.tsx`) | "Breakdown forecast" card from `useAssetFailureRisk`. Loading "Loading forecast…", error in a destructive `Alert`. Flag reasons as destructive badges after "Flagged for a check:". If `noForecastReason` gives "Not supported" / "Not enough data", shows that; else Within 30/60/90 days (`formatProbability`), Recommended check (`timeframeLabel`), Breakdowns observed. Always "Expected end of life: {date or Not recorded}". See [failure-risk.md](failure-risk.md). | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Badge`, `Alert`, `AlertDescription` |
| `AssetMaintenanceSection` (`assets/$assetId/-components/asset-maintenance/asset-maintenance-section/asset-maintenance-section.tsx`) | "Maintenance" section: "Record repair" button (when `canRecord`, i.e. not deactivated) opens `RecordEventDialog` defaulting to `BREAKDOWN_REPAIR`. Lists events: an outline "Manual entry" badge, type label, `occurredOn`, a secondary "Previous unit" badge when `countsTowardForecast` is false, notes, then a `<dl>` of the known details (Findings, Work performed, Service provider, Parts replaced, Downtime (minutes); null ones are omitted, `0` downtime is shown), recorded by and at. Each event is a `Card`. A `SectionCard` (`Hammer`) with Record repair as its header action. Empty: `EmptyState` "No maintenance recorded yet" (description "Use Record repair to add the first entry" when `canRecord`, else "Repairs and completed work orders appear here"; no action - the header's Record repair is the entry point); load errors are `ErrorState`s (events: Retry; completions: "Retry completed work"). On save: close dialog, toast "Event recorded." | `Button`, `Badge`, `Card`, `CardContent`; `SectionCard`, `EmptyState`, `ErrorState` |
| `AssetCostsSection` (`assets/$assetId/-components/asset-costs-section/asset-costs-section.tsx`) | "Maintenance costs" `SectionCard` on the Costs sub-page (ID-50). Reads `useAssetEvents` and `useAssetWorkOrderCompletions` (no endpoint of its own) and builds one row per manual event and per completed work order, newest first: Date (`occurredOn`; completion `completedAt` as the viewer's local date), Entry (type label, or the work-order reference linked when `useWorkOrderAccess().canView`), Labour, Parts, Other ("Not applicable" for work orders) and Total, in SGD; null shows "Unknown", zero "0.00". A `FilterBar` ("Filter costs", `activeCount` 1 when a period is set, header Clear filters via `onClear`) holds a "Period" `DateRangePicker` (`sm:w-72`) that filters inclusively (empty end = unbounded); the range picker cannot be reversed. Title is the `SectionCard` title with `Receipt`; a load error is an `ErrorState` (Retry refetches both reads). Footer row header "Total", or "Known costs" with a note "N entries have unknown costs, not included in the totals." when any cost in range is unknown; column sums use known values only and are added as whole cents, the overall figure being labour + parts + other. No rows: `EmptyState` "No costs in this period" ("Try a longer period"). The table rendering lives in a local `CostTable`. | `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `Field`, `FieldLabel`, `Empty`; `FilterBar`, `DateRangePicker`, `SectionCard`, `ErrorState`, `EmptyState` |
| `RecordEventDialog` (`assets/$assetId/-components/asset-maintenance/asset-maintenance-section/record-event-dialog.tsx`) | Always-open "Record event" modal. Fields: `type` (req select, `assetEventTypeLabel`), `occurredOn` "Event date" (req `DatePicker`, defaults to `localToday()`, not in the future), `notes` (req, max 2000, trimmed). A second `FieldSet` "Maintenance details" ("Optional. Leave blank if not known.") holds Findings, Work performed and Parts replaced (`Textarea`, max 2500), Service provider (`Input`, max 200) and Downtime (minutes) (number `Input`, min 0) and Labour/Parts/Other cost (SGD) (decimal `Input`s, sent as trimmed strings); blank details and costs are left out of the request. Downtime that is not a whole number shows "Downtime must be a whole number of minutes."; a cost that is not 1–12 digits with at most two decimals shows "Enter an amount such as 120 or 120.50." Cancel and the close button are disabled while pending; failures keep input and show the error in a destructive `Alert`. Missing required fields show a `FieldError` (`role="alert"`) per field. Buttons sit in `DialogFooter`. | `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `Button`, `Input`, `Field`, `FieldSet`, `FieldLegend`, `FieldDescription`, `FieldLabel`, `FieldError`, `Alert`, `AlertDescription`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Textarea` |
| `AssessmentForm` (`assets/$assetId/-components/asset-overview/asset-condition-section/assessment-form.tsx`) | Fields: `condition` (req, `GOOD` / `NEEDS_ATTENTION` / `FAULTY`), `assessedOn` (req `DatePicker`, not clearable, defaults to `localToday()`, not in the future), `notes` (req, max 2000, trimmed). | `Button`, `Input`, `Label`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Textarea` |

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

## Page sections

Each page/form below is a short composition of named sections in the same
`-components/` folder, with its state, queries and handlers in a `use-*.ts`
hook beside it:

| Page / form | Hook | Sections |
| --- | --- | --- |
| `asset-register-page.tsx` | `use-asset-register-page.ts` | `asset-register-filters.tsx`, `asset-register-cards.tsx` (mobile), `asset-register-table.tsx` (desktop) |
| `asset-form.tsx` | `use-asset-form.ts` (values, validation, payload) | `asset-form-identity-fields.tsx` (reference/name/category/location), `asset-form-detail-fields.tsx` (installed date/manufacturer/model/serial), `asset-form-required-error.tsx` |
| `$assetId/-components/asset-details-page/asset-details-page.tsx` | `use-asset-details-layout.ts` | `asset-details-header.tsx`, `asset-details-nav.tsx` |
| `$assetId/-components/asset-overview/asset-condition-section/asset-condition-section.tsx` | `use-asset-condition-section.ts` | `asset-condition-history.tsx` |
| `$assetId/-components/asset-overview/asset-condition-section/assessment-form.tsx` | `use-assessment-form.ts` | `assessment-form-fields.tsx` |
| `$assetId/-components/asset-maintenance/asset-maintenance-section/asset-maintenance-section.tsx` | `use-asset-maintenance-section.ts` | `asset-maintenance-manual-entry.tsx`, `asset-maintenance-work-entry.tsx` |
| `$assetId/-components/asset-costs-section/asset-costs-section.tsx` | `use-asset-costs-section.ts` (rows, period) | `cost-table.tsx` |
| `$assetId/-components/inspection-history-table/inspection-history-page.tsx` | `use-inspection-history-page.ts` (cursors) | `inspection-history-records-table.tsx` |

## Register and lifecycle

`assets/-components/asset-register-page/asset-register-page.tsx` uses shadcn Table, Input, Field/FieldLabel,
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

`$assetId/-components/asset-maintenance/asset-retirement-panel/asset-retirement-panel.tsx` shows retirement metadata,
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

Register/detail/editor screens share `PageLayout` and `PageHeader`; deep
pages' breadcrumbs start at Assets. The register shows a compact desktop filter grid and a named Assets table with
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

There is no dashboard query to invalidate (the portfolio Home was removed).

## Register sorting

All six desktop headers use `components/table/sortable-table-head.tsx`: Reference,
Name, Category, Location, Current condition and Status. The shadcn header Button
shows ascending/descending icons and TableHead exposes aria-sort. Default is
Reference ascending. Selecting another text/status column starts ascending;
Current condition starts descending (worst first). Repeat selection reverses.

`lib/asset-sorting.ts` sorts a copy of the entire filtered API array. Text uses
natural English comparison, case-insensitively; categories use displayed labels
and locations use full displayed paths. Condition orders Good, Needs attention,
Faulty with unassessed last in either direction; Status orders Active, Retired.
Reference and ID break ties. All matching records remain present.

`assets/-components/asset-register-page/asset-sort-controls.tsx` provides the same choices for mobile
cards through shadcn Select (Sort assets by) and a Reverse asset sort direction
Button. Cards and the desktop table use the same ordered array. The route
validates and persists `sortBy`/`direction` in URL search. These are presentation
state and are stripped before calling `useAssets`; its generated API filters,
query key and endpoints remain unchanged. Sorting preserves filters, clearing
filters preserves sorting, and refresh/browser back restore both.
Sorting uses `resetScroll: false`, keeping the current page position as rows or
cards reorder. Other asset navigation retains its existing scroll behavior.

## Completed work orders in maintenance

`$assetId/-components/asset-maintenance/asset-maintenance-section/asset-maintenance-section.tsx` combines manual AssetEvent
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


## Estate reading browser entry (ID-60)

The owner asset-detail Devices section's Readings action now opens
`/estates/$estateId/readings?assetId=$assetId`, using the estate browser and
preselecting the current asset. Existing per-asset reading bookmarks still work.
The dedicated browser supports Owner/Manager/Crew reads independently of asset
register access; see [readings.md](readings.md).

## Screen states (design-system migration)

Every region follows [design-system.md](design-system.md#screen-states-empty-loading-filters-tabs):

- Loading is `LoadingState` everywhere (register `table`/`list`, inspection asset list `cards`,
  access checks and section loads `rows={2}`).
- Headers: list pages use `ListPageHeader` with the sidebar icon `Layers` (register, inspection
  asset list). Record pages use `DetailPageHeader` (asset details layout, inspection asset page:
  no icon, reference as `meta`). Create/edit pages use `FormPageHeader` (register/edit asset,
  register/replace device: breadcrumbs, title, description, no icon). Descriptions are fragments
  ("Equipment in this estate", "Equipment and its location", "Reference stays the same").
- Register: `ListPageHeader` actions are the `FilterToggle` ("Filters", with the active count)
  then "Create" (`CreateButton` to `/assets/new`, hidden for an inactive estate). Search and
  filters sit in one retractable `FilterBar` ("Filter assets", `useFilterPanel`; collapsed unless
  filters arrive from the URL) with `activeCount` (search, category, location, condition,
  non-default status) and `onClear`. Desktop filter selects are `Field className="w-full sm:w-48"`;
  on mobile the bar holds a "Choose filters" dialog trigger (renamed from "Filters" so it does not
  clash with the header toggle; "Choose filters (N)" with secondary filters applied).
  Empty: "No matching assets" ("Try fewer filters", `SearchX`) with an outline "Clear filters", or
  "No assets yet" (default `Inbox`) with "Create" when the estate is active. Location and asset
  load errors are `ErrorState`s ("Retry locations" / "Retry assets").
- Inspection-only asset list: `ListPageHeader` with a `FilterToggle`; the search form is the
  retractable `FilterBar` search with an outline `Search` submit. Empty is "No matching assets"
  (`SearchX`) / "No assets yet" (default icon). Errors are `ErrorState` ("Retry assets"). Paging is
  the shared `Pagination` ("Asset pages": Previous page / Next page over a cursor stack).
- Sections are `SectionCard`s; no section icon repeats the sidebar's - Condition `HeartPulse`,
  Maintenance `Hammer`, Service interval `CalendarClock`, Lifecycle history `ScrollText`,
  Inspection records `ListChecks`, Documents `FileText`, Maintenance costs `Receipt`, Devices
  `RadioTower`, Breakdown forecast `TrendingDown`. Their `EmptyState`s use the default `Inbox`
  ("No documents yet", "No lifecycle events yet", "No maintenance recorded yet", "No costs in this
  period", "No inspection records yet", "No devices yet" - the last with "Register device" when
  allowed). Load errors are `ErrorState`s. Documents and inspection history page with the shared
  `Pagination` ("Document pages", "Inspection history pages").
- Confirmations: replacing a device credential uses `ConfirmDialog`. Retire asset and Deactivate
  device also use `ConfirmDialog`, with `confirmDisabled` until the typed reference /
  identifier (and, for retire, date and reason) are valid.
- Dates: installation, event, assessment, retirement (retire and correct) and inspection dates are
  `DatePicker`s (required ones `clearable={false}`, `min`/`max` kept); costs use a
  `DateRangePicker`.
- Every form `SelectTrigger` is `w-full`.
