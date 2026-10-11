# Anomaly check API

Contract: `packages/api/openapi.json`. Requires bearer JWT and estate ownership. Missing authentication returns 401; foreign or missing estate or asset returns 404. The browser calls only this endpoint; the server calls the internal `apps/ml` service to score the batch. Readings are scored, not stored.

## POST `/estates/{estateId}/assets/{assetId}/readings/anomaly-check`

- path `estateId`: uuid (required)
- path `assetId`: uuid (required)
- Body: AnomalyCheckRequest
- 400: Too few or too many readings, a missing or non-finite value, or bad timestamps — EstateError
- 401: Sign in required — EstateError
- 404: Estate or asset not found — EstateError
- 409: Not a pump, a deactivated asset, or an inactive estate — EstateError
- 503: The anomaly model is unavailable; nothing was recorded — EstateError
- 200: The batch was scored — AnomalyCheckResponse

## AnomalyCheckRequest

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| readings | Reading[] | yes |  |

## AnomalyCheckResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| readingsScored | int32 | yes |  |
| abnormalReadings | int32 | yes |  |
| longestAbnormalRun | int32 | yes |  |
| maxScore | double | yes |  |
| conditionRecorded | GOOD / NEEDS_ATTENTION / FAULTY | no |  |

## EstateError

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| message | string | yes |  |

## Reading

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| timestamp | date-time | yes |  |
| vibrationAcceleration | double | yes |  |
| pressure | double | yes |  |
| temperature | double | yes |  |
| flowRate | double | yes |  |
| power | double | yes |  |

## Check rules

- Pumps only, active estate and active asset; otherwise 409 ("Anomaly detection is only available for pumps.", or the inactive-estate / deactivated-asset message).
- Batch validation (400): 10 to 3,600 readings; every reading needs a `timestamp` and a finite value for all five metrics; timestamps must be unique; after sorting by timestamp, consecutive readings must be at most 2 seconds apart. Malformed JSON returns 400 "Invalid readings. Each needs a timestamp and a finite value for every metric."
- Readings may arrive in any order; the server sorts them before scoring. Each reading gets a score from `apps/ml`; a score >= 0.51 is abnormal.
- If `apps/ml` is unreachable, errors, or returns the wrong number of scores, the response is 503 and nothing is recorded. No row is locked while `apps/ml` is called.
- A run of 10 or more consecutive abnormal readings records a condition assessment: `FAULTY` when the run's median score is >= 0.98, else `NEEDS_ATTENTION`. It is only recorded when it differs from the asset's current condition. The assessment is dated to the run's last timestamp (UTC), recorded by `system:anomaly-model` named "Anomaly detection", with notes giving the run length, time span, median and maximum scores. `conditionRecorded` is that condition, or null when none was recorded.
- A recorded NEEDS_ATTENTION or FAULTY condition shows up as the `CONDITION` flag in `failure-risk.md`.

Example: `POST /estates/{estateId}/assets/{assetId}/readings/anomaly-check`

```json
{"readings":[{"timestamp":"2026-10-11T08:00:00Z","vibrationAcceleration":0.42,"pressure":3.1,"temperature":41.5,"flowRate":12.8,"power":5.6}]}
```

(10 or more readings in practice.) Response:

```json
{"readingsScored":60,"abnormalReadings":14,"longestAbnormalRun":12,"maxScore":0.97,"conditionRecorded":"NEEDS_ATTENTION"}
```
