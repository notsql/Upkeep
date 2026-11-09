# Assets and condition assessments (frontend)

The asset profile includes History at `$assetId/_details/history/index.tsx`.
Council readers use a read-only directory/frame and redirect from the profile root
to History, without mounting owner-only queries/actions. The parent guard and
Assets navigation recognize `canViewAssetHistory`. Owner sections remain.
See [asset-history.md](asset-history.md) for routes, date filters, viewer, cache keys and refresh.

The asset detail page's **Records** tab stacks Inspections, Maintenance and the
route-local `AssetDocumentsSection`, in that order. It uses a shadcn Card/Table to show authorized linked files
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
| `index.tsx` | `/estates/$estateId/assets` | `estateId`; validated URL filters | "Assets" | `AssetRegisterPage`, Council `HistoryAssetList`, or `InspectionAssetList` |
| `devices/index.tsx` | `/estates/$estateId/assets/devices` | `estateId` | "All devices" | `AllDevicesPage` (see [devices.md](devices.md#all-devices-assets--all-devices)) |
| `new/index.tsx` | `/estates/$estateId/assets/new` | `estateId` | "Register asset" | `NewAssetPage` |
| `$assetId/route.tsx` | - | - | - | Plain `Outlet` parent, so `_details` below is pathless and does not swallow `edit`, `inspections/new`, `devices/new` and the rest |
| `$assetId/_details/route.tsx` | (pathless layout) | `estateId`, `assetId` | - | Owner `AssetDetailsLayout` around an `Outlet`; Council profile root redirects to History and its History branch renders an `Outlet`; otherwise `InspectionAssetPage` for inspection-only viewers (`!canViewAssets`) |
| `$assetId/_details/index.tsx` | `/estates/$estateId/assets/$assetId` | `estateId`, `assetId`; legacy `?tab=` (`history`; `maintenance`, `inspections`, `documents` -> `records`; `details`, `costs`, `devices`) redirects (replace) via `LEGACY_TABS` to the matching sub-page | "Asset details" | `AssetOverview` |
| `$assetId/_details/history/index.tsx` | `…/assets/$assetId/history` | `estateId`, `assetId`; optional validated `from`/`to` URL dates | "Asset history" | `HistoryDateFilter` and `AssetHistoryPage`, wrapped in `HistoryAssetFrame` for Council after date validation |
| `$assetId/_details/details/index.tsx` | `…/assets/$assetId/details` | `estateId`, `assetId` | "Asset details" | `AssetDetailsTab` (`-components/asset-details-tab/asset-details-tab.tsx`) |
| `$assetId/_details/records/index.tsx` | `…/assets/$assetId/records` | `estateId`, `assetId` | "Asset records" | `AssetRecords` (`-components/asset-records/asset-records.tsx`): `InspectionHistoryTable` (with `offerCreate`), `AssetMaintenance`, `AssetDocumentsSection`; each section gates itself |
| `$assetId/_details/{maintenance,inspections,documents}/index.tsx` | `…/assets/$assetId/<old section>` | `estateId`, `assetId` | - | No component: `beforeLoad` throws `redirect` (replace) to `…/records`, so old links keep working |
| `$assetId/_details/costs/index.tsx` | `…/assets/$assetId/costs` | `estateId`, `assetId` | "Asset costs" | `AssetCostsSection` |
| `$assetId/_details/devices/index.tsx` | `…/assets/$assetId/devices` | `estateId`, `assetId` | "Asset devices" | `AssetDevices` |
| `$assetId/condition/index.tsx` | `…/assets/$assetId/condition` | `estateId`, `assetId` | "Condition history" | `AssetConditionHistoryPage` (`condition/-components/asset-condition-history-page.tsx`); outside `_details`, like Readings |
| `$assetId/edit/index.tsx` | `/estates/$estateId/assets/$assetId/edit` | `estateId`, `assetId` | "Edit asset" | `EditAssetPage` |

Entry point: sidebar Assets › Assets (`assetsEntry`: `/assets` with `canOpenAssets`, i.e. `canViewAssets || canViewAssetHistory || canViewInspectionResults`; otherwise `/assets/devices` for the All devices audience); `/failure-risk` redirects to `/assets`; the register's `ListPageHeader` "Create" (`CreateButton`) opens Register asset. The `_auth` guard lets inspection-only viewers (`canViewInspectionResults`) open `/assets/$assetId`, `/assets/$assetId/records` and `/assets/$assetId/inspections` (which redirects to Records; the `_details` layout shows them `InspectionAssetPage` there); Council history readers can open the profile and History; other private sub-pages need `canViewManagement && canViewAssets`. The register has no breadcrumbs; deeper pages use section-first breadcrumbs (`Assets › <asset name>`, `Assets › Register asset`, `Assets › <asset name> › Edit`, `Assets › <asset name> › Condition history`). No back links; see the page header convention in [design-system.md](design-system.md).

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `NewAssetPage` (`assets/-components/asset-editor-page.tsx`) | `AssetForm` with no initial values. On save: toast "Asset {reference} registered.", navigate to the new asset's details. | - |
| `EditAssetPage` (`assets/-components/edit-asset-page.tsx`) | Loads the asset. If deactivated, shows "can no longer be edited" instead of the form. On save: toast "Asset details updated.", navigate to details. | - |
| `AssetForm` (`assets/-components/asset-form/asset-form.tsx`) | Read-only "Reference" when editing. Fields: `name` (req, max 200), `category` (req, select from `useAssetCategories`; placeholder "Loading categories…" while pending, error shown in a destructive `Alert`), `locationId` (req, select of `flattenLocations` paths from `useLocations`), `installedOn` (optional `DatePicker`), `manufacturer`, `model`, `serialNumber` (optional, max 200). Manufacturer and model are `SuggestField` comboboxes (free text, max 200): typing suggests names from `useManufacturers`; model suggestions come from `useAssetModels` only once a listed manufacturer was picked and a category is set. Any text is accepted; an unlisted name is added to the catalogue on save. Client-side required checks; blank optional fields are omitted from the payload. Each field is a `Field` with `FieldLabel`; missing required fields show a `FieldError` (`role="alert"`) linked by `aria-describedby`; a save failure shows a destructive `Alert`. | `Button`, `Input`, `Field`, `FieldSet`, `FieldLegend`, `FieldLabel`, `FieldDescription`, `FieldError`, `Alert`, `AlertDescription`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxList`, `ComboboxItem` |
| `AssetDetailsLayout` (`assets/$assetId/-components/asset-details-page/asset-details-page.tsx`, hook `use-asset-details-layout.ts`) | The shared frame of every asset sub-page. `AssetDetailsHeader` (`DetailPageHeader`): breadcrumbs `Assets › <name>`, title = name, Active/Retired `LifecycleStatusBadge` (Active `success`, Retired `muted`; see design-system status tones), `meta` = reference, and **no actions** (Edit and Retire live on the Details tab; inspections are created from Records' "New inspection" and the attention banner). Then `AssetAttentionAlert` (the banner, below), the retired notice (`Alert role="note"`) and `AssetDetailsNav`, a `SubNav` ("Asset sections": History, Overview (exact), Details, Records, Costs, Devices - each a route, see Routes). Devices carries a secondary `Badge` with the count of active devices (not deactivated) from `useDevices(estateId, assetId, enabled)`, enabled and shown only for `useAssetViewsAccess(estateId).devices` (owner or Manager) and hidden at 0; `SubNavItem.badge` renders after the label. The child sub-page renders only once `useAsset` has loaded. Loading is `LoadingState`; a load error is `ErrorState` (Retry refetches). | `Alert`, `AlertDescription`, `Badge`; `DetailPageHeader`, `SubNav`, `ErrorState` |
| `AssetAttentionAlert` (`asset-details-page/asset-attention-alert.tsx`, props `estateId`, `assetId`, `canInspect`) | Full-width banner on every tab, between the header and the tabs, while the current assessment (`useAssessments`, first entry, shared cache) is `NEEDS_ATTENTION` (`data-tone="warning"`) or `FAULTY` (`data-tone="destructive"`); colours and icon come from `conditionStyle` (`surface`, `icon`). One truncated line: the condition icon (`TriangleAlert` / `OctagonX`), "<condition> · flagged by <recorderName> on <formatDate>" and " · <formatAssessmentNotes>" (full note in `title`). A sm "File an inspection" link (default variant; destructive for Faulty) to `…/inspections/new` shows only when `canInspect` = asset active && estate active && `useInspectionAccess(estateId).canCreate`; otherwise the banner still shows, without the button. Shown to every viewer of the layout (the same audience as the Condition card). | `Alert`, `buttonVariants` |
| `AssetDetailsTab` (`asset-details-tab/asset-details-tab.tsx`, hook `use-asset-details-tab.ts`) | `SectionCard` "Details" (`ClipboardList`) with a `dl` (two columns from `sm`): Reference, Category (label from `useAssetCategories`), Location, Installation date (`formatDate`), Manufacturer, Model, Serial number; unrecorded values read "Not recorded". Header action: `sectionActionClassName` "Edit" link (`Pencil`) to `…/edit` while the asset is active. Then `AssetRetirementPanel` (moved here from Records). At the bottom, while active, a danger zone `section` "Retire asset" (`border-destructive/40 bg-destructive/5`, rounded border, explanation, destructive "Retire asset" button) that opens `DeactivateAssetDialog`; on success toast "Asset retired. Its record has been preserved." A retired asset shows neither Edit nor the danger zone (restore/correct are in the lifecycle panel). | `Button`, `buttonVariants`; `SectionCard`, `SectionHeading` |
| `AssetOverview` (`asset-overview.tsx`, same folder) | The asset's monitoring home, with as few cards as possible. In order: a wrapping row with `AssetSummary` (`asset-overview/asset-summary.tsx`), an unboxed muted `ul` `aria-label="Asset details"` on one wrapping line separated by `·`: category label from `useAssetCategories` (code fallback), `locationPath`, "Installed <formatDate>", "<manufacturer> <model>" (just one when both are the same, e.g. "GENERIC"), "Serial <serialNumber>"; unrecorded fields are left out, and the reference is not repeated; visible labels ("Installed", "Serial") are muted `text-xs`. On the right of that row, for owners and Managers, `DevicesOnlineStat` (`asset-overview/devices-online-stat.tsx`): a muted link "N of M devices online" (singular "device" for 1) to the Devices tab, M = active devices, N = those `ONLINE`, with a dot from `statusDotClassName`: `success` when all online (`data-tone="all"`), `warning` when some (`"some"`), `neutral` when none (`"none"`); hidden when there are no active devices. Then a grid of `AssetConditionSection` and `AssetForecastCard` (category `PUMP` **and** the viewer owns the estate, `useEstate().owned`): side by side at `lg` (equal height) when the forecast shows, Condition full width otherwise. `AssetUpcomingList` (when the viewer can see either of its sources, `canSeeInspections || canSeeService`) is passed as the Condition section's `upcoming` slot, so it renders inside the Condition card under a shadcn `Separator`; there is no separate Upcoming card. Then `AnomalyAlertsSection` (category `PUMP` and the viewer owns the estate or is a delegate; mounted but renders nothing while loading or when the asset has no alerts; read-only with a lock message while the estate is inactive or the asset retired; see [notifications.md](notifications.md)). Then `TrendsCard` (with `canViewReadings`). No device list and no attention banner here (the banner is on the layout). A section that its viewer may not call is not mounted, so it makes no request. | - |
| `TrendsCard` (`asset-overview/trends-card/trends-card.tsx`, with `metric-chart.tsx`, `metric-tooltip.tsx`, `trends-data.ts`) | Unboxed `section aria-label="Trends"` (no card, no visible heading or description): a light toolbar row (range `Select`, Live `Switch`, Refresh, "Updated <time>", and a "View as table" link to the Readings page, which holds the table), then metric tiles, the chart, anomaly bands and an accessible summary. No in-place table. See [readings.md](readings.md#asset-overview-trends). | `Select`, `Switch`, `Label`, `Skeleton`, `Button`, `Badge`, `ToggleGroup`, `Tooltip`, `ChartContainer`, `ChartTooltip`; `EmptyState`, `ErrorState` |
| `AssetMaintenance` (`asset-maintenance.tsx`, same folder) | `AssetMaintenanceSection`, `AssetServiceIntervalCard` for owner or Manager only (see [service-intervals.md](service-intervals.md); locked with a reason for an inactive estate or a retired asset). Lifecycle history moved to the Details tab. | - |
| `AssetDevices` (`asset-devices.tsx`, same folder) | `AssetDevicesSection` (see [devices.md](devices.md)), registration allowed while the asset is active. | - |
| `DeactivateAssetDialog` (`assets/$assetId/-components/asset-details-page/deactivate-asset-dialog.tsx`) | Always-open shared `ConfirmDialog` ("Retire <name>?", destructive "Retire asset", "Retiring…" while pending, `confirmDisabled` until the typed reference, date and reason are valid); exact reference plus retirement date and trimmed reason are required. Dates default to Singapore today and cannot precede known installation or exceed today. Submits the displayed lifecycle version. Closing blocked while pending. On success: toast "Asset retired. Its record has been preserved." | `ConfirmDialog`, `Input`, `Label`, `Textarea`, `DatePicker` |
| `AssetUpcomingList` (`asset-overview/asset-upcoming/asset-upcoming.tsx`, pure logic in `upcoming-items.ts`; props `estateId`, `assetId`, `installedOn`, `canSeeInspections`, `canSeeService`) | Card-less sub-section rendered inside the Condition card (via `AssetConditionSection`'s `upcoming` prop, after a `Separator`): a small muted h3 `SectionHeading` "Upcoming" (`CalendarClock` in `text-brand-2`), then a divided `ul aria-label="Upcoming"`, soonest first. Rows: **Inspection due** - this asset's checks on the estate inspection list (`useInspectionList(estateId, canSeeInspections)`, `checks` with `assetId` = this asset and `status` not `DONE`); **Service due** - the last `PREVENTIVE` event's `occurredOn` (`useAssetEvents(…, canSeeService)`), or `installedOn` if never serviced, plus the effective interval (`useAssetServiceInterval(…, canSeeService)`; `addInterval` clamps month/year steps to the month's last day); no row without both. Each row is a link to the Records tab (`…/records`): icon (`ClipboardList` / `Wrench`), title, `formatDate(dueOn)`, relative text ("in 5 days", "Due today", "3 days overdue"), `ChevronRight`; `data-tone` `overdue` (past, `destructive`), `soon` (within `UPCOMING_SOON_DAYS` = 14, `text-warning`) or `later` (muted). `canSeeInspections` = `canOpenInspections(permission, owned)`; `canSeeService` = owner or `canManageInvitationPermissions` (the Service interval card's audience); a source the viewer cannot see is never requested. Loading `LoadingState`; any source error: `role="alert"` "Some upcoming work could not be loaded."; nothing due: muted "Nothing scheduled". Open work orders are not listed: the work-order list endpoint has no asset filter. | `SectionHeading`, `LoadingState` |
| `AssetConditionSection` (`assets/$assetId/-components/asset-overview/asset-condition-section/asset-condition-section.tsx`, props `estateId`, `assetId`, `canRecord`, `upcoming?` (ReactNode, rendered after a `Separator` at the bottom of the card)) | `SectionCard` "Condition" (`HeartPulse`, `h-full`, content `flex-1` column so the footer sits at the bottom) with a `SECTION_ACTION` "Record assessment" header action (`ClipboardCheck`, when `canRecord`). A `role="status"` `aria-label="Current condition"` block from the first assessment (the API returns the current one first), or muted "Not assessed yet": a headline `text-2xl` condition label with its icon, both in the condition's colour (`conditionStyle`, `data-tone` `good` / `needs-attention` / `faulty`), one muted `text-xs` meta line "Assessed <formatDate> · <recorderName>", then the note (`formatAssessmentNotes`) as body text, `line-clamp-3` (full text in `title`). No badge. No inspection prompt here - that is the layout's `AssetAttentionAlert` banner. Footer, when there is more than one assessment: link-style sm "View history (N)" with a trailing `ArrowRight`, to the Condition history page. Record assessment opens a Dialog with Cancel; pending submission blocks dismissal. On save: close dialog, toast "Assessment recorded." Load errors are an `ErrorState` (Retry). | `Button`, `buttonVariants`, `Dialog`; `SectionCard`, `ErrorState`, `LoadingState` |
| `AssetConditionHistoryPage` (`assets/$assetId/condition/-components/asset-condition-history-page.tsx`, with `condition-history-list.tsx`) | Gated like the `_details` layout: `LoadingState` while `useInspectionAccess` is pending, destructive `Alert` "Asset access is unavailable." without `canViewAssets` (no request made). Otherwise `PageHeader` (`HeartPulse`, "Condition history", "Every assessment, newest first", breadcrumbs `Assets › <asset name> › Condition history`) and `ConditionHistoryList`: the full `useAssessments` list (the endpoint is not paginated, so all entries render) directly on the page (no card) as a vertical timeline, an `ol aria-label="Condition history"`, newest first. Each `li` (`data-tone` from `conditionStyle`) has a round `size-8` node with the condition icon (tinted per `conditionStyle.node`/`text`) joined to the next by a line down the left (hidden on the last); an `h2` month heading ("September 2026") on the first entry of each month; the condition label in its colour as text, an `info` "Current" badge on the first; a muted meta line `formatDate(assessedOn)` · source icon (`Cpu` for anomaly detection, `User` for a person) + `recorderName`; the full note (`formatAssessmentNotes`, `whitespace-pre-wrap`). All icons are `aria-hidden`. Empty: `EmptyState` "Not assessed yet"; errors `ErrorState` (Retry). | `Alert`, `Badge`; `PageHeader`, `EmptyState`, `ErrorState`, `LoadingState` |
| `AssetForecastCard` (`assets/$assetId/-components/asset-overview/asset-forecast-card.tsx`) | "Breakdown forecast" card from `useAssetFailureRisk`, no description. Loading "Loading forecast…", error in a destructive `Alert`. With probabilities: a `figure` "Forecast" (`data-tone` low/moderate/high) leads with the risk level from `riskLevel(probability90Days)` (`lib/failure-risk.ts`; `RISK_THRESHOLDS`: High at >= 30%, Moderate at >= 10%, else Low) as "Low risk" / "Moderate risk" / "High risk" and the 90-day % in `text-4xl`, both tinted (`text-success` / `text-warning` / `text-destructive`; Progress bars use the matching `bg-*` token), with "chance of a breakdown within 90 days"; under it a muted tinted row "Recommended check" + `timeframeLabel`. Then `ul aria-label="Chance by horizon"`: 30 / 60 / 90 days, each a small label + % and a thin shadcn `Progress` (`aria-label` "Chance within N days", value = rounded %) tinted by the same risk level. Flag reasons: muted line with a small `text-warning` `TriangleAlert`, "Flagged for a check because <reason>, <reason>"; `CONDITION` reads "Condition: Needs attention · Anomaly detection" (or "· <recorder name>"), "Condition needs a check" while assessments load or fail. If `noForecastReason` gives "Not supported" / "Not enough data", shows that instead of the numbers. Footer muted `text-xs` "Breakdowns observed: N · Expected end of life: {formatDate or Not recorded}". `h-full`. See [failure-risk.md](failure-risk.md). | `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Alert`, `AlertDescription`, `Progress` |
| `AssetMaintenanceSection` (`assets/$assetId/-components/asset-maintenance/asset-maintenance-section/asset-maintenance-section.tsx`) | "Maintenance" section (on the Records tab): "Record repair" `Link` styled with `sectionActionClassName` (`Wrench`; when `canRecord`, i.e. not deactivated) to `/estates/$estateId/assets/$assetId/maintenance/new`. Lists events: an outline "Manual entry" badge, type label, `occurredOn`, a secondary "Previous unit" badge when `countsTowardForecast` is false, notes, then a `<dl>` of the known details (Findings, Work performed, Service provider, Parts replaced, Downtime (minutes); null ones are omitted, `0` downtime is shown), recorded by and at. Entries are rows of a divided list (no card per entry, so no card-in-card). A `SectionCard` (`Hammer`) with Record repair as its header action. Empty: `EmptyState` "No maintenance recorded yet" (description "Use Record repair to add the first entry" when `canRecord`, else "Repairs and completed work orders appear here"; no action - the header's Record repair is the entry point); load errors are `ErrorState`s (events: Retry; completions: "Retry completed work"). | `Badge`; `SectionCard`, `EmptyState`, `ErrorState` |
| `AssetCostsSection` (`assets/$assetId/-components/asset-costs-section/asset-costs-section.tsx`) | "Maintenance costs" `PageSection` (no card) on the Costs sub-page (ID-50). Reads `useAssetEvents` and `useAssetWorkOrderCompletions` (no endpoint of its own) and builds one row per manual event and per completed work order, newest first: Date (`occurredOn`; completion `completedAt` as the viewer's local date), Entry (type label, or the work-order reference linked when `useWorkOrderAccess().canView`), Labour, Parts, Other ("Not applicable" for work orders) and Total, in SGD; null shows "Unknown", zero "0.00". A `FilterBar` ("Filter costs", `activeCount` 1 when a period is set, header Clear filters via `onClear`) holds a "Period" `DateRangePicker` (`sm:w-72`) that filters inclusively (empty end = unbounded); the range picker cannot be reversed. Title is the `PageSection` title with `Receipt`; a load error is an `ErrorState` (Retry refetches both reads). Footer row header "Total", or "Known costs" with a note "N entries have unknown costs, not included in the totals." when any cost in range is unknown; column sums use known values only and are added as whole cents, the overall figure being labour + parts + other. No rows: `EmptyState` "No costs in this period" ("Try a longer period"). The table rendering lives in a local `CostTable`, which first shows a `section aria-label="Cost summary"`: a `dl` stats row (2 columns, 4 from `sm`) of Labour, Parts, Other and Total ("Known total" when any cost is unknown) as whole-cent sums, with a muted "Amounts in SGD"; the table follows with no extra card. | `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, `Field`, `FieldLabel`, `Empty`; `FilterBar`, `DateRangePicker`, `PageSection`, `ErrorState`, `EmptyState` |
| `RecordRepairPage` (`assets/$assetId/maintenance/new/-components/record-repair-page.tsx`, route `/_auth/estates/$estateId/assets/$assetId/maintenance/new/`, head "Record repair") | `FormPage` "Record repair" with breadcrumbs Assets > asset name (`useAsset`, "Asset" while loading) > Record repair. `LoadingState` while the asset loads; a deactivated asset shows an alert instead of the form. Saves with `useRecordAssetEvent` (invalidates the asset events and estate failure-risk queries), toasts "Event recorded." and navigates to the asset's Records tab; Cancel navigates there too. | `FormPage`, `LoadingState` |
| `RecordRepairForm` (`assets/$assetId/maintenance/new/-components/record-repair-form.tsx`) | In a `FormCard`. `FieldSet` "Event": `type` (req select, `assetEventTypeLabel`, defaults to `BREAKDOWN_REPAIR`) and `occurredOn` "Event date" (req `DatePicker`, defaults to `localToday()`, not in the future) side by side on sm+, then `notes` (req, max 2000, trimmed). `FieldSeparator`, `FieldSet` "Maintenance details" ("Optional. Leave blank if not known."): Findings, Work performed, Parts replaced (`Textarea`, max 2500), Service provider (`Input`, max 200). `FieldSeparator`, `FieldSet` "Downtime & cost" (2-col on sm+): Downtime (minutes) (number `Input`, min 0) and Labour/Parts/Other cost (SGD) (decimal `Input`s, sent as trimmed strings). Blank details and costs are left out of the request. Downtime that is not a whole number shows "Downtime must be a whole number of minutes."; a cost that is not 1–12 digits with at most two decimals shows "Enter an amount such as 120 or 120.50." Missing required fields show a `FieldError` (`role="alert"`) per field; failures keep input and show the error in a destructive `Alert`. Footer is `FormActions` "Record repair" ("Saving…" while pending, both buttons disabled). | `FormCard`, `FormActions`, `Input`, `Field`, `FieldSet`, `FieldLegend`, `FieldDescription`, `FieldLabel`, `FieldError`, `FieldSeparator`, `Alert`, `AlertDescription`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Textarea` |
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
| `useAssetEvents(estateId, assetId, enabled = true)` | `GET /estates/{estateId}/assets/{assetId}/events` | query |
| `useRecordAssetEvent(estateId, assetId)` | `POST /estates/{estateId}/assets/{assetId}/events` | invalidate `assetEventsQueryKey(...)` and `estateFailureRiskQueryKey(userId, estateId)` (estate and per-asset forecasts) |

API: [api/asset-events.md](../api/asset-events.md). Anomaly-detection
assessments: [api/anomaly-check.md](../api/anomaly-check.md).

### `lib/assessments.ts`

Types: `Assessment` = `AssetAssessmentResponse`, `AssessmentInput` =
`CreateAssetAssessmentRequest`, `AssetCondition`. Helpers: `conditionLabel`,
`conditionStyle` (per condition: `tone`, lucide `icon` - `CircleCheck` / `TriangleAlert` /
`OctagonX` - and `text` / `surface` / `node` classes; shared by the banner, the Condition card
and the history timeline), `recordedByModel(assessment)`,
`localToday()` (browser-local `YYYY-MM-DD`), `ANOMALY_MODEL_USER_ID`
(`system:anomaly-model`), `recorderName(assessment)` ("Anomaly detection", the
recorder's name, or "Unknown user").

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
| `asset-register-page.tsx` | `use-asset-register-page.ts` | `asset-register-filters.tsx`, `asset-register-cards.tsx` (mobile), `asset-register-table.tsx` (desktop), `asset-monitoring-cells.tsx` (`DeviceSummary`, `RiskFlag`) |
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
`role="status"`). The table sits in a `rounded-xl border` overflow wrapper
(the readings-table pattern); each row links once, by name (`font-medium`,
underline on hover), with the reference as muted `font-mono text-xs` text, and shows
category, hierarchical location, latest condition and Active/Retired status.
Search is debounced 300ms.
Location filter options are memoized by the locations response, avoiding another
hierarchy build on each search keystroke; location changes refresh the options.
URL query fields q/category/locationId/condition/status
are validated in assets/index.tsx; invalid values are omitted. Filters combine
with AND; Clear filters returns to the default active register. Loading, retry,
empty and no-match states are explicit. Browser back restores URL filters.

### By location (asset-centric navigation, phase 2)

The register groups rows by block, then level, on desktop and mobile alike.
`groupAssetsByLocation(sortedAssets, locations)` (`lib/asset-monitoring.ts`)
resolves each asset's `locationId` in `useLocations(estateId, true)`: the
top-level ancestor is the block (`<h2>`), the next node the level (`<h3>`);
assets on the block itself form a "Block-wide" level shown first, and
unresolvable locations a final "Unknown location" group with no level
subheading. Groups follow the location tree (`flattenLocations` order: levels
highest first); inside a group the chosen sort applies. If no asset resolves
(or locations failed), the list renders ungrouped. Rows wait for the locations
request to settle (table/list skeleton) so they never regroup.

- Desktop: one `Table` "Assets"; each block is a `TableBody` whose first row is
  a `colgroup` `TableHead` (`colSpan` = all columns, `bg-muted/50`) holding a
  `Building2` icon (`text-brand-2`), the semibold block heading and a muted
  "N asset(s)" count, then a level row per level (`bg-muted/30`, indented
  `pl-6`, `Layers` icon, semibold `<h3>`, muted count).
- Mobile: a `section` per block; each level is a list labelled
  "`<block> › <level>` assets" ("`<block>` assets" for Unknown location); card
  names are `<h4>` when grouped, `<h2>` when ungrouped (list "Assets").

Monitoring columns, each mounted only for viewers its endpoint serves
(`useAppAccess` role, `EstateResponse.owned`):

| Column | Shown to | Source | Cell |
| --- | --- | --- | --- |
| Devices | owner or `MANAGER` | `useEstateDevices(estateId, enabled)` | `deviceSummaries`: "No devices", "N device(s) online", or "X of N offline" (offline and awaiting count as not online; deactivated excluded), after a status dot (`statusDotClassName`) whose tone is `deviceSummaryTones`: all online → `deviceStatusTone.ONLINE` (success), any not online → `deviceStatusTone.OFFLINE` (danger), none → muted (text muted too) |
| Risk | owner | `useEstateFailureRisk(estateId, enabled)` | destructive `Badge` "Flagged: <reasons>" (`flagReasonLabel`) when the entry has flag reasons; otherwise a muted "—" (`aria-hidden`) with sr-only "No risk data" |

While a source loads its cells show a `Skeleton` (`role="status"`, "Loading
device summary" / "Loading failure risk"); row order depends only on asset and
location data, so nothing moves when they resolve. A failed source makes its
cells "Unavailable" and shows one `ErrorState` naming the failed sources
("Device status could not be loaded.", "Failure risk could not be loaded.", or
"Device status and failure risk could not be loaded.") whose Retry refetches
only the failed ones; the rows stay. Only an assets failure blanks the list.
`AssetViewsNav` (`assets/-components/asset-views-nav.tsx`) is the `SubNav`
"Asset views": By location → `/assets` (exact) and All devices →
`/assets/devices`, a full-width line-variant tab strip whose border spans the
content width (same `SubNav` as Asset categories). The Assets views carry no
"All readings" link. It is rendered by `AssetRegisterPage`, `InspectionAssetList` (both
under their header) and `AllDevicesPage`, not by an `assets/route.tsx` layout,
because such a layout would also wrap asset detail and Register asset. The
tabs show only when the viewer can open asset pages (`canOpenAssets`) and All
devices (`canOpenAllDevices`); one tab alone would switch to nothing, so
Council (no asset pages) and Crew (no All devices) see no tab bar. Access
comes from `useAssetViewsAccess` in `lib/devices.ts`.

`useAssets(estateId, filters)` calls GET `/estates/{estateId}/assets`; key
`["estates", userId, "assets", estateId, "list", filters]`. Different filter
requests cannot overwrite each other's cache. `useLocations(estateId, true)`
fetches historical filter options; its key appends `"all"` to the ordinary
locations key, preserving active-only registration/edit pickers.

`$assetId/-components/asset-details-tab/asset-retirement-panel/asset-retirement-panel.tsx` (on the Details tab) shows retirement metadata,
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
table names remain links; references are plain text. Search stays visible; Filters opens an
Apply/Clear secondary filters/Cancel dialog. Draft changes do not query until
Apply; cancellation discards them. The count excludes search/default Active.
Page Clear resets filters while preserving sorting; dialog Clear retains search. Condition uses shared
ConditionBadge with success/warning/destructive/outline variants. LifecycleStatusBadge uses success Active
and muted (secondary) Retired labels, shared with estate status styling. Table order, linked
references/names, URL filters and back navigation retain their existing behavior.

Editors (`asset-editor-page.tsx`, `edit-asset-page.tsx`) use `FormPage`, with
`AssetForm` in a `FormCard`: `FieldSet` "Asset" (reference, name, category,
location), `FieldSeparator`, `FieldSet` "Equipment details" (installation date,
manufacturer, model, serial number - all optional), and `FormActions`
([design-system.md#forms-formpage-formcard-formactions](design-system.md#forms-formpage-formcard-formactions)). Edit-page loading, load errors (destructive `Alert`)
and the deactivated notice (in a `FormCard`) render inside the `FormPage`. Creation Cancel
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

The owner asset-detail Devices section's Readings action opens
`/estates/$estateId/readings/$assetId`, the estate browser with the asset fixed. Existing per-asset reading bookmarks still work.
The dedicated browser supports Owner/Manager/Crew reads independently of asset
register access; see [readings.md](readings.md).

## Screen states (design-system migration)

Every region follows [design-system.md](design-system.md#screen-states-empty-loading-filters-tabs):

- Loading is `LoadingState` everywhere (register `table`/`list`, inspection asset list `cards`,
  access checks and section loads `rows={2}`).
- Headers: list pages use `ListPageHeader` with the sidebar icon `Layers` (register, inspection
  asset list). Record pages use `DetailPageHeader` (asset details layout, inspection asset page:
  no icon, reference as `meta`). Create/edit pages use `FormPage` (its `FormPageHeader`; register/edit asset,
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
- Section headers are consistent across Overview, Details, Records and Devices: `SectionHeading` (`text-lg`, muted
  `size-5` icon) and header actions built with `SECTION_ACTION` / `sectionActionClassName`
  (`components/page/section-card.tsx`: sm outline) leading with an `aria-hidden` lucide icon:
  Record assessment `ClipboardCheck`, Record repair `Wrench`, New inspection `Plus`, Edit `Pencil`,
  Readings `Activity`, Register device `Plus`. Trends' toolbar "View as table" link leads with `Table`. No card sits inside a
  card: lists inside a section (maintenance entries, lifecycle events, condition history) are
  divided rows.
- Confirmations: replacing a device credential uses `ConfirmDialog`. Retire asset and Deactivate
  device also use `ConfirmDialog`, with `confirmDisabled` until the typed reference /
  identifier (and, for retire, date and reason) are valid.
- Dates: installation, event, assessment, retirement (retire and correct) and inspection dates are
  `DatePicker`s (required ones `clearable={false}`, `min`/`max` kept); costs use a
  `DateRangePicker`.
- Every form `SelectTrigger` is `w-full`.

## Colours

Tones come from `lib/status-tone.ts` (see [design-system.md](design-system.md)).
`conditionStyle` in `lib/assessments.ts` uses the `success` / `warning` / `destructive`
tokens for text, banner surface and timeline node. Page headers carry icon tiles: register and
asset detail `Package`/`Layers`, history `History`, inspections `ClipboardList` /
`ClipboardCheck`, condition `HeartPulse`, readings `Activity`, devices `Cpu`; form pages: new asset
`Package`, edit `Pencil`, new device `Cpu`, replace device `RefreshCw`, record repair `Wrench`,
new inspection `ClipboardCheck`. Every `EmptyState` in these screens passes the matching icon
(costs `Receipt`, documents `FileText`, lifecycle `Archive`, maintenance `Wrench`).
