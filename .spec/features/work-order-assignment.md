# Work order assignment

**Status:** draft
**Owner:** Ong Zheng Kai

This is the long-deferred Jira **ID-37** scope ("assign a work order"). Earlier
work stopped short of it: `create-work-order.md` left orders unassigned,
`equipment-dispatch.md` and decision 0048 made "dispatch is the assignment" for
contractor emails only, and decision 0040 made Crew read-only. At build time a
new decision record partly supersedes **0040** (assigned Crew may progress
their own order) and **0048** (assignment is a first-class field; dispatch
becomes only the email outbox record).

## Problem

A work order is general work that anyone, inside or outside the estate, may
carry out. Today nobody can be named as responsible for it. The only "assignee"
is a contractor email sent for water-leak resident reports or "Send to
contractor", and it is tied to an equipment type. A Manager cannot hand an
order to a Crew member, cannot send a lighting or cleaning job to a contractor,
cannot change who has it, and Crew cannot mark their own work started or done,
so the Manager has to do it for them.

## Behaviour

Who and what

- An estate Owner or Manager may assign, reassign and unassign any work order
  whose status is not `CLOSED`, regardless of source, category or priority.
- Crew, Residents and non-members get 403 on assign/unassign, including a Crew
  member who is the current assignee.
- An assignee is exactly one of: an active estate member whose role is
  `MANAGER` or `CREW` (Owners count as Manager), or a contractor in the
  estate's contractor directory. Anything else is 422.
- Assigning a `CLOSED` order is 409.
- Crew cannot pick up an unassigned order themselves; only an Owner or
  Manager can assign anyone, including the caller.

Status effects

- First assignment of an `OPEN` order moves it to `ASSIGNED`.
- Reassigning an `ASSIGNED` or `IN_PROGRESS` order keeps its status.
- Unassigning an `ASSIGNED` order moves it to `OPEN`; unassigning an
  `IN_PROGRESS` order keeps `IN_PROGRESS` with no assignee.
- Assigning the current assignee again is a no-op 200: no status event, no
  email, no notification, version unchanged.
- Every assign/reassign/unassign that changes the assignee bumps `version` and
  writes a `WorkOrderStatusEvent` row (see Data). Stale `version` is 409, as
  for status changes today.

One operation for every path

- Auto-routing of water-leak reports (`ReportRoutingService`) and the Manager
  "Send to contractor" action call the same assign operation with the
  contractor as target. Their observable results (order `ASSIGNED`, one
  dispatch `PENDING`) are unchanged.
- The old EQUIPMENT_FAULT + RESIDENT_REPORT + OPEN "Email contractor" control
  on the detail page is replaced by the general "Assign" control.

Contractor assignee

- Assigning a contractor creates a new `WorkOrderDispatch` row (`PENDING`)
  carrying the copied name and email; `DispatchDeliveryJob` sends it through
  the `EmailSender` port (Resend spec) with today's retry, lease and `FAILED`
  rules.
- Reassigning to a different contractor creates another dispatch row and emails
  the new contractor; earlier rows are left as history. No email is sent to the
  previous contractor (out of scope).
- A `FAILED` email leaves the assignment in place; the Manager may retry from
  the detail page as today (retry acts on the latest dispatch only).

Member assignee

- Assigning a member creates a `WORK_ORDER_ASSIGNED` notification whose
  `recipientUserId` is the assignee, following the `CHECK_REQUESTED` pattern in
  `InspectionListRepository`. Only the recipient sees it. Reassigning away
  resolves the previous assignee's notification. No email to members.

Crew assignee

- A Crew member who is the current assignee may move that order
  `ASSIGNED → IN_PROGRESS` (or `OPEN → IN_PROGRESS` cannot occur, since
  assigned orders are not `OPEN`) and complete it `IN_PROGRESS → CLOSED`,
  including the completion form. Same `version` rules as Managers.
- On every other order, and for every other action (edit, assign, links),
  Crew stays read-only (decision 0040).
- Once unassigned or reassigned, the former Crew assignee loses that right
  immediately.

Reading

- Work-order summary and detail carry `assignee` (or `null`).
- The list accepts `assignedTo=me` and returns only orders whose member
  assignee is the caller; Crew's list defaults to it, with a toggle to see all.
- Detail history shows assignment changes in plain words ("Assigned to Priya
  Tan", "Unassigned").

Contractor directory

- Owner/Manager may list, add, edit (name, email) and remove contractors for an
  estate. Crew may list (read-only).
- Email is unique per estate (existing constraint); duplicate is 409.
- Removing a contractor who is the assignee of any non-`CLOSED` order is 409
  with the order count. Removing one used as an equipment-type default clears
  that default.
- Each equipment type may still have one default contractor, used by
  auto-routing; it is set from the directory screen.

## Data

All in `packages/db/prisma/schema/schema.prisma`; expand-then-contract per
decision 0029 (prd code keeps running against the expanded schema).

`WorkOrder` gains, all nullable:

| Column | Type | Notes |
| --- | --- | --- |
| `assigneeUserId` | VarChar(255) | WorkOS user id of a member |
| `assigneeName` | VarChar(255) | snapshot of member or contractor name |
| `assigneeProviderId` | Uuid | composite FK `(assigneeProviderId, estateId)` to `ServiceProvider(id, estateId)`, `onDelete: Restrict` (needs `@@unique([id, estateId])` on `ServiceProvider` if absent) |
| `assignedAt` | Timestamptz(6) | |
| `assignedByUserId` | VarChar(255) | |

Plus `@@index([estateId, assigneeUserId])`. A database **check constraint**
(raw SQL in the migration, as `Notification` already does) enforces: not both
of `assigneeUserId` / `assigneeProviderId`; `assigneeName` and `assignedAt`
non-null iff one is set. Chosen over a service-only rule because routing and
the assign endpoint both write these columns. Not constrained in the database:
"status `ASSIGNED` implies an assignee", because existing `ASSIGNED` rows are
backfilled first (below).

`WorkOrderDispatch`: drop `@unique` on `workOrderId`, add
`@@index([estateId, workOrderId, createdAt])`; relation becomes
`dispatches WorkOrderDispatch[]`. `equipmentType` becomes nullable (a
contractor assigned to a non-equipment job has none). It stays purely the
email outbox. `ReportRouting` is untouched.

`WorkOrderStatusEvent`: reused for assignment changes rather than a new table.
Adds nullable `assigneeName VarChar(255)` and `kind VarChar(20)` default
`STATUS` (`STATUS` | `ASSIGNED` | `UNASSIGNED`). An assignment that also moves
status writes one row with both. `@@unique([workOrderId, version])` already
fits because every change bumps version.

`Notification`: add `workOrderId Uuid?` (composite FK to `WorkOrder`), make
`assetId` nullable (work orders may have no asset), add
`WORK_ORDER_ASSIGNED` to the type check, and extend the recipient check so this
type requires `recipientUserId`.

`ServiceProvider`: no new columns. No `deactivatedAt` (YAGNI; delete with the
409 guard is enough). `EquipmentProviderRoute` unchanged.

Migration order:

1. **Expand (this feature's PR):** add the columns, nullable; relax the dispatch
   unique to an index; backfill existing `ASSIGNED`/`IN_PROGRESS` orders that
   have a dispatch with `assigneeProviderId`, `assigneeName = contractorName`,
   `assignedAt = dispatch.createdAt`. Old code still writes at most one
   dispatch, which the new schema accepts.
2. **Contract:** none needed; nothing is dropped.

## API

Updated in `packages/api/openapi.json` and `.docs/api/work-orders.md`,
`.docs/api/contractors.md`.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| PUT | `/estates/{estateId}/work-orders/{id}/assignee` | `AssignWorkOrderRequest { userId?: string, providerId?: uuid, version: int }` (exactly one id) | 200 `WorkOrderDetailResponse`; 403, 404, 409 stale/closed, 422 bad target | Owner/Manager |
| DELETE | `/estates/{estateId}/work-orders/{id}/assignee?version=` | - | 200 `WorkOrderDetailResponse`; 403, 404, 409 | Owner/Manager |
| GET | `/estates/{estateId}/work-orders/assignees` | - | 200 `AssigneeCandidatesResponse { members: [{userId, name, role}], contractors: [{id, name, email}] }` | Owner/Manager |
| GET | `/estates/{estateId}/work-orders?assignedTo=me` | new optional query param | existing page | existing |
| POST | `/estates/{estateId}/work-orders/{id}/status` (existing) | unchanged | unchanged | now also the Crew assignee for `IN_PROGRESS` |
| POST | existing completion endpoint | unchanged | unchanged | now also the Crew assignee |
| GET | `/estates/{estateId}/contractors` | - | 200 `ContractorDirectoryResponse { contractors: [{id, name, email, defaultFor: EquipmentType[]}] }` | Owner/Manager/Crew |
| POST | `/estates/{estateId}/contractors` | `{ name, email }` | 201 `Contractor`; 409 duplicate email | Owner/Manager |
| PUT | `/estates/{estateId}/contractors/{contractorId}` | `{ name, email }` | 200 `Contractor`; 404, 409 | Owner/Manager |
| DELETE | `/estates/{estateId}/contractors/{contractorId}` | - | 204; 409 while assigned to open orders | Owner/Manager |
| PUT | `/estates/{estateId}/contractors/defaults/{equipmentType}` | `{ contractorId }` | 200 | Owner/Manager |
| DELETE | `/estates/{estateId}/contractors/defaults/{equipmentType}` | - | 204 | Owner/Manager |

`assignees` is a dedicated endpoint, not a reuse of `GET /estates/{id}/members`:
that list is Owner-oriented, includes Residents and invitations, and lacks
contractors. The existing `PUT/DELETE /contractors/{equipmentType}` paths move
under `/contractors/defaults/` because `/contractors/{contractorId}` now owns
that segment; the web is the only caller, updated in the same PR.

Response additions on `WorkOrderSummary` and `WorkOrderDetailResponse`:

```
assignee: { kind: "MEMBER" | "CONTRACTOR", id: string, name: string,
            email?: string, assignedAt: string } | null
canProgress: boolean   // caller may start/complete this order
```

Detail's `dispatch` becomes the latest dispatch (same shape) so the existing
email-status display and retry keep working. Status-history items gain
`kind` and `assigneeName`.

Example: `PUT .../work-orders/9f.../assignee` with
`{ "providerId": "c1...", "version": 3 }` returns the order with
`status: "ASSIGNED"`, `version: 4`, `assignee.kind: "CONTRACTOR"`,
`dispatch.status: "PENDING"`.

## Frontend

Plain-English copy throughout; no ids, enums or status codes on screen.

- `_auth/estates/$estateId/work-orders/$workOrderId/` detail: an "Assigned to"
  row with a "Assign" / "Change" / "Remove" control. The picker is a
  searchable dropdown (shadcn Combobox pattern: `Command` inside `Popover`),
  grouped "Your team" and "Contractors", placeholder "Search by name or
  email". Type-ahead filters client-side by name and email over the
  `assignees` response; no `?q=` on the endpoint (one estate's team and
  contractors is small). `popover.tsx` exists in `packages/ui`; `command.tsx`
  does not and must be added with
  `pnpm dlx shadcn@latest add command -c packages/ui`. Copy: "Who should
  do this job?", "We'll email Ace Plumbing the job details.", "Priya will see
  this in her notifications." Replaces `work-order-contractor-email.tsx`; the
  email status line ("Email sent", "Email didn't go through - Try again")
  stays. Crew assignee sees "Start job" and "Mark as done".
- `_auth/estates/$estateId/work-orders/` list: "Assigned to" column/line;
  Crew gets a "My jobs / All jobs" toggle (`assignedTo=me`).
- `_auth/estates/$estateId/contractors/` becomes a directory: a table of
  contractors (name, email, "Default for: Lifts, Pumps") with "Add contractor",
  "Edit", "Remove"; a secondary "Default contractors" card with one `Select`
  per equipment type ("Send new water-leak reports for pumps to..."). Removal
  blocked message: "Ace Plumbing still has 2 open jobs. Reassign them first."
- Notifications list renders `WORK_ORDER_ASSIGNED` as "You've been given a job:
  <reference>" linking to the order.
- Hooks in `apps/web/src/lib/work-orders.ts` and `lib/contractors.ts`; assign
  invalidates the order detail, list and notification keys.
  `.docs/frontend/work-orders.md` and the contractors doc updated.

## Edge cases

- Member assignee leaves the estate or becomes a Resident: the assignment
  stays visible with the snapshot name, marked "(no longer in this estate)";
  their progress rights end because they fail the membership check. A Manager
  reassigns. Membership removal is not blocked.
- Contractor removed while assigned to open orders: 409 (above). Assigned only
  to `CLOSED` orders: the FK is `Restrict`, so delete nulls
  `assigneeProviderId` on closed orders first, keeping `assigneeName`.
- Two Managers assign concurrently: second gets 409 on stale `version`.
- Email delivery fails: assignment stands, dispatch `FAILED`, Manager retries.
- Reassign from contractor A to B while A's email is still `PENDING`: A's row
  is marked `FAILED` with reason "superseded" before sending, so A never
  receives a job they no longer have. (Leased in-flight sends may still go.)
- Same assignee again: no-op 200.
- Crew assignee calls assign/unassign: 403. Crew non-assignee calls status or
  complete: 403.
- Auto-routing finds an order already assigned (manual assignment raced it):
  routing skips, as it skips today when a dispatch exists.
- Order with `IN_PROGRESS` and no assignee: Managers can still complete it.

## Out of scope

- Contractor accounts, portal or reply-by-email handling.
- Due dates, SLAs, workload or calendar views.
- Multiple assignees or teams.
- Custom-role permission codes for assignment (`EstatePermissionCode` stays
  as is).
- Emailing members, or emailing the previous contractor on reassignment.
- Deactivating contractors instead of deleting.

## Open questions

1. Should unassigning an `IN_PROGRESS` order instead return it to `OPEN`?
   Assumed it stays `IN_PROGRESS` (work may already be under way).
2. Do Owners appear in the member candidate list? Assumed yes, labelled
   "Manager".
