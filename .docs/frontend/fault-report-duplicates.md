# Duplicate fault report screens (ID-74)

API: [api/fault-report-duplicates.md](../api/fault-report-duplicates.md).
Residents' `/reports` screens show nothing about duplicates.

## Hooks (`apps/web/src/lib/estate-reports.ts`)

| Hook | Call | Notes |
| --- | --- | --- |
| `useEstateReportAccess(estateId).canReviewDuplicates` | access context | `canViewFaultReports && canReviewFaultReportDuplicates` |
| `useEstateReportList`, `useEstateReport` | GET list and detail | Unchanged keys; data is now the `EstateIssueReport*Response` types (`EstateReport` is the detail type) |
| `useReviewEstateReportDuplicate(estateId, reportId)` | PATCH `/estates/{estateId}/reports/{reportId}/duplicate` | Body `{ state, expectedState }` |
| `useLinkEstateReportDuplicate(estateId, reportId)` | PUT `/estates/{estateId}/reports/{reportId}/duplicate` | Body `{ originalReportId }` |

On success, both mutations:
- write the returned detail to `[userId, "estate-reports", estateId, "detail", reportId]`;
- invalidate `[userId, "estate-reports", estateId, "list"]`, every
  `[userId, "estate-reports", estateId, "detail"]` (so the original's counts
  refresh) and `[userId, "work-orders", estateId]` (work-order counts).

Neither mutation checks the capability inside `mutationFn`. The access hook is
not ready on a freshly mounted component's first render, so a check there would
refuse a quick first click. The actions render only for managers, and the
server enforces it.

## Shared components (`apps/web/src/components/reports/`)

- `duplicate-badges.tsx`:
  - `DuplicateBadges` shows shadcn Badges for "N duplicate(s)" (confirmed),
    "N to review" (suspected), and "Possible duplicate" or "Duplicate" for the
    report's own link.
  - `DuplicateStateBadge` is the single state badge.
- `report-card.tsx` has an optional `badges` slot in the card header.
- `report-source-picker.tsx` (`ReportSourcePicker`) moved here from
  `work-orders/new/-components/` because two routes use it. It gained optional
  `label`, `chooseLabel`, `emptyText` and `excludeId` props; the defaults keep
  the work-order wording. It never offers a report with `duplicateOf` set, since such a report can be neither a work-order source nor an original. Its test is at
  `tests/components/reports/report-source-picker.test.tsx`.

## Routes

| Route folder | What it shows |
| --- | --- |
| `estates/$estateId/reports/index.tsx` | Each report card passes `<DuplicateBadges>` into `ReportCard`'s `badges` slot. |
| `estates/$estateId/reports/$reportId/index.tsx` | `-components/duplicate-section.tsx` below the report card (details below). |
| `estates/$estateId/work-orders/` list | `-components/duplicate-count-badge.tsx` puts an "N duplicate(s)" Badge beside the priority in the table and mobile cards when `sourceReportConfirmedDuplicateCount > 0`. |
| `estates/$estateId/work-orders/$workOrderId` | The detail adds "Duplicate reports: N confirmed duplicate(s)" when the count is above 0. |

`duplicate-section.tsx` renders up to three labelled `<section>` regions, each a
shadcn Card:

- **Duplicate** (the report has a link):
  - "Possible duplicate of" or "Duplicate of", then a Link to the original;
  - a note that the report cannot get its own work order, plus, for a suspected
    link, that rejecting it allows one. The route hides Create work order
    whenever `duplicateOf` is set.
  - With `canReviewDuplicates`: Confirm (suspected only) and Not a duplicate
    Buttons, sending the state the caller saw as `expectedState`. A 409 shows
    an Alert with Reload, which resets the mutation and refetches. Other errors
    show the server's message.
- **Duplicates** (the report is an original):
  - "N confirmed" and "N to review" Badges;
  - a list of linked reports, each a Link, a `DuplicateStateBadge` and its
    location label.
- **Mark as duplicate** (`canReviewDuplicates`, no active link and no
  duplicates):
  - `ReportSourcePicker` labelled "Original report", with this report excluded;
  - a "Link as duplicate" Button, disabled until an original is chosen;
  - a 400 shows the server's message in an Alert.

Tests:
- `tests/routes/_auth/estates/$estateId/reports/$reportId/index.test.tsx`
  (detail section);
- `tests/routes/_auth/estates/$estateId/reports/index.test.tsx` (list badges);
- `tests/routes/_auth/estates/work-order-list.test.tsx` and
  `work-order-detail.test.tsx` (work-order counts).
