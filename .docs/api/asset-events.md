# Asset events API

Contract: `packages/api/openapi.json`. All event endpoints require bearer JWT and estate ownership. Missing authentication returns 401; foreign or missing estate or asset returns 404. Events are append-only: there is no update or delete.

A same-estate RESIDENT membership takes precedence over conflicting ownership and returns 403. Residency in another estate does not block an owner. MEMBER/COUNCIL membership or platform-admin authority alone does not grant access. Spring Security explicitly allows only the GET and POST operations below.

## GET `/estates/{estateId}/assets/{assetId}/events`

- path `estateId`: uuid (required)
- path `assetId`: uuid (required)
- 400: Missing or invalid details, a future date, or a date before installation — EstateError
- 401: Sign in required — EstateError
- 404: Estate or asset not found — EstateError
- 409: Inactive estate or deactivated asset — EstateError
- 200: Every event, newest first — AssetEventResponse[]

## POST `/estates/{estateId}/assets/{assetId}/events`

- path `estateId`: uuid (required)
- path `assetId`: uuid (required)
- Body: CreateAssetEventRequest
- 400: Missing or invalid details, a future date, or a date before installation — EstateError
- 401: Sign in required — EstateError
- 404: Estate or asset not found — EstateError
- 409: Inactive estate or deactivated asset — EstateError
- 201: Event recorded — AssetEventResponse

## AssetEventResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| id | uuid | yes |  |
| assetId | uuid | yes |  |
| category | MAINTENANCE | yes |  |
| type | BREAKDOWN_REPAIR / PREVENTIVE | yes |  |
| occurredOn | date | yes |  |
| notes | string | yes |  |
| assetManufacturer | string / null | no |  |
| assetModel | string / null | no |  |
| countsTowardForecast | boolean | yes |  |
| recordedByUserId | string | yes |  |
| recordedByName | string / null | no |  |
| createdAt | date-time | yes |  |
| findings | string / null | no |  |
| workPerformed | string / null | no |  |
| serviceProvider | string / null | no |  |
| partsReplaced | string / null | no |  |
| downtimeMinutes | integer / null | no |  |
| labourCost | string / null | no | SGD, two decimals |
| partsCost | string / null | no | SGD, two decimals |
| otherCost | string / null | no | SGD, two decimals |
| totalCost | string / null | no | SGD, two decimals; null when any cost is unknown |

## CreateAssetEventRequest

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| type | BREAKDOWN_REPAIR / PREVENTIVE | yes |  |
| occurredOn | date | yes |  |
| notes | string | yes | minLength=0, maxLength=2000 |
| findings | string | no | maxLength=2500 |
| workPerformed | string | no | maxLength=2500 |
| serviceProvider | string | no | maxLength=200 |
| partsReplaced | string | no | maxLength=2500 |
| downtimeMinutes | integer | no | minimum=0 |
| labourCost | string | no | pattern `[0-9]{1,12}(\.[0-9]{1,2})?` |
| partsCost | string | no | pattern `[0-9]{1,12}(\.[0-9]{1,2})?` |
| otherCost | string | no | pattern `[0-9]{1,12}(\.[0-9]{1,2})?` |

## EstateError

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| message | string | yes |  |

## Event rules

- Types are a fixed server-side catalogue, each in exactly one category: `BREAKDOWN_REPAIR` (the asset failed and was repaired; the "Repaired" button) and `PREVENTIVE` (serviced while still working), both `MAINTENANCE`. An unknown type returns 400 "Invalid event request. The type must be a supported one."
- `occurredOn` cannot be in the future (judged against the latest "today" anywhere, UTC+14) nor before the asset's `installedOn`; either returns 400. Validation failures return 400 as `field: message`.
- Recording requires an active estate and an active asset (409 otherwise); estate then asset rows are locked. Listing works for deactivated assets: their events are kept, only closed to new entries.
- Each event snapshots the asset's manufacturer and model at the time (`assetManufacturer`, `assetModel`, display names). `countsTowardForecast` is true when the type counts (both current types do), the date is on or after `installedOn`, and the snapshot matches the asset's current manufacturer and model: events from a replaced unit stay in history but stop feeding the forecast.
- `recordedByName` comes from WorkOS and may be null. A constraint that still fires returns 409.
- Maintenance details (ID-49) are optional: `findings`, `workPerformed`, `serviceProvider`, `partsReplaced` and `downtimeMinutes`. Text is trimmed; omitted or blank text is stored as null ("not known"). `downtimeMinutes` must be a JSON whole number of 0 or more: `0` means no downtime, null means not known. A negative or fractional number, a string, or text over its limit returns 400. Events recorded before ID-49 return null for all five. The details do not affect `countsTowardForecast` or the forecast.
- Costs (ID-50) are optional SGD decimal strings validated exactly as work-order completion costs: 1–12 whole digits, at most two decimals, not negative; scientific notation, excess precision, blanks and non-numbers return 400 with no write. Omitted means unknown (null); explicit zero stays zero. Responses are two-decimal strings (`"0"` → `"0.00"`). `totalCost` is the sum of the three and is null when any is unknown, matching work orders. Costs do not affect forecasts. Events recorded before ID-50 have null costs.
- Recording an event changes the derived failure risk (`failure-risk.md`) on the next read.

Example: `POST /estates/{estateId}/assets/{assetId}/events`

```json
{"type":"BREAKDOWN_REPAIR","occurredOn":"2026-10-02","notes":"Pump tripped",
 "findings":"Mechanical seal worn","workPerformed":"Replaced mechanical seal",
 "serviceProvider":"Acme Pumps","partsReplaced":"Mechanical seal","downtimeMinutes":90,
 "labourCost":"120","partsCost":"35.50","otherCost":"0"}
```

Completed work-order outcomes are read separately through
[work-order-completions](work-orders.md#progress-closure-and-asset-outcomes).
They are canonical WorkOrderCompletion records, not AssetEvent rows. The
Maintenance screen combines both read sources; closure alone does not change
forecast inputs or duplicate costs into manual maintenance history.
