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
Common-area light), `ROUTING_STATES` (Classifying, Needs review, Work order
created, Dismissed), `PRIORITIES`, `workOrderStatusLabel` and
`dispatchStatusLabel` (Sending, Sent <time>, Failed to send).

`apps/web/src/lib/contractors.ts` holds `useContractors` (key
`[userId, "estate-contractors", estateId]`, enabled for `canCreateWorkOrders`),
`useSaveContractor` and `useRemoveContractor`.

`useEstateReport` (`lib/estate-reports.ts`) refetches every 5 s while
`routing.state` is `CLASSIFYING`. `EstateReport` is `EstateReportDetailResponse`.

## Screens

- **`/estates/$estateId/contractors`** (`routes/_auth/estates/$estateId/contractors/`):
  `PageHeader` with breadcrumbs, then one Card per equipment type
  (`-components/contractor-row.tsx`) with labelled Inputs ("Lift contractor
  name" and "email"), "Save lift contractor", and a "Remove lift contractor"
  Dialog. The `_auth` guard returns Not Found without `canCreateWorkOrders`, and
  navigation shows "Contractors" (HardHat icon) only with that capability.
- **Estate report list:** each card shows an outline Badge "Routing: <state>".
  A "Routing" Select (`-components/routing-state-filter.tsx`) keeps
  `routingState` in the URL alongside the block and level filters.
- **Estate report detail:** `-components/routing-card.tsx` shows the state,
  the reason, the model's assessment ("Inconclusive · Lift · 62% confidence"),
  and the work order (reference linked to its detail when `canViewWorkOrders`,
  plus status), contractor, email status and approval. With
  `canCreateWorkOrders`, a report awaiting review offers:
  - "Send to contractor" (`send-to-contractor-dialog.tsx`): Equipment type and
    Priority Selects, the recipient named before sending, and "Send work order".
    When the chosen type has no contractor, it says so and links "Set up
    contractors" to `/estates/$estateId/contractors`;
  - "Dismiss" (`dismiss-report-dialog.tsx`), confirmed with "Dismiss report";
  - "Retry sending" when the email failed.
- **Work-order detail:** the route (`$workOrderId/index.tsx`) passes a
  `sections` slot to `WorkOrderDetailPage`. For `EQUIPMENT_FAULT` orders from a
  resident report, the slot renders `-components/work-order-contractor-email.tsx`:
  a "Contractor email" Card with the contractor, equipment, email status and
  approval, or "No contractor has been emailed about this work order." With
  `canCreateWorkOrders` it offers "Email contractor" (a Dialog ending in
  "Assign and email", with the same "Set up contractors" link when the type has
  no contractor) for open orders, and "Retry sending" for failed ones.
- **Resident report form:** above Submit, a notice says the text and photos are
  analysed by an AI service (Anthropic) and may be emailed to the estate's
  contractor.
