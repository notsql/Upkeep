# Failure risk (frontend)

Breakdown forecasts for an estate's assets. Paths are relative to
`apps/web/src/`; the route folder is `routes/_auth/estates/$estateId/failure-risk/`.
Requires sign-in. The asset-level forecast card and maintenance section on
asset details are documented in [assets.md](assets.md).

## Routes

| File | URL | Params | Title | Renders |
| --- | --- | --- | --- | --- |
| `index.tsx` | `/estates/$estateId/failure-risk` | `estateId` | "Failure risk" | `FailureRiskPage` (keyed by `estateId`) |

Entry point: "Failure risk" outline link (`buttonVariants`) on the estate
details page, shown to owners only. No sidebar item.

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `FailureRiskPage` (`-components/failure-risk-page.tsx`) | `PageHeader` with breadcrumbs Estates / estate name ("Estate" while loading) / Failure risk, and description "Chance of a breakdown in the next 30, 60 and 90 days. Flagged assets need a check." States: "Loading forecasts…" (`aria-live="polite"`), error message (destructive `Alert`), empty "There are no assets to forecast in this estate yet." (`role="status"`). Otherwise a table: Asset, Reference, 30 days, 60 days, 90 days, Check, End of life, Flags. | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `Badge`, `Empty`, `Alert`, `AlertDescription` |
| `RiskRow` (same file) | Asset name links to `/estates/$estateId/assets/$assetId`. When `noForecastReason` returns text ("Not supported" or "Not enough data") it spans the four forecast columns, muted; otherwise probabilities via `formatProbability` (rounded %, "—" when null) and `timeframeLabel` ("—" when null). End of life is `expectedEndOfLife` or "Not recorded". Each flag reason is a destructive `Badge` labelled by `flagReasonLabel`. | `TableRow`, `TableCell`, `Badge` |

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
| `useEstateFailureRisk(estateId)` | `GET /estates/{estateId}/failure-risk` | query |
| `useAssetFailureRisk(estateId, assetId, enabled = true)` | `GET /estates/{estateId}/assets/{assetId}/failure-risk` | query (used by `AssetForecastCard`) |

Invalidated by `useRecordAssetEvent` (`lib/asset-events.ts`, see
[assets.md](assets.md)). The page also reads `useEstate(estateId)` (key
`["estates", userId, "details", estateId]`) for the breadcrumb. All queries:
`enabled: ready`, `retry: false`, errors via `estateError`.

API: [api/failure-risk.md](../api/failure-risk.md).
