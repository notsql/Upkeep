# Failure risk (frontend)

Breakdown forecasts for an estate's assets. Paths are relative to
`apps/web/src/`; the route folder is `routes/_auth/estates/$estateId/failure-risk/`.
Requires sign-in. The asset-level forecast card and maintenance section on
asset details are documented in [assets.md](assets.md).

## Routes

| File | URL | Params | Title | Renders |
| --- | --- | --- | --- | --- |
| `index.tsx` | `/estates/$estateId/failure-risk` | `estateId` | "Failure risk" | `FailureRiskPage` (keyed by `estateId`) |

Entry point: sidebar Assets › "Failure risk", shown by `canOpenFailureRisk`
(owners only); the `_auth` guard loads ownership and 404s otherwise.

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `FailureRiskPage` (`-components/failure-risk-page.tsx`) | `ListPageHeader` (no breadcrumbs, filters or create) with `icon={AlertTriangle}` and description "Breakdown odds over 30, 60 and 90 days". States: `LoadingState` "Loading forecasts…" (table skeleton), `ErrorState` (message + outline Retry, refetches), `EmptyState` "No assets to forecast yet" (default `Inbox`, "Forecasts appear once assets are added"). Otherwise a table: Asset, Reference, 30 days, 60 days, 90 days, Check, End of life, Flags. | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `Badge`; `ListPageHeader`, `EmptyState`, `ErrorState`, `LoadingState` |
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

Invalidated by `useRecordAssetEvent` (`lib/asset-events.ts`) and
`useRecordAssessment` (`lib/assessments.ts`, see [assets.md](assets.md)). Recording
an assessment refreshes both the asset card and estate list so their Condition
flags reflect the latest assessment without a page reload. The page also reads `useEstate(estateId)` (key
`["estates", userId, "details", estateId]`) for the breadcrumb. All queries:
`enabled: ready`, `retry: false`, errors via `estateError`.

API: [api/failure-risk.md](../api/failure-risk.md).
