# .docs

The system as built, written so an agent can work from it without reading the
code (AGENTS.md rule 11). `.spec/features/` holds the plans made before
building; this folder describes what exists. Update the matching file in the
same change as the code.

**API:** `packages/api/openapi.json` remains the source of truth.

- [Invoices and service reports](api/documents.md): private document upload, search, download, deletion and cleanup.

- [Admin role updates](api/admin-roles.md): retired global WorkOS organization-role contracts; use estate-local roles.
- [Portfolio dashboard](api/dashboard.md): accessible estate counts and owner-scoped active-asset condition summaries.
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
- [Estate asset categories](api/asset-categories.md): per-estate silent-failure flags (LIGHTING by default), active-asset counts and append-only change history.
- [Asset events](api/asset-events.md): recording and listing maintenance and repair events.
- [Failure risk](api/failure-risk.md): estate and per-asset breakdown forecasts.
- [Device readings](api/device-readings.md): devices submitting readings with their API key; validation, duplicates, conflicts and last-seen.
- [Device status](api/device-status.md): derived Online/Offline/Awaiting first reading status and the Manager's estate-wide device list.
- [Asset readings](api/readings.md): an owner's paginated, filterable list of an asset's readings with GAP, DUPLICATE_TIMESTAMP and OUT_OF_RANGE flags.
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
| [frontend/work-order-documents.md](frontend/work-order-documents.md) | Document/work-order association dialog, correction history and work-order attachments |
| [frontend/documents.md](frontend/documents.md) | Estate Documents screen, file validation, upload/download/deletion, filename search and capability-based navigation |
| [frontend/design-system.md](frontend/design-system.md) | Light/dark tokens, shared dashboard components, desktop/mobile navigation and conventions for future screens |
| [frontend/shell.md](frontend/shell.md) | Root layout, providers, header nav, home page (`/`), and conventions shared by every feature (API client, session gate, query-key prefix, errors) |
| [frontend/dashboard.md](frontend/dashboard.md) | Signed-in Home portfolio totals, condition breakdown, attention links and compact invitations |
| [frontend/auth.md](frontend/auth.md) | `/login`, `/register`, `/logout`, `/api/auth/*` handlers, `_auth` guard, idle sign-out, `AuthButton`, token bridge |
| [frontend/account.md](frontend/account.md) | `/account` |
| [frontend/estates.md](frontend/estates.md) | `/estates`, `/estates/new`, `/estates/$estateId`, `/estates/$estateId/edit`, directory filters and estate deactivation |
| [frontend/locations.md](frontend/locations.md) | Location hierarchy section on the estate details page |
| [frontend/assets.md](frontend/assets.md) | `/estates/$estateId/assets`, `/estates/$estateId/assets/new`, `/…/assets/$assetId`, `/…/assets/$assetId/edit`, asset register/search, retirement/restoration, lifecycle history, condition assessments, catalogue comboboxes, maintenance events, pump forecast card |
| [frontend/failure-risk.md](frontend/failure-risk.md) | `/estates/$estateId/failure-risk`: estate failure-risk table (asset forecast card and maintenance live in assets.md) |
| [frontend/asset-categories.md](frontend/asset-categories.md) | `/estates/$estateId/asset-categories`: silent-failure flags per asset category with asset counts and last change |
| [frontend/devices.md](frontend/devices.md) | `/estates/$estateId/devices` status list, device list on asset details, dedicated device registration and replacement pages, and device deactivation |
| [frontend/readings.md](frontend/readings.md) | `/estates/$estateId/assets/$assetId/readings`: reading list, metric/time/suspect filters, flag badges, pagination |
| [frontend/admin-users.md](frontend/admin-users.md) | `/admin/users`: member roles and per-user estate access |
| [frontend/estate-roles.md](frontend/estate-roles.md) | `/estates/$estateId/roles`: custom-role authoring, permission checklist, editing/deletion and capability-based entry |
| [frontend/council-invitations.md](frontend/council-invitations.md) | Estate role invitations, member-role controls, ownership transfer and /invitations |
| [frontend/resident-reports.md](frontend/resident-reports.md) | `/reports/new`, `/reports`, `/reports/$reportId`, resident navigation and per-user query hooks |
| [frontend/estate-reports.md](frontend/estate-reports.md) | Estate report list/detail, searchable block and numeric level-position filters, private images, location correction and Crew entry/navigation |
