# Estate asset categories API (ID-83)

Contract: `packages/api/openapi.json`. Spec: `.spec/features/silent-failure-categories.md`.

An estate's view of the global asset-category catalogue (`/asset-categories`, see
[catalogue.md](catalogue.md)) with a per-estate **silent-failure flag** and each category's
active-asset count. Package `com.proj.server.category`.

## Access

Both endpoints require a bearer JWT subject (401 otherwise) and use `EstateRepository.findManaged`:
the estate owner or a same-estate `MANAGER` member. A same-estate `RESIDENT` gets 403; CREW,
COUNCIL, MEMBER, strangers and unknown estates get 404. Custom estate roles grant nothing here.
Both paths are explicitly allowed in `SecurityConfig`.

## GET `/estates/{estateId}/asset-categories`

- 200: `EstateAssetCategoriesResponse`
- 401 / 403 / 404: `EstateError`

Works for inactive estates (`estateActive: false`).

## PUT `/estates/{estateId}/asset-categories/{category}/silent-failure`

- path `category`: asset category code, e.g. `PUMP`
- body: `SetSilentFailureRequest`
- 200: `EstateAssetCategoryResponse`, the category after the change
- 400: `failsSilently` missing, null or not a JSON boolean (`"true"` and `1` are rejected) — `EstateError`
- 404: unknown category code (or estate not managed) — `EstateError`
- 409: inactive estate — `EstateError`

## DTOs

| DTO | Fields |
| --- | --- |
| SetSilentFailureRequest | failsSilently: boolean, required |
| EstateAssetCategoriesResponse | estateActive: boolean; categories: EstateAssetCategoryResponse[] (flagged first, then the rest, each ordered by label) |
| EstateAssetCategoryResponse | code: string; label: string; failsSilently: boolean; isDefault: boolean (no change recorded in this estate yet); activeAssetCount: integer (assets of this category in the estate with `deactivatedAt` null); lastChange: FlagChangeResponse or null |
| FlagChangeResponse | failsSilently: boolean; changedByUserId: string; changedByName: string or null (WorkOS snapshot); changedAt: date-time |

## Rules

- Default: with no recorded change, `LIGHTING` is flagged and every other category is not.
- Changes are append-only rows in `AssetCategoryFlagChange` (estateId, category, failsSilently,
  changedByUserId, changedByName, changedAt). The current flag is the latest row per category
  (by `changedAt`, then `id`).
- Setting the value a category already has (including its default) records nothing and returns the
  current state, so the history only holds real changes. A default stays a default.
- Flags are per estate; one estate's changes never affect another's.

Example: `PUT /estates/{estateId}/asset-categories/PUMP/silent-failure`

```json
{"failsSilently":true}
```

```json
{"code":"PUMP","label":"Pump","failsSilently":true,"isDefault":false,"activeAssetCount":3,
 "lastChange":{"failsSilently":true,"changedByUserId":"user_01","changedByName":"Casey Doe","changedAt":"2026-10-27T04:00:00Z"}}
```
