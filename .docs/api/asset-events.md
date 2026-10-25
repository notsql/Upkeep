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

## CreateAssetEventRequest

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| type | BREAKDOWN_REPAIR / PREVENTIVE | yes |  |
| occurredOn | date | yes |  |
| notes | string | yes | minLength=0, maxLength=2000 |

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
- Recording an event changes the derived failure risk (`failure-risk.md`) on the next read.

Example: `POST /estates/{estateId}/assets/{assetId}/events`

```json
{"type":"BREAKDOWN_REPAIR","occurredOn":"2026-10-02","notes":"Replaced mechanical seal"}
```

Completed work-order outcomes are read separately through
[work-order-completions](work-orders.md#progress-closure-and-asset-outcomes).
They are canonical WorkOrderCompletion records, not AssetEvent rows. The
Maintenance screen combines both read sources; closure alone does not change
forecast inputs or duplicate costs into manual maintenance history.
