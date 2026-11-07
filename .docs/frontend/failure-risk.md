# Failure risk (frontend)

Breakdown forecasts for an estate's assets. Paths are relative to
`apps/web/src/`. There is no failure-risk page: forecasts show as the
owner-only Risk flag column on Assets › By location and the forecast card on
the asset Overview (both in [assets.md](assets.md)), and the estate
dashboard's "At-risk assets" card (footer link "Risk by location" to
`/estates/$estateId/assets`).

## Routes

| File | URL | Does |
| --- | --- | --- |
| `routes/_auth/estates/$estateId/failure-risk/index.tsx` | `/estates/$estateId/failure-risk` | Retired. `beforeLoad` redirects (`replace: true`) to `/estates/$estateId/assets` (By location, which shows risk flags). No component. |

No sidebar item (removed in asset-centric navigation phase 4).

## Data (`lib/failure-risk.ts`)

Types: `FailureRisk` = `FailureRiskResponse`.

Constants: `timeframeLabel` (`WITHIN_30_DAYS` "Within 30 days", `WITHIN_60_DAYS`,
`WITHIN_90_DAYS`, `BEYOND_90_DAYS` "Beyond 90 days"); `flagReasonLabel`
(`CONDITION` "Condition", `FAILURE_RISK` "Failure risk", `END_OF_LIFE` "End of
life"). Helpers: `noForecastReason(risk)` ("Not supported" when `basis` is
`NOT_SUPPORTED`, "Not enough data" when `probability90Days` is null, else null);
`formatProbability(value)`.

Query keys: `estateFailureRiskQueryKey(userId, estateId)` =
`["estates", userId, "failure-risk", estateId]`;
`assetFailureRiskQueryKey(userId, estateId, assetId)` = the estate key plus
`assetId`, so invalidating the estate key refreshes both.

| Hook | Endpoint | On success |
| --- | --- | --- |
| `useEstateFailureRisk(estateId, enabled = true)` | `GET /estates/{estateId}/failure-risk` | query; also feeds the asset register's owner-only Risk flag column (see assets.md), which passes `enabled = owned` |
| `useAssetFailureRisk(estateId, assetId, enabled = true)` | `GET /estates/{estateId}/assets/{assetId}/failure-risk` | query (used by `AssetForecastCard`) |

Invalidated by `useRecordAssetEvent` (`lib/asset-events.ts`) and
`useRecordAssessment` (`lib/assessments.ts`, see [assets.md](assets.md)). Recording
an assessment refreshes both the asset card and estate list so their Condition
flags reflect the latest assessment without a page reload. All queries:
`enabled: ready`, `retry: false`, errors via `estateError`.

API: [api/failure-risk.md](../api/failure-risk.md).
