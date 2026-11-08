# .docs

The system as built, written so an agent can work from it without reading the
code (AGENTS.md rule 11). `.spec/features/` holds the plans made before
building; this folder describes what exists. Update the matching file in the
same change as the code.

**API:** `packages/api/openapi.json` remains the source of truth.

- [Invoices and service reports](api/documents.md): private document upload, filename/type filtering, download, deletion and cleanup.
- [Asset document association](api/asset-documents.md): owner-authorized link/unlink, retired assets, attachment reads and work-order consistency.

- [Admin role updates](api/admin-roles.md): retired global WorkOS organization-role contracts; use estate-local roles.
- [Portfolio dashboard](api/dashboard.md): accessible estate counts and owner-scoped active-asset condition summaries (no longer called by the web app).
- [Work-order document association](api/work-order-documents.md): same-estate links, audited corrections, permission intersection and deletion integration.
- [Estates](api/estates.md): creation by any authenticated account, estate details, owner/assigned-Manager/custom-permission editing and owner-only deactivation.
- [Assets, register and lifecycle](api/assets.md): asset registration, filtering,
  retirement, restoration and lifecycle history, plus device registration,
  device credentials, device deactivation and replacement, and `/device-api`
  authentication.
- [Custom estate roles](api/estate-roles.md): versioned definitions, permission catalogue, bounded delegation, live enforcement, guarded deletion and release preparation.
- [Estate invitations, roles and ownership](api/council-invitations.md): invitation,
  member roles, ownership transfer, acceptance and estate capability fields.
- [Asset catalogue](api/catalogue.md): asset categories, manufacturers and models.
- [Estate asset categories](api/asset-categories.md): per-estate silent-failure flags (LIGHTING by default), service intervals, active-asset counts and append-only change history.
- [Service intervals](api/service-intervals.md): manufacturer service intervals (days, months or years) per estate category, per-asset overrides, the effective interval and append-only change history (ID-81).
- [Monthly inspection list](api/inspection-list.md): due spot checks for silent-failure assets, generation without duplicates, completion by inspection results, and overdue carry-over (ID-84, ID-86).
- [Asset events](api/asset-events.md): recording and listing maintenance and repair events.
- [Failure risk](api/failure-risk.md): estate and per-asset breakdown forecasts.
- [Device readings](api/device-readings.md): devices submitting readings with their API key; validation, duplicates, conflicts and last-seen.
- [Device telemetry](api/device-telemetry.md): devices submitting batches of up to 500 readings, with a per-item result (created, already stored, invalid, conflict); both device paths trigger asynchronous anomaly scoring.
- [Device status](api/device-status.md): derived Online/Offline/Awaiting first reading status and the Manager's estate-wide device list.
- [Readings](api/readings.md): Owner/Manager/Crew estate-wide filtering, minimal asset options, pagination and flags; attributed manual entry, Manual/Sensor provenance and filtered CSV export; legacy owner-only asset readings retained; complete filtered CSV v1 exports with provenance.
- [Anomaly check](api/anomaly-check.md): anomaly-detection assessments from device readings.
- [Flatlined sensors](api/flatlined-sensors.md): estate metric policies, per-device/metric maintenance pauses and derived reading reviews.
- [Locations](api/locations.md): member/responder-readable hierarchy, owner/responder
  historical reads, independent custom creation/editing and owner-only deactivation.
- [Access projection and retired global grants](api/access.md): per-estate capabilities, unassigned accounts, protected resident memberships and explicit business-route authorization.
- [Resident fault reports](api/resident-reports.md): assignment context, locations, submission, own history and private images.
- [Estate fault reports](api/estate-reports.md): Manager/Crew/custom-permission report reads, block/level-position and subtree filtering, private images and location correction.

Inspections: [API](api/inspections.md) · [Frontend](frontend/inspections.md).

Work orders: [API](api/work-orders.md) · [Frontend](frontend/work-orders.md).

## Frontend (`apps/web`)

| File | Covers |
| --- | --- |
| [frontend/asset-documents.md](frontend/asset-documents.md) | Document/asset link picker, explicit unlink and the asset detail Documents section |
| [frontend/work-order-documents.md](frontend/work-order-documents.md) | Document/work-order association dialog, correction history and work-order attachments |
| [frontend/documents.md](frontend/documents.md) | Estate Documents screen, responsive table/cards, asset links, permitted actions, upload/download/deletion and filename/type filtering |
| [frontend/design-system.md](frontend/design-system.md) | Light/dark tokens, shared components, header/sidebar navigation, page-header/breadcrumb convention and conventions for future screens |
| [frontend/shell.md](frontend/shell.md) | Root layout, providers, header (estate switcher, account menu), grouped estate sidebar (Assets group: Locations, Assets only), redirects for retired pages, shared destination predicates and route guards, resident sidebar, `/` redirects, and shared API/session/query/error conventions |
| [frontend/resident-dashboard.md](frontend/resident-dashboard.md) | Resident-only `/`: Open/In progress/Resolved count cards, five recent reports, Report a fault / View all |
| [frontend/auth.md](frontend/auth.md) | `/login`, `/register`, `/logout`, `/api/auth/*` handlers, `_auth` guard, idle sign-out, `AuthButton`, token bridge |
| [frontend/account.md](frontend/account.md) | `/account` |
| [frontend/estates.md](frontend/estates.md) | `/estates`, `/estates/new`, `/estates/$estateId`, `/estates/$estateId/edit` (Estate settings + Danger zone), directory filters and estate deactivation |
| [frontend/locations.md](frontend/locations.md) | Location hierarchy section on the estate details page |
| [frontend/assets.md](frontend/assets.md) | `/estates/$estateId/assets`, `/estates/$estateId/assets/new`, `/…/assets/$assetId` (+ `/details`, `/records`, `/costs`, `/devices` sub-pages; `/maintenance`, `/inspections`, `/documents` and legacy `?tab=` redirect), `/…/assets/$assetId/condition` (condition history), `/…/assets/$assetId/edit`, asset register/search grouped by block and level (By location) with device-summary and risk-flag columns, retirement/restoration, lifecycle history, condition assessments, catalogue comboboxes, maintenance events, maintenance costs, pump forecast card; asset Overview as the monitoring home (condition, forecast with risk level, trends, devices-online stat), attention banner on every asset tab |
| [frontend/failure-risk.md](frontend/failure-risk.md) | `/estates/$estateId/failure-risk` (redirects to `/assets`) and the failure-risk hooks behind By location's risk column, the asset forecast card and the dashboard's at-risk card |
| [frontend/asset-categories.md](frontend/asset-categories.md) | `/estates/$estateId/asset-categories` (+ `/$interval` views: days, months, years, not-set): silent-failure flags per asset category with asset counts and last change |
| [frontend/inspection-list.md](frontend/inspection-list.md) | `/estates/$estateId/inspections`: summary cards, generate/regenerate, checks grouped by block and level with Overdue/Due/Done badges, and unscheduled assets |
| [frontend/service-intervals.md](frontend/service-intervals.md) | Service interval column with unit-coloured labels, filter by unit or Not set, and dialog on Asset categories; the asset details `AssetServiceIntervalCard` |
| [frontend/devices.md](frontend/devices.md) | `/estates/$estateId/assets/devices` (Assets › All devices: every device ranked by severity with flatline state, pauses and a Metric policies dialog; `/estates/$estateId/devices` redirects there), device list on asset details, dedicated device registration and replacement pages, and device deactivation |
| [frontend/flatlined-sensors.md](frontend/flatlined-sensors.md) | `/estates/$estateId/sensors` and `/sensors/all` (redirect to `/assets/devices`); shared metric-policy and pause components and the flatline hooks |
| [frontend/formatting.md](frontend/formatting.md) | `lib/format.ts`: Intl-based dates (date-only without time-zone shift), instants, relative times, per-metric reading values, scores and model assessment notes |
| [frontend/readings.md](frontend/readings.md) | Estate-wide reading browser (`/…/readings`, linked from Assets as "All readings"), one asset's readings (`/…/readings/$assetId`; `?assetId=` redirects there) and the per-asset readings page (`/…/assets/$assetId/readings`, on the estate endpoint), attributed manual entry (`/…/readings/new`, `/…/readings/$assetId/new`), provenance, filters, pagination and month-sized performance evidence |
| [frontend/admin-users.md](frontend/admin-users.md) | `/admin/users`: member roles and per-user estate access |
| [frontend/estate-roles.md](frontend/estate-roles.md) | `/estates/$estateId/roles`: custom-role authoring, permission checklist, editing/deletion and capability-based entry |
| [frontend/council-invitations.md](frontend/council-invitations.md) | Estate role invitations, member-role controls, ownership transfer; pending invitations on /estates (/invitations redirects) |
| [frontend/resident-reports.md](frontend/resident-reports.md) | `/reports/new`, `/reports`, `/reports/$reportId`, resident navigation and per-user query hooks |
| [frontend/estate-reports.md](frontend/estate-reports.md) | Estate report list/detail, searchable block and numeric level-position filters, private images, location correction and Crew entry/navigation |

## Device simulator (`apps/device-simulator`)

- [frontend/device-simulator.md](frontend/device-simulator.md): local-only replay of SKAB test experiments to `POST /device-api/telemetry` (CSV validation, ground-truth windows, backfill/live runs, retry and stop).
