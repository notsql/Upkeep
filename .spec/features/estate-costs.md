# Costliest assets and budget forecast (ID-34, ID-33)

**Status:** built (2026-11-08; open questions accepted as proposed)
**Owner:** Yan Hein Latt
**Jira:** [ID-34](https://notjira.atlassian.net/browse/ID-34) top 5 costliest assets,
[ID-33](https://notjira.atlassian.net/browse/ID-33) budget forecasting
(epic [ID-10](https://notjira.atlassian.net/browse/ID-10) Council Dashboard and Budgeting)
**Depends on:** maintenance costs (ID-50, `maintenance-costs.md`), work-order completion costs
(ID-40), service intervals (ID-81), failure-risk forecast (ID-32, `failure-risk.md`)

## Problem

Maintenance costs are recorded per asset (ID-50) but can only be seen one asset at a time. The
council cannot tell which equipment is draining the maintenance budget without opening every asset,
and it has no figure for what next year's maintenance is likely to cost. The data to answer both
already exists:

- past spend on manual maintenance entries and completed work orders;
- service intervals;
- breakdown forecasts.

| Story | Adds |
| --- | --- |
| ID-34 | A "Costliest assets" widget on the estate dashboard: the top five assets by total maintenance spend, each linking to its cost history. |
| ID-33 | A "Maintenance budget" widget: the projected cost of the next 12 months, made of scheduled services (from intervals) and predicted repairs (from the forecast). |

## Behaviour

### Who

- Both widgets are on the estate **Overview** dashboard (`/estates/$estateId`).
- They are for the **estate owner**, the same audience as asset costs (ID-50), asset pages and the
  Flagged assets widget.
- Anyone else gets 404 from the endpoints and sees no widget.
- Both work for inactive estates.

### Money rules (shared)

- All amounts are SGD, summed exactly as decimals, never floating point.
- They are returned as two-decimal strings, the ID-50 rule.
- An entry's **known cost** is the sum of its known parts:
  - manual entry (`AssetEvent`): `labourCost + partsCost + otherCost`;
  - completed work order (`WorkOrderCompletion`): `labourCost + partsCost`.
- Unknown (null) parts count as nothing. An entry with every part unknown has **no known cost**.
- Costs are computed on read, so a cost recorded a moment ago is included on the next load
  ("updates in real time").

### Costliest assets (ID-34)

- An asset's **total spend** is the sum of the known costs of all its manual entries and all its
  completed work orders, over all time.
- The widget lists the **five active assets** with the highest total spend, highest first.
  - Ties go by asset reference, A to Z.
  - Retired assets are left out.
  - Assets with no known cost are left out, so fewer than five can be listed.
- Each row shows:
  - the asset reference and name;
  - the category label;
  - the total spend, e.g. "S$12,480.00";
  - a note "N entries with unknown costs" when any of its entries has no known cost or a
    missing part.
- Each row links to the asset's cost history, `/estates/$estateId/assets/$assetId/costs`.
- With no spend at all the widget says "No maintenance costs recorded yet."

### Budget forecast (ID-33)

- The **forecast window** runs from today (Singapore) for 12 months: `[today, today + 12 months)`.
- The projected budget is **scheduled services + predicted repairs**, over active assets only.

**Scheduled services** (rule-based):

- They use the asset's effective service interval (ID-81) and the same clock as the inspection
  list and service-due notifications: the last inspection date, else `installedOn`.
- The next service is `base + interval`. If that is before today, the next service is today.
  Services then repeat every interval.
- Every service date inside the window counts once. For example, a 6-month interval due next week
  gives 2 services.
- The **cost per service** is the average known cost of the asset's own `PREVENTIVE` entries.
  - Without one, it is the average known cost of `PREVENTIVE` entries for assets of the same
    category in the estate.
  - Without either, the asset has **no cost basis**.

**Predicted repairs** (from the ID-32 forecast):

- They cover pumps whose forecast basis is `ASSET_HISTORY` or `SERVICE_INTERVAL`.
- The **expected number of repairs** in the window is the forecast's probability of breaking down
  within 365 days. This is the same Weibull model the 30/60/90-day probabilities come from, so it is
  between 0 and 1 per pump.
- The **cost per repair** is the average known cost of the asset's own `BREAKDOWN_REPAIR` entries
  and completed work orders.
  - Without one, it is the same average over assets of the same category in the estate.
  - Without either, the asset has **no cost basis**.
- The predicted repair cost is the probability × the cost per repair.

**The widget:**

- It shows:
  - the total ("S$18,300.00");
  - the window ("8 Nov 2026 – 7 Nov 2027");
  - the two parts: "Scheduled services S$12,000.00 (14 services)" and "Predicted repairs
    S$6,300.00 (1.6 expected repairs)".
- Assets that would add a service or a repair but have no cost basis are **left out of the total**.
  The widget says "N assets left out: no cost history to estimate from".
- With nothing to project, the total is S$0.00 with the note "No services or repairs to project."

## Data

No schema change. It reads `Asset`, `AssetEvent`, `WorkOrder` with `WorkOrderCompletion`,
`AssetInspectionResult`, and the interval and event tables the existing services already read.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/costs/top-assets` | - | `200 CostliestAssetResponse[]` (at most 5) | estate owner; 403 same-estate resident; 404 otherwise |
| GET | `/estates/{estateId}/costs/forecast` | - | `200 BudgetForecastResponse` | estate owner; 403 same-estate resident; 404 otherwise |

- **`CostliestAssetResponse`:** `assetId`, `assetReference`, `assetName`, `category`,
  `categoryLabel`, `totalSpend` (two-decimal string), `entriesWithUnknownCosts` (int).
- **`BudgetForecastResponse`:**
  - `from` (date), `to` (date, exclusive), `total` (string);
  - `scheduledServices { total: string, services: int }`;
  - `predictedRepairs { total: string, expectedRepairs: number (two decimals) }`;
  - `assetsWithoutCostBasis` (int).

### Web

- `apps/web/src/lib/estate-costs.ts` with `useCostliestAssets(estateId)` and
  `useBudgetForecast(estateId)`. Keys are `["estates", userId, "costs", estateId, "top-assets" |
  "forecast"]`.
- Two new widgets in `routes/_auth/estates/$estateId/-components/estate-details-page/`:
  - `budget-stat.tsx`, a `SummaryCard` in the stat row;
  - `costliest-assets.tsx`, a list card beside Flagged assets.
- Both are gated by a new `DashboardAccess.costs` (owner only).

## Edge cases

- **An asset with costs only on work orders**, or only on manual entries, still ranks.
- **A cost of exactly zero is known.** A row whose parts are all zero has spend 0 and is not
  listed, because it is not costly.
- **A completed work order without an asset** is ignored, since it belongs to no asset.
- **Open or cancelled work orders** have no completion, so they add nothing.
- **A retired asset** is in neither widget, but its entries still feed the category averages,
  because its history is real cost data.
- **No interval and no forecast:** the asset contributes nothing and is not counted as left out.
- **A very short interval** (e.g. 1 day) gives up to 365 services. The total stays exact.
- **A pump with both an interval and a forecast** contributes both, since preventive services
  and breakdown repairs are different costs.
- **Rounding:** each part is rounded to cents once, at the end. The total is the sum of the two
  rounded parts, so the widget's figures always add up.

## Out of scope

- Purchase or replacement price. The system doesn't record it, so "lifecycle cost" here means
  maintenance spend.
- Financial years, inflation, contingency and budget approval.
- Charts, exports, per-asset forecast breakdowns and date-range filters on the widgets.
- Showing costs to Managers, Council or other roles (see Open questions).
- Invoices (`invoice-service-report-uploads.md`) have no cost fields yet, so "as invoices are
  processed" is met by work-order completions and manual entries.

## Decisions

1. **Owner only.**
   - This matches ID-50 asset costs, asset pages (`canViewAssets` is owner-only) and the Flagged
     assets widget. A council member who isn't the owner couldn't open the drill-down anyway.
   - The alternative was owner, Manager and Council. That needs asset pages opened up first.
   - To change it, look at `DashboardAccess.costs` and the two service access checks.
2. **Lifecycle cost means maintenance spend.**
   - No purchase price is stored.
   - The alternative was adding a purchase-price field, which is new data entry and out of scope.
3. **A rolling 12 months, not a financial year.**
   - The acceptance criteria say "upcoming 12-month period".
   - The alternative was April-March (Singapore government financial year).
   - To change it, look at the window in the forecast service.
4. **Expected repairs is the 365-day breakdown probability, not a count of repeat failures.**
   - The model gives the chance of the next breakdown, not how many will follow, so a pump adds
     at most one expected repair.
   - The alternative was simulating repeated failures, which is more model than this needs.
5. **Unit costs come from history: the asset's own, else its category's in the estate.**
   - Assets with neither are left out and counted, never guessed.
   - The alternative was fixed default prices per category, which would be invented numbers.

## Implementation phases

- [x] **1. Server, ID-34:** top-assets endpoint and integration tests (ranking, ties, retired,
  unknown parts, work orders and entries, access).
- [x] **2. Server, ID-33:**
  - the calculator gains a public 365-day probability;
  - forecast endpoint and tests (service counting, overdue, unit-cost fallbacks, left-out assets,
    window, access).
- [x] **3. Contract:** `pnpm api:generate`.
- [x] **4. Web:** hooks, the two widgets, `DashboardAccess.costs`, and tests.
- [x] **5. Wrap-up:**
  - `.docs/api/estate-costs.md`, `.docs/frontend/estate-costs.md` and the README index;
  - `pnpm check-types`, `pnpm test`, `pnpm fix`.

## Open questions

1. **Who sees the widgets.**
   - Proposed: owner only (Decision 1).
   - Should Managers or Council see the cost totals too, even though they can't open asset pages
     today?
2. **Financial year.**
   - Proposed: a rolling 12 months.
   - Does the council budget by financial year (April-March)?
3. **Retired assets in the top five.**
   - Proposed: left out.
   - Do you want "all-time costliest", including retired equipment?
