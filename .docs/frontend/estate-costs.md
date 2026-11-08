# Estate cost widgets (ID-34, ID-33)

API: [estate-costs.md](../api/estate-costs.md).

## Where

The estate Overview (`/estates/$estateId`), in the dashboard's list row
(`routes/_auth/estates/$estateId/-components/estate-details-page/estate-dashboard.tsx`, `DashboardLists`),
after At-risk assets. Shown only when `DashboardAccess.costs` is true, which is
`Boolean(permission && owned)`, so only the estate owner. Other roles never fetch them.

## Widgets

- **Maintenance budget** (`budget-forecast-card.tsx`): a `Card` region.
  - The description is "Next 12 months: 8 Nov 2026 – 7 Nov 2027". The end date is the day before
    the exclusive `to`.
  - It shows the total in large text, then "Scheduled services: S$… (N services)" and "Predicted
    repairs: S$… (N expected repairs)". Singular forms are used for 1.
  - When nothing is projected: "No services or repairs to project."
  - "N assets left out: no cost history to estimate from" when any are left out.
  - A load error shows in a `role="alert"` line.
- **Costliest assets** (`costliest-assets.tsx`): a `ListCard` "Top five by total maintenance spend".
  - Each row links to `/estates/$estateId/assets/$assetId/costs` and shows the reference,
    "Name · Category", "N entries with unknown costs" when any, and the spend on the right.
  - Empty: "No maintenance costs recorded yet."

## Data (`src/lib/estate-costs.ts`)

| Hook | Call | Query key |
| --- | --- | --- |
| `useCostliestAssets(estateId)` | GET `/estates/{estateId}/costs/top-assets` | `["estates", userId, "costs", estateId, "top-assets"]` |
| `useBudgetForecast(estateId)` | GET `/estates/{estateId}/costs/forecast` | `["estates", userId, "costs", estateId, "forecast"]` |

Both throw `estateError(...)`. `formatSgd("12480.00")` gives "S$12,480.00" with string grouping, so
there is no float rounding. `formatDay(iso, exclusive?)` gives "8 Nov 2026".
