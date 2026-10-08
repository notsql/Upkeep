# .docs

The system as built, written so an agent can work from it without reading the
code (AGENTS.md rule 11). `.spec/features/` holds the plans made before
building; this folder describes what exists. Update the matching file in the
same change as the code.

**API:** [Assets, register and lifecycle](api/assets.md).
`packages/api/openapi.json` remains the source of truth for the API contract.

## Frontend (`apps/web`)

| File | Covers |
| --- | --- |
| [frontend/shell.md](frontend/shell.md) | Root layout, providers, header nav, home page (`/`), and conventions shared by every feature (API client, session gate, query-key prefix, errors) |
| [frontend/auth.md](frontend/auth.md) | `/login`, `/register`, `/logout`, `/api/auth/*` handlers, `_auth` guard, idle sign-out, `AuthButton`, token bridge |
| [frontend/account.md](frontend/account.md) | `/account` |
| [frontend/estates.md](frontend/estates.md) | `/estates`, `/estates/new`, `/estates/$estateId`, `/estates/$estateId/edit`, estate deactivation, header `EstateSwitcher` |
| [frontend/locations.md](frontend/locations.md) | Location hierarchy section on the estate details page |
| [frontend/assets.md](frontend/assets.md) | `/estates/$estateId/assets`, `/estates/$estateId/assets/new`, `/…/assets/$assetId`, `/…/assets/$assetId/edit`, asset register/search, retirement/restoration, lifecycle history, condition assessments |
| [frontend/devices.md](frontend/devices.md) | Device list and registration on the asset details page |
| [frontend/admin-users.md](frontend/admin-users.md) | `/admin/users`: member roles and per-user estate access |
