# Work-order progress and completion (ID-38 / ID-40)

**Status:** independent scope implemented and verified 2026-10-24; live QA follow-ups implemented and verified; shared integrations pending
**Owner:** Chan Ding Jie
**Baseline:** originally ID-36 at `18f3b3e`; PR #33 has since merged.
PR #36's integration review brings in main at `78cabbe`, retaining its creation
form split and custom roles alongside progress/completion. See the review
follow-up plan for integration verification.

Sources: [ID-38](https://notjira.atlassian.net/browse/ID-38),
[ID-40](https://notjira.atlassian.net/browse/ID-40),
[ID-37](https://notjira.atlassian.net/browse/ID-37),
[ID-49](https://notjira.atlassian.net/browse/ID-49), and
[ID-50](https://notjira.atlassian.net/browse/ID-50).
The user agreed the five recommended product defaults on 2026-10-24, including
closure after an asset moves/retires and keeping closed work orders immutable.
Provider and downstream consumer interfaces remain integration work to agree;
their pending state does not revoke approval of the independent scope below.

Manual review findings and agreed changes are collected in
[work-order-review-follow-ups.md](work-order-review-follow-ups.md). That plan
includes the agreed change from immutable outcomes to audited corrections
and newest-first to oldest-first priority ties. Decision 0035 supersedes that
part of the original defaults; follow-up implementation/verification is tracked there.

## Problem

Work orders can be created and read but remain Open. Managers cannot record
progress, see who changed a status, or close a job with its findings and costs.
Existing asset maintenance events contain dates/notes and feed failure forecasts;
they have no work-order relation, labour/parts costs or downtime fields.

## Scope and dependencies

Build status tracking and completion together so there is one closure operation.
ID-37 owns providers, category routing and reassignment. Agree its assignment
identifier and transaction contract before integrating Assigned/provider filters.
Do not invent a parallel provider catalogue, free-text provider or dummy assignment.

ID-49/50 consume the completion records produced here. Their full implementation
need not precede ID-40: this change includes the minimum read-only integration
into the existing asset Maintenance screen. Agree the shared record/identity first.
ID-26 document association remains separate; closure requires no invoice or upload.

The independent first phase implements progress, non-provider filters, outcomes
and asset-history display. ID-38 is not fully Done until real assignment handling
and assigned-provider filtering work with ID-37. A hidden unfinished control does
not satisfy that acceptance criterion.

## Behaviour

### Access and audit

1. Current estate owners/Managers can update and close orders in active estates.
   Crew retain read-only work-order access. Same-estate Resident membership takes
   precedence over conflicting ownership. Other estates' roles grant no access.
2. Authorization and active-estate state are rechecked inside each write transaction,
   after the estate lock. Reads retain existing inactive-estate/history access.
   Foreign/missing records return 404; known denied memberships return 403.
3. Each successful status change records previous/new status, authenticated actor,
   server time and resulting order version. History is append-only. Missing display
   names do not block writes; resolve names outside database locks. Actor IDs
   remain stored without being the UI label.
4. Existing orders retain their IDs, references, source links and creation details.
   Their existing creator/time support a truthful Created entry; do not fabricate
   migration-time status-change events. New orders record their initial Open event.

### ID-38: progress and filters

5. Supported states are `OPEN`, `ASSIGNED`, `IN_PROGRESS`, `CLOSED`. Agreed paths:

   | From | To | Operation |
   | --- | --- | --- |
   | OPEN | ASSIGNED | Real provider assignment through ID-37 |
   | ASSIGNED | IN_PROGRESS | Manager starts work |
   | OPEN | IN_PROGRESS | Manager explicitly starts unassigned work; agreed exception |
   | IN_PROGRESS | CLOSED | Submit completion details through ID-40 |

   No generic status request may set Assigned without assignment validation or
   set Closed without a completion. Reopening, cancellation and backwards status
   changes are outside this scope. Reassignment rules remain with ID-37.
6. Mutations include `expectedVersion`. A stale version returns 409 without a
   write. An unchanged status with the current version is a no-op without another
   event. Unsupported transitions return 409; malformed/unsupported targets 400.
7. List filters combine status, priority, category, partial reference and, after
   ID-37 integration, assigned provider. Omitted status includes Closed orders.
   Apply/clear reset the cursor, preserve sorting and survive refresh/back.
   Filters apply on the server before pagination; sorting retains ID-36 behavior except priority
   ties now show oldest first under the agreed follow-up. A foreign provider must never expose another estate.
8. Detail displays status history in a stable chronological order. Closed orders
   remain in list/detail/history. Status cannot reopen; audited outcome corrections
   use their dedicated operation under decision 0035.

### ID-40: outcomes and closure

9. Close requires findings and work performed, each trimmed/nonblank and at most
   2,500 characters. Optional parts-used notes are at most 2,500 characters.
   Labour cost, parts cost and downtime may be unknown; explicit zero is preserved.
10. Money policy: SGD, nonnegative fixed decimals with at most two decimal
    places; reject excessive precision rather than silently rounding. Use decimal
    database fields and Java BigDecimal. DTO amounts are decimal strings. Reject
    negative amounts, invalid strings and values outside the declared storage bound.
    Downtime is nullable nonnegative whole minutes. Return total cost only when
    both cost components are known; an unknown component must not become zero.
11. One transaction creates the completion, appends the Closed audit event and
    changes status/version. If any part fails, none is committed. The completion
    records authenticated closer and server closure time; no backdating in this scope.
12. There is at most one completion per work order. A repeat close with the same
    normalized outcome returns the existing result, including after a lost response,
    despite its old expectedVersion. A different outcome on an already closed order
    returns 409. Recheck authorization before returning any replay. Concurrent
    submissions cannot duplicate outcomes, audit entries or asset-history entries.
13. Completion is stored for both asset-linked and asset-free orders. Linked
    completion details/costs appear once in that asset's Maintenance history, labelled
    Work order with its reference and a detail link where independently permitted.
    Asset-free outcomes remain readable on their work order.
14. The completion is the canonical cost/outcome record. The asset history reads it;
    it does not copy the same costs into a second ledger. ID-49/50 must retain this
    identity when building their later history/cost views.
15. Existing owner-only asset-register/history permissions remain unchanged. A
    non-owner Manager closes an order through work-order authorization and reads
    its outcomes there without gaining asset-register access. Crew can read order
    outcomes/history but cannot mutate them or access owner-only asset history.
16. Lifecycle policy: closing existing work is allowed if its linked asset
    was moved, retired or deactivated, provided the estate is active. Retain the
    order's saved location and asset identity. Do not reapply active-asset creation
    rules to historical work. Inactive estates remain read-only.
17. Closure does not automatically change asset condition, resident-report status,
    or failure forecasts. A cleanliness, inspection or safety job is not implicitly
    a breakdown repair. Existing manual maintenance events keep their current rules.

## Data

Prisma owns every schema change in `packages/db/prisma/schema/schema.prisma`.

| Model | Proposed change |
| --- | --- |
| WorkOrder | Add nonnegative `version Int @default(0)` and the composite unique relation target `(id, estateId)`; keep status as the existing bounded string with Java validation. |
| WorkOrderStatusEvent | New UUID record: estate/order IDs, nullable fromStatus, toStatus, changedByUserId, optional name snapshot, changedAt, resulting version. Unique `(workOrderId, version)`; composite same-estate FK; indexed per order. |
| WorkOrderCompletion | New UUID record: unique workOrderId, estateId, findings, workPerformed, optional partsUsed, nullable labourCost/partsCost `Decimal(14,2)`, currency `SGD`, nullable downtimeMinutes, completedByUserId/name and completedAt. Composite same-estate FK. |

Find an asset's completions through the order's existing `(assetId, estateId)`
relation. Do not duplicate a mutable asset association in the completion table.
Keep completion/status events append-only and restrict parent deletion.
No provider or invoice tables are added by the independent phase.

Use additive migrations with defaults for existing rows. Generate Prisma/jOOQ
through the repository workflow; never edit generated classes. Verify migrations
on disposable migrated Postgres before applying to shared development data.
New state writes require the updated API; migrations do not rewrite Open orders.

## API

Paths below are proposals. All DTOs must be real Java records and exported through
`pnpm api:generate`; frontend types come exclusively from that contract.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/work-orders | Existing parameters plus optional status/category; providerId only after the ID-37 contract is agreed | WorkOrderPageResponse, 200 | Existing order readers |
| GET | /estates/{estateId}/work-orders/{workOrderId} | None | WorkOrderResponse with version and nullable completion details, 200 | Existing order readers |
| GET | /estates/{estateId}/work-orders/{workOrderId}/status-history | None | WorkOrderStatusEventResponse[], 200 | Existing order readers |
| PATCH | /estates/{estateId}/work-orders/{workOrderId}/status | targetStatus, expectedVersion | Updated WorkOrderResponse, 200 | Active estate owner/Manager |
| PUT | /estates/{estateId}/work-orders/{workOrderId}/completion | expectedVersion, findings, workPerformed, partsUsed?, labourCost?, partsCost?, downtimeMinutes? | Updated WorkOrderResponse with completion, 201 first save / 200 identical replay | Active estate owner/Manager |
| GET | /estates/{estateId}/assets/{assetId}/work-order-completions | None | AssetWorkOrderCompletionResponse[], 200, newest first | Existing asset-history readers |

WorkOrderResponse gains required version; detail/closure responses include nullable
completion with the fields above, ID and totalCost. List responses may omit the
full completion body. Status-event DTOs expose status, actor identity/name, time
and version. Asset completion DTOs add work-order reference and saved work location.
All reads retain private/no-store responses. New writes have no automatic retries.

Add `canUpdateWorkOrders` to access context for active owner/Manager memberships;
creation and asset capabilities remain independent. Backend authorization is
authoritative; hiding an action is not the permission check.
Errors retain the existing EstateError shape: 400 validation, 401 no identity,
403 denied membership, 404 inaccessible/missing record, 409 stale/inactive/state
conflict. No provider filtering endpoint or completed assignment path is claimed
until its real estate-scoped provider model is available.

## Frontend

- Retain existing folder routes beneath `estates/$estateId/work-orders/`.
  Add route-local status-history, start-work and completion components beside
  the detail screen; reuse existing shadcn Dialog, Field, Input, Textarea,
  Select, Button, Badge, Table, Alert and Empty components.
- Detail shows current status, allowed action, audit history and read-only outcome
  after closure. The completion dialog labels SGD, minutes, unknown values and
  explicit zero clearly. Errors preserve input. A stale response offers Refresh
  and review rather than silently overwriting another user's work.
- Extend existing list filters with status/category. Add the provider filter only
  when real provider data is integrated. Retain all list sorting/pagination rules.
- Add read-only completion entries to the existing asset Maintenance section,
  ordered with manual events by occurrence/closure time and stable ID. Preserve
  the existing manual event API, owner guard and forecast inputs.
- Keep hooks in lib/work-orders.ts; keys start with user ID and include estate,
  filters and order/asset IDs. Mutations update/invalidate current-user detail,
  list and status-history keys. Closure also invalidates the affected asset's
  completion-history key, with no unrelated forecast/condition invalidation.
- Verify keyboard focus, dialog scrolling, narrow portrait/landscape, theme
  contrast and errors in the same screens. Reuse the fixed estate switcher.

## Edge cases and TDD coverage

Every numbered behaviour needs an observable failing test before implementation.
Use HTTP integration tests with migrated Testcontainers Postgres for transactions,
permissions and constraints; Vitest/Testing Library for user-visible behaviour.

- Role matrix, mixed memberships, missing JWT, foreign order/asset/provider,
  inactive estate and membership revocation while waiting for the write lock.
- Allowed/forbidden transitions, direct Closed/Assigned bypass attempts, no-op
  updates, stale versions, audit actor/time/order and retained historical orders.
- Two progress updates and progress-versus-close races; lock estate first, then
  order and related asset consistently. Recheck state after waiting.
- Status/category/priority/reference combinations, provider isolation when ready,
  cursor reset, pagination, refresh/back and preserved sorting/scroll behaviour.
- Zero versus unknown money/downtime, negative/excess-precision/oversized values,
  whitespace-only required text and completion with/without an asset.
- Same/different retry payloads, parallel identical/different closure requests,
  injected transaction failure and no duplicate completion/audit/history entries.
- Completion of moved/retired assets, unchanged source report/condition/forecast,
  and unchanged existing manual maintenance history.
- Read-only Crew UI, non-owner Manager completion, accessible dialog validation,
  retained input after failure, refresh conflicts, and one visible history entry.

## Implementation phases

- [x] 1. Agree independent product defaults and keep this work on
  `feat/work-order-progress-and-completion`, based on ID-36 at `18f3b3e`.
  Record the decisions in ADR 0034. Shared integration remains phase 5.
- [x] 2. Run failing progress/authorization/version/audit tests, implement the
  schema/API, regenerate Prisma/jOOQ and live OpenAPI types, then build/test the
  status UI and non-provider filters.
- [x] 3. Implement canonical completion with validation, transaction rollback,
  retry and concurrent-duplicate coverage, plus the asset-free completion dialog.
- [x] 4. Add canonical completion reads/display to asset maintenance; verify
  unchanged asset permissions, source reports, condition and forecast inputs.
- [ ] 5. Integrate real assignment/provider filtering with ID-37 and agree
  downstream ID-49/50 consumption of the canonical completion identity. Full
  ID-38 acceptance remains pending this integration.
- [x] 6. Update API/frontend docs and indexes. Pass 913 backend tests, 564 web
  tests, workspace types, formatting/lint and the production web build. Check
  actual components in an isolated Chrome fixture harness at 320×740, 390×844
  (dark) and 844×390, including dialog scrolling, keyboard order and zero/unknown
  outcome display. Deploy the additive migration to shared development through
  Prisma on 2026-10-24.
- [x] 7. Complete live authenticated manual QA and the agreed review follow-ups.
  See the linked follow-up plan for checks, remaining physical-device/large-live-
  dataset limits and QA records. Human commit/PR/base reconciliation remains the
  human's workflow; do not commit or push.

Verification notes: initial HTTP tests failed on missing routes/version/capability
before implementation. UI tests failed first for actions, filters, canonical
asset history and hiding completion cache after permission loss. The final HTTP
suite covers concurrent starts/closures, same/different retries, injected audit
failure rollback, authorization after waiting for an estate lock, inactive estates,
legacy creation history, strict integer versions/downtime and unchanged source/asset records.
Fractional-number regressions were observed failing (0.5 version became 0;
1.5 minutes became 1) before adding feature-local strict parsing. Browser layout checks
used fixture hooks, not live authenticated persistence; live QA remains above.

Shared development already contains the unrelated
`20261022045018_device_deactivation_and_replacement` migration, absent on this
branch. Read-only schema comparison identified only Device deactivation/replacement
additions beyond this branch. Our Prisma deploy applied only
`20261024050000_work_order_progress_and_completion`. Preserve the teammate's
history; do not reset or resolve it to make this branch's history match.

Planning budget: roughly 9–14 focused hours for ID-38/40 together with agreed
contracts and available integrations, excluding review/waiting. One working day
should target the progress foundation; full provider acceptance may remain pending.

## Out of scope

Automatic routing/reassignment/provider management (ID-37), escalation timers
(ID-39), attachments/invoices/OCR (ID-26 and its upstream stories), contractor
self-service, reopening closed work, full manual-history/cost reporting
(ID-49/50), multi-currency/tax accounting, and automatic repair/condition inference.
No new packages, environment settings or unrelated UI refactors are planned.

## Agreed product defaults and pending integration

Agreed by the user on 2026-10-24:

1. **Progress without a provider:** allow explicit OPEN → IN_PROGRESS for manual
   unassigned work. ID-37 still supplies real Assigned/provider filtering.
2. **Who updates:** Crew stay read-only; owners/Managers handle progress and closure.
3. **Outcome detail:** SGD aggregate labour cost, aggregate parts cost, parts-used
   notes and minutes of downtime. Unknowns remain nullable and distinct from zero;
   itemized part quantities/prices are deferred.
4. **Lifecycle:** existing work can close after its asset moves, retires or is
   deactivated while the estate remains active. Closing the job does not restore
   the asset or change its location. Closed status remains final;
   further work uses a new work order. The later approved follow-up permits audited
   corrections to recorded outcomes without reopening (decision 0035).
5. **Forecasts:** closure alone does not change condition or create a
   breakdown/preventive forecast event.

Pending integration decisions: ID-37's provider identity/assignment contract and
ID-49/50's consumption of the canonical completion record. The independent work
may proceed against its agreed scope; full ID-38 completion still requires the
real provider integration. This agreement does not authorize messages or Jira edits.
