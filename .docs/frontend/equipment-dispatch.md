# Equipment dispatch (web)

The one "send" step on equipment warnings (spec
`.spec/features/equipment-dispatch.md`, API in `../api/equipment-dispatch.md`).

## Who can send

`canSend` = the viewer's estate access has `canCreateWorkOrders` (owner or
Manager — the same people the server lets generate the inspection list and
create work orders), and the estate and asset are active. A viewer who can see
the warning but not send reads "Ask <who> to send crew." / "Ask <who> to send
a contractor.", where <who> comes from `GET /estates/{estateId}/who-can-help`
(`SEND_CREW` / `SEND_CONTRACTOR`) through `AskSomeoneLine` (see
[wording.md](wording.md#who-can-help)).

## The app picks the route

`dispatchRoute(flagReasons)` in `apps/web/src/lib/equipment-dispatch.ts`:
`END_OF_LIFE` anywhere → `CONTRACTOR`; any other reason → `CREW`; none → null.
Service-due and repair-predicted notifications always use `CREW`; a
`CHECK_FAILED` notification always offers a contractor.

## Shared components (`apps/web/src/components/dispatch/`)

| Component | What it shows |
| --- | --- |
| `DispatchAction({ estateId, assetId, assetName, route, canSend })` | Non-senders: `AskSomeoneLine` ("Ask <who> to send crew." / "…send a contractor."). `CONTRACTOR`: "Send a contractor" link to `/estates/$estateId/work-orders/new?assetId=…&reason=END_OF_LIFE`, or "Contractor already sent · <reference>" linking to the open work order. `CREW`: "Send crew to inspect" button opening `SendCrewDialog`; or "Sent to <person> · due <date>" / "On the check list · due <date>" while a check is open; or a disabled "Inspected on <date> (Pass/Fail)" once this month's check is done. |
| `SendCrewDialog` | shadcn `Dialog` "Who should inspect <equipment>?", one shadcn `Select` labelled **Person** ("Name · Role"). "No crew in this estate yet. Invite crew in People & access." when nobody is Crew. Cancel / **Send** ("Sending…"). Toast "Sent to <person> to inspect <equipment>." (or "Already sent to <person>." on a 200). A 400 shows "<name> can no longer record inspections here. Choose someone else." and refetches the list. |
| `FailedCheckAction({ estateId, inspectionResultId })` | "Send a contractor" link to `/work-orders/new?sourceInspectionId=…`, or "Contractor already sent · <reference>" when the result's `workOrder` is set. |

## Hooks (`apps/web/src/lib/equipment-dispatch.ts`)

| Hook | Endpoint | Query key / invalidation |
| --- | --- | --- |
| `useInspectors(estateId, enabled)` | `GET /estates/{estateId}/inspectors` | `["estates", userId, "inspectors", estateId]`; loaded when the dialog opens |
| `useAssetCheck(estateId, assetId)` | reads `useInspectionList` | the inspection list key; picks the asset's open check, else this month's done one |
| `useSendCrew(estateId, assetId)` | `POST /estates/{estateId}/assets/{assetId}/inspection-requests` | invalidates the inspection list and `[userId, "notifications"]`; returns `{ check, created }` (`created` = 201); errors are `DispatchError` with `status` |
| `useOpenWorkOrder(estateId, assetId)` | `GET /estates/{estateId}/assets/{assetId}/open-work-order` | `["estates", userId, "open-work-order", estateId, assetId]`; 204 → `null` |

## Where the buttons appear

| Screen | File | Behaviour |
| --- | --- | --- |
| Asset attention banner | `routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-attention-alert.tsx` | Senders get `DispatchAction` (route from the asset's failure-risk `flagReasons`, default `CREW`) instead of "File an inspection". Crew (can inspect, can't send) keep "File an inspection". Others get `AskSomeoneLine`. Nothing for retired equipment or an inactive estate. |
| Breakdown forecast card | `…/asset-overview/asset-forecast-card.tsx` | `DispatchAction` under "Flagged for a check because…" when the asset is flagged. |
| Condition card | `…/asset-overview/asset-overview.tsx` | "Record condition check" is hidden from senders (`canRecord = active && !canSend`). |
| Due checks rows | `routes/_auth/estates/$estateId/inspections/-components/inspections-page/check-table.tsx`, `end-of-life-action.tsx` | Basis "Sent to <person> by <manager>" for `REQUESTED`. Open `PREDICTION` rows whose asset is flagged `END_OF_LIFE` (from `useEstateFailureRisk`) also get "Send a contractor", for viewers with `canCreateWorkOrders`. |
| Inbox | `routes/_auth/notifications/-components/notifications-page/notification-item.tsx`, `notification-dispatch.tsx` | `CHECK_REQUESTED`: title "Please inspect <equipment>", reason "Sent by <manager>", row links to the Record inspection page. `CHECK_FAILED`: title "Crew found a problem with <equipment>", the note as the reason, then `FailedCheckAction`. `SERVICE_DUE` / `REPAIR_PREDICTED`: `DispatchAction` with `CREW`. Resolved notifications show no send step. |
| Header bell | `components/shell/notification-bell.tsx` | Shown to Crew as well as Managers/owners. |
| Work order form | `routes/_auth/estates/$estateId/work-orders/new/index.tsx`, `-components/work-order-form/use-work-order-prefill.ts` | Search params `assetId` (UUID) + `reason=END_OF_LIFE` (ignored with another source) fill in Source "Maintenance recommendation", the equipment and its location, "Reached end of life (expected <date>)" and "Replace <equipment>. It has reached the end of its expected life." Category stays Equipment fault. Nothing is saved until the manager clicks Create. |
| Record inspection form | `routes/_auth/estates/$estateId/assets/$assetId/inspections/new/-components/inspection-form/` | With Fail chosen the notes label becomes "Notes: what's wrong?" and is required; saving a blank one shows "Say what's wrong so the manager knows what to fix." Pass keeps "Notes (optional)". |
