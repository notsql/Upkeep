# Check schedules screen (ID-83, was "Asset categories")

API: [asset-categories.md](../api/asset-categories.md). The code and API still
say "asset category", "silent failure" and "service interval"; only the words
on screen are plain English (spec `.spec/features/navigation-regroup.md`).

## Routes

Folder-based under `src/routes/_auth/estates/$estateId/inspections/schedules/`, all titled "Check schedules":

| File | URL | Renders |
| --- | --- | --- |
| `route.tsx` | layout | `CheckSchedulesLayout` around an `Outlet` |
| `index.tsx` | `/estates/$estateId/inspections/schedules` | `CheckSchedulesList filter="ALL"` |
| `$interval/index.tsx` | `/estates/$estateId/inspections/schedules/$interval` | `CheckSchedulesList` for `days` / `months` / `years` / `not-set` (`INTERVAL_SLUGS`, `intervalFilterFor`); any other segment is `notFound()` in `beforeLoad` |

Old bookmarks: `asset-categories/index.tsx` and `asset-categories/$interval/index.tsx`
redirect (`replace`) to the matching `/inspections/schedules[/$interval]`. The
`_auth` guard still gates `asset-categories` (and one sub-view) with
`canOpenInspections`, so someone who cannot open Inspections gets a 404, not a
redirect.

Entry: the "Inspection views" `SubNav` on Inspections (**Check schedules** tab),
plus the Inspections page's "Set check schedules" and "Turn on regular checks"
links. There is no sidebar item; the sidebar's **Inspections** is active here.
Gate: `canOpenInspections` (`owned || canManageInvitationPermissions`). The
`_auth` guard covers the section root and up to two levels below it
(`SUB_VIEW_DEPTH.inspections = 2`), so `/inspections/schedules/days` 404s for
anyone else.

## Data (`src/lib/asset-categories.ts`)

| Hook | Call | Query key / effect |
| --- | --- | --- |
| `useEstateAssetCategories(estateId)` | GET `/estates/{estateId}/asset-categories` | `estateAssetCategoriesQueryKey(userId, estateId)` = `["estates", userId, "asset-categories", estateId]`; `retry: false` |
| `useSetSilentFailure(estateId)` | PUT `/estates/{estateId}/asset-categories/{category}/silent-failure` with `{ failsSilently }`; takes `{ category, failsSilently }` | on success invalidates the list key |

Both throw `estateError(...)` on failure. Interval saves use
`useSetCategoryServiceInterval` ([service-intervals.md](service-intervals.md)).

## Screen

`CheckSchedulesLayout` (`-components/check-schedules-layout/check-schedules-layout.tsx`):
`ListPageHeader` "Check schedules" (`Tags` icon, description "Choose which
equipment gets regular checks, and how often."), a visible hint line "Turn on
regular checks for equipment that can break without anyone noticing, like
emergency lights.", the "Inspection views" `SubNav` (`InspectionViews`, from
`inspections/-components/inspection-views.tsx`: **Due checks** (exact,
`/inspections`) and **Check schedules** (`/inspections/schedules`)), then a
`section` labelled "Check schedules" with the summary cards, a `SubNav` "Filter
by how often" (All (exact), Every few days, Every few months, Every few years,
No schedule; each its own URL) and the child view.

`CheckSchedulesList` (`-components/check-schedules-page/check-schedules-page.tsx`;
state in `use-check-schedules-list.ts`, table in `check-schedules-table.tsx`)
renders:

- when `estateActive` is false, a `role="note"` paragraph "This estate is
  inactive, so its check schedules can't be changed." and every row action
  disabled;
- a `Table` with no inline form controls: Equipment type (row header), Assets
  (`activeAssetCount`), Regular checks (a `warning` "On" `Badge`, or "Off"),
  How often (`IntervalBadge`: "Every 3 months", or plain "No schedule"), Last
  changed ("Never changed" when neither `lastChange` nor `lastIntervalChange`
  is set, else "<name or Unknown user> · <local date-time>" of the more recent
  one) and right-aligned actions: **Change how often** (aria-label "Change how
  often <Label> is checked") and **Turn on checks** / **Turn off checks**
  (aria-label "Turn on regular checks for <Label>" / "Turn off regular checks
  for <Label>"). Rows are sorted by label on the client.
- summary cards (`category-summary-cards.tsx`): **Regular checks on**, **No
  schedule yet** (with an outline sm "Show these" `Button` linking to
  `/inspections/schedules/not-set`) and **Schedule set**; see
  [service-intervals.md](service-intervals.md).

Turn on / off opens `silent-failure-dialog.tsx`, the shared `ConfirmDialog`:
title "Turn on regular checks for <Label>?" / "Turn off regular checks for
<Label>?", body "<Label> will show up on Due checks whenever it is due." /
"<Label> will no longer show up on Due checks.", confirm "Turn on" (default)
or destructive "Turn off" ("Saving…" while pending). Success closes the dialog
and toasts "Saved."; a failure keeps it open with the server's error as its
`role="alert"` line. Change how often opens `ServiceIntervalDialog`; success
toasts "Saved.", and a failure without a server message reads "Couldn't save.
Please try again." Loading is `LoadingState` "Loading check schedules…"
(`table`); a load error is an `ErrorState` (Retry). When a view matches nothing
the table is replaced by `EmptyState` "Nothing here" ("No equipment is checked
this often.") with an outline "Clear filters" link back to All.

shadcn components: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`,
`Badge`, `Button`, `buttonVariants`; from `src/components`: `ListPageHeader`, `SubNav`, `ErrorState`, `EmptyState`, `ConfirmDialog`, `ServiceIntervalDialog`.
