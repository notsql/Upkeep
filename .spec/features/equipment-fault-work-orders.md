# Equipment fault work orders

**Status:** revision agreed (2026-10-26) and implemented on
`feat/id-70-report-routing` (2026-10-27); server and web tests pass. Still
needed: the migration applied to Neon `dev`, a run of the model evaluation,
and the Gmail and Anthropic secrets. It builds on the existing `WorkOrder`
(ID-36, ID-38, ID-40) and supplies the minimal provider and assignment model
that ID-37 extends.
**Owner:** unassigned
**Jira:** ID-70, under ID-2 (Work Orders and Contractor Routing)

## Why this was revised

The first version was built on `feat/id-44-device-status`, 25 commits behind
`main`. In that time `main` gained its own `WorkOrder` model and screens:
creation from a resident report (ID-36), progress (ID-38) and completion
(ID-40). The first version created a second, unrelated `WorkOrder` table.

This revision makes ID-70 create `main`'s work orders, and keeps only what
ID-70 adds: classification, routing, Manager review and contractor email. The
first version's migration was never applied to a shared database. It is
deleted and authored again on top of `main`'s migrations.

The decision records are numbered 0041 and 0042, because `main` already
uses 0032 to 0040.

## Problem

A resident's fault report stops at `SUBMITTED` until a Manager or Crew member
reads it and turns it into work by hand. Reports about broken equipment wait in
that queue even when the fault and the right contractor are obvious.

This is the first slice that closes the loop automatically, and it is limited
to equipment faults (pump, lift, gate, common-area light). The cleanliness and
safety stories follow and reuse what is built here.

### Agreed decisions (unchanged from the first version)

- **Where the model call runs:** in Spring, in process, as decision 0028 does
  for anomaly inference. There is no Hono/Workers service.
- **The contractor is external:** a name and email address. It is recorded as
  a `ServiceProvider`, the provider record ID-37 extends, and routed per
  equipment type. A contractor has no account, login or screens. The human
  confirms this shape with the ID-37 owner.
- **Delivery:** email over SMTP through the Gmail account `csd.upkeep`, with
  the resident's photos attached. From and Reply-To are unset for now.
- **Manager approval** is needed only when the system escalates.
- **Confidence threshold:** a fixed constant of `0.8`.
- **"Water dripping near lift lobby"** is inconclusive. The model escalates
  it, and a Manager can then send it to the lift contractor.
- **Residents** are told on the report form that an AI service reads their
  report and that it may be emailed to a contractor.

## Behaviour

### Authority

ID-70 uses `main`'s work-order capabilities rather than raw role names, so
custom estate roles keep working:

- **Contractor settings and routing decisions** (send, dismiss, retry email)
  need `canCreateWorkOrders` for the estate: active owner, Manager, or a
  custom role granted it.
- **Reading routing state** on a report needs `canViewFaultReports`. Reading
  the email status on a work order needs `canViewWorkOrders`.
- A same-estate Resident membership overrides ownership, as everywhere else.

### Equipment contractors (service providers)

The screen is unchanged: one name and email per equipment type. Underneath:

- A contractor is a `ServiceProvider` of the estate, identified by its email
  address. Saving the same email for two types reuses the same provider, so one
  firm that services pumps and gates is one provider.
- An `EquipmentProviderRoute` points each of `PUMP`, `LIFT`, `GATE` and `LIGHT`
  at, at most, one provider.
- Saving a name for an existing provider's email updates that provider's name.
- Removing a contractor from a type removes the route only. The provider stays,
  because work orders may be assigned to it.
- A contractor has a name (1–200 characters after trimming) and a valid email
  address (at most 254 characters).
- Saving a contractor for a type that already has one points the route at the
  new provider.
- Changing routes never changes work orders that already exist.

### Classification

Unchanged. Submission queues the report in `ReportRouting` (`CLASSIFYING`).
Reports from before routing are never classified. A scheduled job sends the
title, description, location label and photos (never the resident's identity)
to the model and stores each valid answer. Failures retry up to 3 times. With
no API key, or for an inactive estate, the report goes straight to review.

### Automatic routing creates a `main` work order

When `outcome = EQUIPMENT_FAULT`, the equipment type is set,
`confidence >= 0.80` and the estate has a contractor for the type, the job
creates a work order through `main`'s creation rules, in one transaction:

| `WorkOrder` field | Value |
| --- | --- |
| `category` | `EQUIPMENT_FAULT` |
| `priority` | `MEDIUM` (open question 2) |
| `source` | `RESIDENT_REPORT`, with `sourceReportId` set to the report |
| `locationId` | The report's location, which must still be active |
| `description` | The resident's description, verbatim |
| `assetId` | None |
| `status` | Created `OPEN`, then `ASSIGNED` in the same transaction (see Assignment) |
| `reference` | `main`'s usual `<estate code>-W0001`, numbered under the estate lock |
| `createdByUserId` | A reserved system identity (open question 3) |

The same transaction assigns the order to the type's provider (see
Assignment), creates a `WorkOrderDispatch` (`PENDING`) holding a copy of the
provider's name and address, and moves the routing to `WORK_ORDER`.

### Assignment (minimal ID-37)

ID-37 is not built yet, so ID-70 supplies the assignment it needs:

- Creating a dispatch assigns the work order to its provider. The work order's
  `status` moves from `OPEN` to `ASSIGNED` through `main`'s status history: a
  `WorkOrderStatusEvent` is recorded and `version` increases, in the same
  transaction.
- The person who changed the status is the approving Manager, or
  `system:report-routing` for automatic routing.
- A work order that is no longer `OPEN` (in progress, say) cannot be
  dispatched (409).
- `main`'s existing `ASSIGNED` → `IN_PROGRESS` transition then applies
  unchanged.
- If the email later fails, the order stays `ASSIGNED`. The failure shows on
  the dispatch, and a Manager can retry it.
- Reassigning a provider, unassigning, and filtering by provider remain ID-37's.

If `main`'s rules reject the order, for example because the report's location
or the estate is now inactive, nothing is created. The report goes to review
with the reason ("The report's location is inactive"). Any other outcome goes
to review exactly as before: inconclusive, not equipment, below the threshold,
or no contractor for the type.

### Manager review

- **Send to contractor** on a `NEEDS_REVIEW` report creates the same work
  order and dispatch. The Manager chooses the equipment type and the priority
  (defaulting to Medium); `createdByUserId` and the dispatch's
  `approvedByUserId` are the Manager.
- **Dismiss** is unchanged: no work order and no email.
- **`main`'s own "Create work order" from a report still works, but sends no
  email.** If the report is awaiting review when an order is created that way,
  its routing moves to `WORK_ORDER`, so it leaves the review queue (proposed
  change to `main`'s creation path). The order has no dispatch, so no
  contractor is emailed; a Manager can email it later (next point).
- **Email a contractor about an existing work order:** a Manager can send a
  dispatch for any `EQUIPMENT_FAULT` work order with a resident-report source
  that has no dispatch yet, choosing the equipment type. (This is included so
  the previous point has a way to reach the contractor. It can be dropped if
  you'd rather keep ID-70 narrower.)

### Email delivery

Unchanged, except that the email carries the work order's own reference (for
example `MG-W0042`). The dispatch moves `PENDING` → `SENT`, or `FAILED` after
5 attempts, and a Manager can retry a failed one. Sending never changes the
work order's `status` beyond the `ASSIGNED` set at dispatch.

### Acceptance criterion, as reworded (unchanged)

The resident submits "water dripping near lift lobby" with a photo. The report
reaches `NEEDS_REVIEW` with the model's "needs further checks" reason. A
Manager sends it as `LIFT`. A work order is created, and the lift contractor
receives an email carrying the resident's own words and photo.

### Residents

Unchanged: no new resident data, `status` stays `SUBMITTED`, and the notice on
the report form stays.

## Data

All schema changes start in `schema.prisma`, with a new migration timestamped
after `main`'s latest. Applied migrations are never edited.

| Model | Change |
| --- | --- |
| `WorkOrder` (`main`) | No column changes. Gains a back-relation to `WorkOrderDispatch`. |
| `ServiceProvider` (new; ID-37 extends it) | UUID `id`, `estateId`, `name` (≤ 200), `email` (≤ 254), timestamps. Unique `(estateId, email)` and `(id, estateId)`. |
| `EquipmentProviderRoute` (new; replaces `EquipmentContractor`) | `estateId` and `equipmentType` (primary key), `providerId` with a composite key to `ServiceProvider(id, estateId)`, timestamps. |
| `WorkOrderDispatch` (new; replaces the first version's `WorkOrder`) | UUID `id`, `workOrderId` (unique) and `estateId`, with a composite key to `WorkOrder(id, estateId)`; `providerId`, with a composite key to `ServiceProvider` (this is the assignment); `equipmentType`; `contractorName` and `contractorEmail` (copies); `approvedByUserId?` (empty when automatic); `status` (`PENDING`, `SENT`, `FAILED`); `attempts`, `nextAttemptAt`, `leaseUntil?`, `sentAt?`, `lastErrorCode?`, timestamps. Index on `status, nextAttemptAt`. |
| `ReportRouting`, `ReportClassification` | As in the first version. `ReportRouting` gains `workOrderId?`, with a composite key to `WorkOrder`, so the routing card can link to the order. |

## API

Errors use `EstateError`, and responses are `Cache-Control: private, no-store`.

| Method | Path | Request | Response | Authority |
| --- | --- | --- | --- | --- |
| GET, PUT, DELETE | `/estates/{estateId}/contractors[/{equipmentType}]` | As before | As before | `canCreateWorkOrders` |
| POST | `/estates/{estateId}/reports/{reportId}/work-order` | `{ equipmentType, priority }` | 201 `ReportRoutingResponse` | `canCreateWorkOrders` and responder membership (`main`'s rule for report sources) |
| POST | `/estates/{estateId}/reports/{reportId}/dismiss` | — | 200 `ReportRoutingResponse` | `canCreateWorkOrders` |
| POST | `/estates/{estateId}/work-orders/{workOrderId}/dispatch` | `{ equipmentType }` | 201 `WorkOrderDispatchResponse` | `canCreateWorkOrders` |
| POST | `/estates/{estateId}/work-orders/{workOrderId}/dispatch/retry` | — | 200 `WorkOrderDispatchResponse` | `canCreateWorkOrders` |

The response shapes change as follows:

- `WorkOrderDispatchResponse`: `equipmentType`, `contractorName`,
  `contractorEmail`, `approval` (`AUTOMATIC` or `MANAGER`), `status`,
  `sentAt | null`, `createdAt`.
- `ReportRoutingResponse`: `state`, `reason`, `classification`, and
  `workOrder: { id, reference, status, dispatch } | null`.
- `main`'s `WorkOrderResponse` gains `dispatch: WorkOrderDispatchResponse | null`.
- The estate report DTOs carry `routing`, as in the first version, merged with
  whatever `main` has changed in them.

Status codes are as before. 409 covers: not awaiting review; no contractor for
the type; a dispatch already exists; a work order that is not
`EQUIPMENT_FAULT` or not from a resident report; and `main`'s creation
conflicts (location changed or inactive).

## Server design

- The model client, the email, the jobs and the outbox are as in the first
  version.
- Work-order creation calls `main`'s `WorkOrderRepository` creation inside the
  routing transaction. It does not go through the HTTP-facing service, which
  needs a signed-in user. `main`'s validation (active location, estate lock,
  report location check) is extracted so both paths share it.
- **Lock order follows `main`'s: estate first.** The classification job's
  final transaction locks the estate, then the routing row (checking its
  lease), then reads the contractors. This avoids a deadlock with Manager
  actions and `main`'s creation.
- New code lives in `com.proj.server.routing`. Hooks into `main`'s code are
  limited to the shared creation function and `dispatch` on
  `WorkOrderResponse`.

## Frontend

`main` owns `lib/work-orders.ts` and the work-order docs, so ID-70 uses its own
names:

- **Hooks:** `lib/report-routing.ts` (send, dismiss) and `lib/contractors.ts`.
- **Report routing card:** shows the work order's reference, linked to
  `/estates/$estateId/work-orders/$workOrderId`, its status and the email
  status. The send dialog adds a Priority select.
- **`main`'s work-order detail screen:** gains a "Contractor email" section
  with the dispatch status. Users with `canCreateWorkOrders` also get "Email
  contractor" (when there is no dispatch) and "Retry sending".
- **Contractors page and navigation:** as in the first version, gated by
  `canCreateWorkOrders`.
- **Docs:** `.docs/api/report-routing.md` and
  `.docs/frontend/report-routing.md`, plus a dispatch section in `main`'s
  work-order docs.

## Edge cases

The first version's edge cases still apply. In addition:

- **The report's location becomes inactive before automatic creation:** the
  report goes to review and nothing is created.
- **The report is relocated while awaiting review:** sending uses its current
  location; `main`'s observed-location check guards against a change made at
  the same moment.
- **Several work orders from one report:** `main` allows this, and routing
  tracks only the one it created. A report that is already `WORK_ORDER` cannot
  be sent again (409).
- **The estate's code changes:** references already given out never change,
  because `main` numbers them under the estate lock.

## Out of scope

Everything in the first version's list, plus:

- Reassigning or unassigning a provider, provider filtering on the work-order
  list, and provider management beyond the per-type screen (ID-37).
- Changing the status or completion of a work order because of an email (ID-38
  and ID-40).

## Implementation phases

- [x] Agree this revision and the open questions.
- [x] Start again on `feat/id-70-report-routing` from `origin/main`
  (`b312560`). The first version stays on `feat/id-70-equipment-work-orders`
  (commit `2a3885a`) for reference; its migration was never applied anywhere
  shared and is not carried over.
- [x] Prisma: `ServiceProvider`, `EquipmentProviderRoute`, `ReportRouting`,
  `ReportClassification` and `WorkOrderDispatch` on top of `main`, in migration
  `20261026155915_report_routing_and_dispatch`, with jOOQ regenerated against a
  disposable Postgres. **Not yet on Neon `dev` (rule 16).**
- [x] Red-green: shared creation, automatic routing into `WorkOrder`, the
  dispatch outbox, Manager send, dismiss, dispatch and retry, and the
  capability checks (`ReportRoutingIntegrationTests`, 37 tests).
- [x] Regenerate the API, then the web changes on the report card, the
  work-order detail and the contractors page. The parts carried over from the
  first version had been built test-first. The new parts (the priority select,
  the work-order link and the contractor-email section) were written before
  their tests; each new test was then shown to fail against a deliberately
  broken version.
- [x] Decision records 0041 (classification in Spring) and 0042 (contractor
  email dispatch on work orders). `.docs` updated; full checks run.
- [ ] Apply the migration to Neon `dev`, add the secrets, run the model
  evaluation by hand and record its result here.

## Resolved questions

As in the first version: Gmail SMTP, no shrinking of photos, From and Reply-To
unset, the resident notice, the reworded criterion, Admin = Manager, and Crew
can see the contractor on a work order.

## Built differently from the plan

- **Dispatch status has its own endpoint.** It is served by
  `GET /estates/{estateId}/work-orders/{workOrderId}/dispatch` as
  `{ dispatch | null }`. It is not a field on ID-36's `WorkOrderResponse`, which
  is used widely and is left unchanged.
- **The work-order detail section is a route slot.** The route passes a
  `sections` slot to `WorkOrderDetailPage`, rather than the page importing
  ID-70 code, so ID-36's page tests are untouched.
- **The routing state `WORK_ORDER` is labelled "Work order created".**
- **Who can manage contractors and decide routing** is ID-36's creation check:
  active owner or Manager. Custom roles have no work-order creation permission
  in `main`.

## Answers to the revision's questions (2026-10-26)

1. **ID-37:** agreed. ID-70's contractor record becomes ID-37's provider
   (`ServiceProvider`, plus per-type routes). The human confirms with the
   ID-37 owner.
2. **Priority of automatic orders:** fixed Medium; Managers choose when sending.
3. **Creator of automatic orders:** `system:report-routing`, shown as "Upkeep
   (automatic routing)".
4. **`ASSIGNED`:** ID-37 has not built assignment, so ID-70 moves the order to
   `ASSIGNED` when it is dispatched (see Assignment).
5. **Gmail account:** `csd.upkeep`.
