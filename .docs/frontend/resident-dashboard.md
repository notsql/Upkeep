# Resident dashboard (frontend)

The signed-in `/` for resident-only accounts
(`hasResidentMembership && !canEnterWorkspace`). Paths are relative to
`apps/web/src/`. No new route: `routes/index.tsx` skips its redirects for these
accounts and `routes/-components/home-page.tsx` renders `ResidentHome`, which
passes `useCurrentEstate().estateId` (the `estateId` search param, else the sole
resident estate) to `ResidentDashboard`.

## Screen

`routes/-components/resident-dashboard.tsx` — `ResidentDashboard({ estateId? })`:

- `PageLayout` + `PageHeader` titled "Dashboard", action "Report a fault"
  (`buttonVariants()` link to `/reports/new`, with `estateId` when known).
- Loading: `role="status"` "Loading reports…". Error: destructive `Alert`
  "Unable to load reports.".
- Three count `Card`s (each `role="region"` named by its label): **Open**,
  **In progress**, **Resolved**, read from `counts` on the response.
- "Recent reports" section (`h2`): the first 5 `items` as shared `ReportCard`s,
  each title linking to `/reports/$reportId` (keeping `estateId`), plus an
  outline "View all" link to `/reports` when there are items.
- Empty state: "You haven't reported any faults yet." and a "Report a fault"
  link.

shadcn: `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Alert`,
`AlertDescription`, `buttonVariants`.

The resident sidebar (`components/estates/resident-navigation.ts`) shows
"Dashboard" -> `/` only for resident-only accounts; mixed resident + staff
accounts follow the staff `/` redirect. See [shell.md](shell.md).

## Data

| Hook | Endpoint | Query key |
| --- | --- | --- |
| `useReportList(undefined, estateId)` (`lib/reports.ts`) | `GET /resident/reports?estateId=` | `[userId, "reports", "list", estateId, undefined]` |

Response `ResidentReportPageResponse`: `items`, `nextCursor`, and
`counts: { open, inProgress, resolved }` computed server-side over every report
the resident can see (all pages), scoped by `estateId` when given. See
[../api/resident-reports.md](../api/resident-reports.md#report-counts). No
mutations; report submission already invalidates the
`[userId, "reports", "list"]` prefix, which refreshes the dashboard.
