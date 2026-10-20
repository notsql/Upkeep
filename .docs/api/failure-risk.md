# Failure risk API

Contract: `packages/api/openapi.json`. Both endpoints require bearer JWT and estate ownership. Missing authentication returns 401; foreign or missing estate or asset returns 404; a malformed UUID returns 400 "Invalid failure-risk request.". Read-only: forecasts are derived on every read from asset events and never stored.

A same-estate RESIDENT membership takes precedence over conflicting ownership and returns 403. Residency in another estate does not block an owner. MEMBER/COUNCIL membership or platform-admin authority alone does not grant access. Both GET operations below are explicitly admitted by Spring Security.

## GET `/estates/{estateId}/assets/{assetId}/failure-risk`

- path `estateId`: uuid (required)
- path `assetId`: uuid (required)
- 401: Sign in required — EstateError
- 404: Estate or asset not found — EstateError
- 200: The asset's breakdown forecast and flags — FailureRiskResponse

## GET `/estates/{estateId}/failure-risk`

- path `estateId`: uuid (required)
- 401: Sign in required — EstateError
- 404: Estate or asset not found — EstateError
- 200: Active assets in silent-failure categories, flagged first, then by 90-day risk — FailureRiskResponse[]

## EstateError

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| message | string | yes |  |

## FailureRiskResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| assetId | uuid | yes |  |
| assetReference | string | yes |  |
| assetName | string | yes |  |
| category | string | yes |  |
| basis | SERVICE_INTERVAL / ASSET_HISTORY / INSUFFICIENT_DATA / NOT_SUPPORTED | yes |  |
| failuresObserved | int32 | yes |  |
| daysSinceLastEvent | int32 | no |  |
| probability30Days | double | no |  |
| probability60Days | double | no |  |
| probability90Days | double | no |  |
| recommendedTimeframe | WITHIN_30_DAYS / WITHIN_60_DAYS / WITHIN_90_DAYS / BEYOND_90_DAYS | no |  |
| expectedEndOfLife | date | no |  |
| flagged | boolean | yes |  |
| flagReasons | (CONDITION / FAILURE_RISK / END_OF_LIFE)[] | yes |  |

## Forecast rules

- Bayesian Weibull breakdown forecast, pumps only (category `PUMP`). Pump estimates: mean 1095 days between breakdowns, shape 1.2, prior weight 0.5, lifespan 15 years, end-of-life flag at 12 years. "Today" is UTC.
- Only events with `countsTowardForecast` feed the forecast (see `asset-events.md`). `daysSinceLastEvent` counts from the latest counting event, or from `installedOn` when there is none.
- `basis`:
  - `NOT_SUPPORTED`: not a pump. Probabilities, timeframe and end of life are null; `failuresObserved` 0.
  - `INSUFFICIENT_DATA`: a pump with no `installedOn` and no counting event. Same nulls.
  - `SERVICE_INTERVAL`: no counting breakdowns yet; forecast from the prior and the service interval.
  - `ASSET_HISTORY`: at least one counting `BREAKDOWN_REPAIR`.
- Probabilities are of a breakdown within the next 30/60/90 days, 0 to 1. `recommendedTimeframe` is the first window whose probability reaches the 0.15 threshold, else `BEYOND_90_DAYS`.
- `expectedEndOfLife` is `installedOn` + 15 years (null without `installedOn`).
- `flagReasons`, in this order: `CONDITION` (current condition is NEEDS_ATTENTION or FAULTY, including one recorded by anomaly check), `FAILURE_RISK` (90-day probability >= 0.15), `END_OF_LIFE` (12 or more years since installation). `flagged` is true when any reason applies.
- Per asset: works for any category and for deactivated assets. Estate list: only active assets in silent-failure categories (currently `PUMP`), ordered flagged first, then 90-day probability descending (nulls last), then reference.

Example: `GET /estates/{estateId}/failure-risk`

```json
[{"assetId":"…","assetReference":"EST-A0003","assetName":"Booster pump 1","category":"PUMP","basis":"ASSET_HISTORY","failuresObserved":2,"daysSinceLastEvent":410,"probability30Days":0.07,"probability60Days":0.13,"probability90Days":0.19,"recommendedTimeframe":"WITHIN_90_DAYS","expectedEndOfLife":"2034-03-01","flagged":true,"flagReasons":["FAILURE_RISK"]}]
```
