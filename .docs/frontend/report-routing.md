# Report routing and contractor email (frontend, ID-70)

API: [../api/report-routing.md](../api/report-routing.md).

## Hooks

`apps/web/src/lib/report-routing.ts`:

| Hook | Call | Query key / invalidation |
| --- | --- | --- |
| `useRoutingAccess(estateId)` | access projection | `canManage` = `canCreateWorkOrders`; `canViewWorkOrders` |
| `useSendToContractor(estateId, reportId)` | POST `…/reports/{reportId}/work-order` `{ equipmentType, priority }` | invalidates `[userId, "estate-reports", estateId]` and `[userId, "work-orders", estateId]` |
| `useDismissReport(estateId, reportId)` | POST `…/reports/{reportId}/dismiss` | same |
| `useWorkOrderDispatch(estateId, workOrderId)` | GET `…/work-orders/{workOrderId}/dispatch` | `[userId, "work-orders", estateId, "dispatch", workOrderId]`; returns the dispatch or `null` |
| `useDispatchWorkOrder(estateId, workOrderId)` | POST `…/work-orders/{workOrderId}/dispatch` | same invalidation as send |
| `useRetryDispatch(estateId)` | POST `…/work-orders/{workOrderId}/dispatch/retry` | same |

The file also exports labels: `EQUIPMENT_TYPES` (Pump, Lift, Gate,
Common-area light, Plumbing), `ROUTING_STATES` (Classifying, Needs review, Work order
created, Dismissed), `PRIORITIES`, `workOrderStatusLabel` and
`dispatchStatusLabel` (Sending, Sent <time>, Failed to send).

`apps/web/src/lib/contractors.ts` holds `useContractors` (key
`[userId, "estate-contractors", estateId]`, enabled for `canCreateWorkOrders`),
`useSaveContractor` and `useRemoveContractor`.

`useEstateReport` (`lib/estate-reports.ts`) refetches every 5 s while
`routing.state` is `CLASSIFYING`. `EstateReport` is `EstateReportDetailResponse`.

`lib/report-routing.ts` also owns `FAULT_CATEGORIES` (value + plain label,
"Something else" last), `categoryLabel`, `CATEGORY_CONTRACTOR_TYPE` (WATER_LEAK,
DRAINAGE → PLUMBING; BROKEN_LIGHT → LIGHT; RUBBISH, ILLEGAL_DUMPING → CLEANING;
GRAFFITI, ROAD_DAMAGE → REPAIRS; NOISE, PARKING → SECURITY; OTHER → none),
`explainReason(reason)` and `useChangeCategory(estateId, reportId)`: PUT
`/estates/{estateId}/reports/{reportId}/category` with `{ category }`,
invalidating `[userId, "estate-reports", estateId]` (detail and list) and the
estate's work orders. `EQUIPMENT_TYPES` includes Cleaning, Painting and repairs
and Security. `ROUTING_STATES` labels `CLASSIFYING` "Sorting".

## Screens

- **`/estates/$estateId/contractors`** (`routes/_auth/estates/$estateId/contractors/`):
  `PageHeader` with breadcrumbs, then one Card per equipment type
  (`-components/contractor-row.tsx`) with labelled Inputs ("Lift contractor
  name" and "email"), "Save lift contractor", and a "Remove lift contractor"
  Dialog. The `_auth` guard returns Not Found without `canCreateWorkOrders`, and
  navigation shows "Contractors" (HardHat icon) in the Administration group only
  with that capability.
- **Estate report list:** desktop adds a "Type" column (secondary Badge with
  `categoryLabel`, empty when the report has no category) before a "Next step"
  column (outline Badge with `routingStateLabel`, or "—"); mobile rows show the
  type Badge and "Next step: <state>". A "Next step" Select
  (`-components/routing-state-filter.tsx`, first option "All") keeps
  `routingState` in the URL alongside the block and level filters.
- **Estate report detail** (`reports/$reportId/`): see
  [estate-reports.md](estate-reports.md#report-detail-page). Routing shows in
  `-components/next-step-card.tsx`, a "Next step" SectionCard by state:
  - `CLASSIFYING`: "Sorting this report…" (the page polls every 5 s);
  - `NEEDS_REVIEW`: "Waiting for you to decide" (crew: "Waiting for a
    manager") and the reason via `explainReason`: "No PLUMBING contractor
    configured" reads "No plumbing contractor is set up for this estate." with
    a "Set one up" link to `/estates/$estateId/contractors` (managers only);
    "Confidence below threshold" reads "We weren't sure enough what kind of
    problem this is."; other reasons show as sent. With `canCreateWorkOrders`:
    - "Send to contractor" (`send-to-contractor-dialog.tsx`): "Contractor type"
      and "Priority" Selects, the type preselected from
      `CATEGORY_CONTRACTOR_TYPE[category]` (falling back to the
      classification's `equipmentType`; the dialog is keyed by it so a type
      change re-suggests), the recipient named before sending, and "Send work
      order". When the chosen type has no contractor it says so and links "Set
      up contractors";
    - "Dismiss" (`dismiss-report-dialog.tsx`), confirmed with "Dismiss report";
  - `WORK_ORDER`: "Sent to a contractor" (or "Work order created" with no
    email), the work order reference (linked when `canViewWorkOrders`) and
    status, contractor, email status, approval, and "Retry sending" for
    managers when the email failed;
  - `DISMISSED`: "Dismissed" and "No contractor was emailed about this report."
  The page header swaps "Create work order" for an outline "View work order"
  link once `routing.workOrder` exists.
- **Change type** (`-components/change-category-dialog.tsx`, in the Details
  card's Type row): shown with `canCreateWorkOrders` when the report has
  routing that is not `CLASSIFYING`. A Dialog with a shadcn `RadioGroup` "Type
  of problem" of the ten `FAULT_CATEGORIES` and "Save type" (disabled until a
  different type is chosen). Calls `useChangeCategory`; server errors (409
  while sorting) show in an Alert inside the dialog. It never sends anything.
- **Work-order detail:** the route (`$workOrderId/index.tsx`) passes a
  `sections` slot to `WorkOrderDetailPage`. For `EQUIPMENT_FAULT` orders from a
  resident report, the slot renders `-components/work-order-contractor-email.tsx`:
  a "Contractor email" Card with the contractor, equipment, email status and
  approval, or "No contractor has been emailed about this work order." With
  `canCreateWorkOrders` it offers "Email contractor" (a Dialog ending in
  "Assign and email", with the same "Set up contractors" link when the type has
  no contractor) for open orders, and "Retry sending" for failed ones.
- **Resident report form:** above Submit, a notice says the text is read by
  Upkeep's automated classifier, and that the report, including photos, may be
  emailed to the estate's contractor.
