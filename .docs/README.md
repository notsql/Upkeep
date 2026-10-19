# .docs

The system as built, written so an agent can work from it without reading the
code (AGENTS.md rule 11). `.spec/features/` holds the plans made before
building; this folder describes what exists. Update the matching file in the
same change as the code.

**API:** `packages/api/openapi.json` remains the source of truth.

- [Admin role updates](api/admin-roles.md): self-demotion and last-active-admin
  protection for WorkOS organization roles.
- [Portfolio dashboard](api/dashboard.md): accessible estate counts and owner-scoped active-asset condition summaries.
- [Assets, register and lifecycle](api/assets.md): asset registration, filtering,
  retirement, restoration and lifecycle history, plus device registration,
  device credentials and `/device-api` authentication.
- [Council invitations and delegation](api/council-invitations.md): invitation,
  member listing, delegation, acceptance, and estate capability fields.
- [Asset catalogue](api/catalogue.md): asset categories, manufacturers and models.
- [Asset events](api/asset-events.md): recording and listing maintenance and repair events.
- [Failure risk](api/failure-risk.md): estate and per-asset breakdown forecasts.
- [Anomaly check](api/anomaly-check.md): anomaly-detection assessments from device readings.
- [Locations](api/locations.md): member-readable active hierarchy, owner-only
  historical reads and changes. Other API features are not yet documented here.
- [Access projection and admin estate grants](api/access.md): per-estate capabilities, unassigned accounts, protected resident memberships and explicit business-route authorization.
- [Resident fault reports](api/resident-reports.md): assignment context, locations, submission, own history and private images.

## Frontend (`apps/web`)

| File | Covers |
| --- | --- |
| [frontend/design-system.md](frontend/design-system.md) | Light/dark tokens, shared dashboard components, desktop/mobile navigation and conventions for future screens |
| [frontend/shell.md](frontend/shell.md) | Root layout, providers, header nav, home page (`/`), and conventions shared by every feature (API client, session gate, query-key prefix, errors) |
| [frontend/dashboard.md](frontend/dashboard.md) | Signed-in Home portfolio totals, condition breakdown, attention links and compact invitations |
| [frontend/auth.md](frontend/auth.md) | `/login`, `/register`, `/logout`, `/api/auth/*` handlers, `_auth` guard, idle sign-out, `AuthButton`, token bridge |
| [frontend/account.md](frontend/account.md) | `/account` |
| [frontend/estates.md](frontend/estates.md) | `/estates`, `/estates/new`, `/estates/$estateId`, `/estates/$estateId/edit`, directory filters and estate deactivation |
| [frontend/locations.md](frontend/locations.md) | Location hierarchy section on the estate details page |
| [frontend/assets.md](frontend/assets.md) | `/estates/$estateId/assets`, `/estates/$estateId/assets/new`, `/…/assets/$assetId`, `/…/assets/$assetId/edit`, asset register/search, retirement/restoration, lifecycle history, condition assessments, catalogue comboboxes, maintenance events, pump forecast card |
| [frontend/failure-risk.md](frontend/failure-risk.md) | `/estates/$estateId/failure-risk`: estate failure-risk table (asset forecast card and maintenance live in assets.md) |
| [frontend/devices.md](frontend/devices.md) | Device list on asset details and dedicated device registration page |
| [frontend/admin-users.md](frontend/admin-users.md) | `/admin/users`: member roles and per-user estate access |
| [frontend/council-invitations.md](frontend/council-invitations.md) | Estate Council invitations, delegated invitation permission, and acceptance |
| [frontend/resident-reports.md](frontend/resident-reports.md) | `/reports/new`, `/reports`, `/reports/$reportId`, resident navigation and per-user query hooks |
