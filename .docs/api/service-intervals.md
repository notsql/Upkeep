# Service intervals API (ID-81)

Contract: `packages/api/openapi.json`. Spec: `.spec/features/service-intervals.md`.

How often the manufacturer says equipment should be serviced, as a **whole number with a unit**
(`DAY`, `MONTH` or `YEAR`, stored as entered and never converted): one interval per asset category
per estate, which any single asset can override. Package `com.proj.server.category`
(`ServiceIntervalController`, `ServiceIntervalService`, `ServiceIntervalRepository`; the category
interval is set through `AssetCategorySettingsService`).

## Access

Every endpoint requires a bearer JWT subject (401 otherwise) and uses `EstateRepository.findManaged`,
as in [asset-categories.md](asset-categories.md): the estate owner or a same-estate `MANAGER`
member. A same-estate `RESIDENT` gets 403; CREW, COUNCIL, MEMBER, strangers and unknown estates get
404. An asset that is not in the estate gets 404. All paths are explicitly allowed in
`SecurityConfig`.

## PUT `/estates/{estateId}/asset-categories/{category}/service-interval`

- path `category`: asset category code, e.g. `PUMP`
- body: `SetServiceIntervalRequest`
- 200: `EstateAssetCategoryResponse` (see [asset-categories.md](asset-categories.md)), the category
  after the change, with its flag too
- 400: invalid body (see below) — `EstateError` whose message starts with `interval`
- 404: unknown category code (or estate not managed) — `EstateError`
- 409: inactive estate — `EstateError`

The current category interval is also returned by GET `/estates/{estateId}/asset-categories` as
`serviceInterval` and `lastIntervalChange` on each category.

## GET `/estates/{estateId}/assets/{assetId}/service-interval`

- 200: `AssetServiceIntervalResponse`
- 401 / 403 / 404: `EstateError`

Works for inactive estates and retired assets.

## PUT `/estates/{estateId}/assets/{assetId}/service-interval`

- body: `SetServiceIntervalRequest`; `{"interval": null}` removes the override
- 200: `AssetServiceIntervalResponse`, the asset after the change
- 400: as for the category PUT — `EstateError`
- 404: asset not in the estate (or estate not managed) — `EstateError`
- 409: inactive estate, or a retired asset (`deactivatedAt` or `retiredOn` set) — `EstateError`

## DTOs

| DTO | Fields |
| --- | --- |
| ServiceInterval | value: integer; unit: `"DAY" \| "MONTH" \| "YEAR"`. Limits: 1–3650 days, 1–120 months, 1–10 years |
| SetServiceIntervalRequest | interval: ServiceInterval or null, **required key** |
| AssetServiceIntervalResponse | effective: ServiceInterval or null; source: `"ASSET" \| "CATEGORY" \| "NONE"`; override: ServiceInterval or null; categoryInterval: ServiceInterval or null (this estate's interval for the asset's category); categoryLabel: string; lastOverrideChange: IntervalChangeResponse or null |
| IntervalChangeResponse | interval: ServiceInterval or null (null = cleared); changedByUserId: string; changedByName: string or null (WorkOS snapshot); changedAt: date-time |

400 cases: `{}`; `interval` not an object; `value` or `unit` missing; a unit other than the three
(case-sensitive, so `"month"` is refused); a value that is not a JSON integer (`"6"`, `6.5`); a value
below 1 or above the unit's limit.

## Rules

- Effective interval: the asset's override if set (`ASSET`), else its category's interval in the
  estate (`CATEGORY`), else none (`NONE`, `effective: null`). No category has a default.
- Changes are append-only rows: `AssetCategoryIntervalChange` (estateId, category) and
  `AssetIntervalChange` (assetId), each with intervalValue, intervalUnit, changedByUserId,
  changedByName and changedAt. The current value is the latest row (by `changedAt`, then `id`);
  a row with both interval columns null clears it. A `CHECK` on each table allows only both-null or
  a value within its unit's limit.
- Setting the interval already current (same value and unit, or clearing one already clear) records
  nothing and returns the current state. "12 MONTH" and "1 YEAR" are different values.
- Changing a category's interval never touches overrides; an override equal to the category's
  interval stays an override.
- Server-side callers (ID-80, ID-84) use `ServiceIntervalService.effective(estateId, assetId)`,
  which returns `EffectiveInterval(interval, source)` without an access check. Due dates are
  calendar arithmetic on the unit (add N days, months or years).
- In the contract, every nullable object field above is a `oneOf` of its schema and `null`
  (`ServiceIntervalOpenApiConfiguration`), so the generated types include `| null`.

Example: `PUT /estates/{estateId}/assets/{assetId}/service-interval`

```json
{"interval":{"value":90,"unit":"DAY"}}
```

```json
{"effective":{"value":90,"unit":"DAY"},"source":"ASSET","override":{"value":90,"unit":"DAY"},
 "categoryInterval":{"value":6,"unit":"MONTH"},"categoryLabel":"Pump",
 "lastOverrideChange":{"interval":{"value":90,"unit":"DAY"},"changedByUserId":"user_01","changedByName":"Casey Doe","changedAt":"2026-11-01T04:00:00Z"}}
```
