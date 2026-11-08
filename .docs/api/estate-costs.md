# Estate costs API (ID-34, ID-33)

Contract: `packages/api/openapi.json`. Spec: `.spec/features/estate-costs.md`.

Estate-wide cost views for the owner's Overview dashboard. Computed on read from the ID-50 cost data:
manual maintenance entries (`AssetEvent` labour/parts/other) and completed work orders
(`WorkOrderCompletion` labour/parts). Package `com.proj.server.cost`.

## Access

Both endpoints require a bearer JWT subject (401 otherwise) and use `EstateRepository.findOwned`:
estate owner only, the same as asset costs. A same-estate `RESIDENT` gets 403. Managers, Council,
Members, Crew, strangers and unknown estates get 404. Both work for inactive estates. Both paths
are explicitly allowed in `SecurityConfig`.

## Money rules

- SGD, summed as `BigDecimal`, and returned as two-decimal strings.
- An entry's known cost is the sum of its non-null parts. All parts null means no known cost.
- An entry "has unknown costs" when any part is null.

## GET `/estates/{estateId}/costs/top-assets` (ID-34)

- 200: `CostliestAssetResponse[]`, at most 5. Active assets only, ranked by total known spend
  (all manual entries plus all completed work orders, all time) highest first, then by reference.
- Assets with spend of zero or with no known cost are omitted.

| Field | Type |
| --- | --- |
| assetId | uuid |
| assetReference, assetName | string |
| category | category code |
| categoryLabel | `AssetCategory.label` |
| totalSpend | two-decimal string |
| entriesWithUnknownCosts | integer: entries of the asset with at least one null part |

## GET `/estates/{estateId}/costs/forecast` (ID-33)

- 200: `BudgetForecastResponse`.
- The window is `from` = today (Singapore) to `to` = `from + 12 months`, exclusive. Active assets only.

**Scheduled services:**

- Base date = last inspection `inspectedOn`, else `installedOn`. The next service is
  `ServiceInterval.after(base)`, moved up to `from` if it is earlier. Services repeat every interval
  while before `to`.
- Unit cost = the average known cost of the asset's `PREVENTIVE` entries with any known part.
  Without any, the same average over the estate's assets of the same category (retired included).

**Predicted repairs:**

- Pumps (`SILENT_FAILURE_CATEGORIES`) with a forecast.
- `FailureRiskCalculator.probabilityWithin(asset, events, from, 365)` is the expected repairs.
- Unit cost = the average known cost of the asset's `BREAKDOWN_REPAIR` entries plus completed work
  orders, else the category average.

**Totals and left-out assets:**

- An asset that would add services or a repair but has no unit cost is counted once in
  `assetsWithoutCostBasis` and left out.
- Each part's total is rounded to cents once. `total` = the sum of the two rounded parts.

| Field | Type |
| --- | --- |
| from, to | date (`to` exclusive) |
| total | two-decimal string |
| scheduledServices | `ScheduledServicesForecast { total: string, services: integer }` |
| predictedRepairs | `PredictedRepairsForecast { total: string, expectedRepairs: number (two decimals) }` |
| assetsWithoutCostBasis | integer |

## Example

```json
{ "from": "2026-11-08", "to": "2027-11-08", "total": "18300.00",
  "scheduledServices": { "total": "12000.00", "services": 14 },
  "predictedRepairs": { "total": "6300.00", "expectedRepairs": 1.6 },
  "assetsWithoutCostBasis": 3 }
```
