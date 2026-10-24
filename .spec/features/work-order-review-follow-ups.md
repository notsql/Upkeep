# Work-order manual review and estate member tables

## PR #36 integration review — 2026-10-24

The user requested resolving conflicts with main after ID-36 merged in PR #33.
Reuse main's creation-form split, which addresses the same reviewer comment on
this PR. Preserve progress/completion, correction audit, pagination and oldest-first
priority ties. Combine main's custom-role permissions and member-role confirmation
with this branch's paginated member table; use its extracted invitation form and
member role controls instead of restoring the old preset-only copies.

Retain both sets of additive migrations without editing their contents. Regenerate
the combined Prisma/jOOQ and OpenAPI types against a disposable local database;
do not change the user's Neon database. Preserve capability-based access guards
and the known Owner/Manager versus Crew/Resident boundaries. Run existing and
integration regression tests, type checks, formatting and the production build.
The known invitation-test fixture failure is outside this review's scope. Leave
the result uncommitted for the human to review and push.

Integration implemented against main `78cabbe`. All 11 conflicted paths are
resolved. The creation-form folder is identical to main, retaining its split
screen/hook/source-field implementation. Member pagination now lives in
`estate-members-table.tsx`; main's custom-role-aware MemberPermission renders
its rows with the existing confirmation flow. Three table integration failures
were observed before implementation. The focused member/creation set then passed
37 tests, including a custom-role change on page two. The estate-switch test's
access fixture was corrected to grant both estates; its assertions are unchanged.

The combined schema replays on disposable Postgres, and Prisma/jOOQ and the
actual Spring OpenAPI/TypeScript contract were regenerated. Existing migration
contents and Neon data are unchanged. Final verification passes: 611 web tests,
1,111 backend tests, workspace types, full lint/formatting and the production
web build. The known invitation-test failure did not recur locally. No new live
browser pass was performed for this merge. Changes are uncommitted for human
review; the updated PR must be pushed before GitHub can verify the resolutions.

**Status:** implemented and verified 2026-10-24; uncommitted for human review
**Owner:** Chan Ding Jie
**Baseline:** `feat/work-order-progress-and-completion` at `18f3b3e`, with the
uncommitted independent ID-38/40 implementation and verification described in
[the original plan](work-order-progress-and-completion.md).

## Problem and review evidence

Manual review on 2026-10-24 found that conflict recovery refreshes the order's
status/actions but leaves its separately queried status history stale. The
conflict warning also remains after a successful refresh. Its presentation needs
clear spacing, hierarchy and theme colors. Conflict detection itself works.

The user wants to correct an accidentally entered completion outcome, show estate
members in a table, keep long tables bounded, and show older jobs first when
their priorities match. Asset maintenance display and Crew/non-owner Manager
permission boundaries passed both user review and live browser checks.

At review time, new orders also showed "Name unavailable" for their Created audit event even when
their creator name is available in the detail footer. Creation currently stores
the event's display name as null. Preserve a truthful fallback for unresolved
identities while fixing the resolvable-name case.

Work orders already have server-side cursor pagination: 20 rows by default,
Next when another page exists, and First page when viewing a later page. Priority
ties at the review baseline used creation time descending. These are existing behaviors, not
missing pagination or nondeterministic ordering.

## Agreed behavior

### 1. Conflict recovery and history

- Use the existing shadcn Alert and Button with a clear title, explanatory text,
  spaced/wrapping actions, pending state and usable light/dark mobile layouts.
- Refresh the current order and status history together. Once both succeed,
  status, actions, completion and history agree without a full-page reload.
  Clear the resolved stale warning; retain useful feedback if either read fails.
- Preserve completion form inputs after failures. A refreshed version requires
  explicit review before resubmission; fetching must not silently authorize an
  overwrite or automatically submit the form.
- Display a resolvable creator's name in the Created event for new and legacy
  orders. Keep authenticated IDs in persistence; do not expose raw IDs as labels.

### 2. Priority ties: oldest first

- Priority retains its existing rank and ascending/descending controls. Within
  each priority, order by creation time ascending in both priority directions.
  Equal timestamps use a stable ID tie-breaker.
- Keep default Created sorting newest first. Change only the priority tie rule.
- Update cursor comparisons and ordering together. Test equal-priority records
  spanning pages in both directions, including identical timestamps, with no
  missing or duplicate records. Reset/invalidate incompatible older priority
  cursors when shipping the changed ordering.

### 3. Completion corrections

This changes the earlier agreement that closed outcomes were immutable. The
user approved this correction policy on 2026-10-24. ADR 0034 remains the record
of the original decision; ADR 0035 supersedes its outcome immutability policy.

- Active estate owners/current Managers can choose Edit outcome on a Closed
  work order. Crew remain read-only; non-owner Managers use work-order access
  and do not gain owner-only asset access.
- Prefill findings, work performed, parts used, labour cost, parts cost and
  downtime. Apply the same required-text, decimal precision, integer and
  zero-versus-unknown validation as initial completion.
- Update completion dialog guidance to explain that closure keeps the order
  Closed while authorized users can correct its recorded outcome.
- Require a short correction reason, trimmed/nonblank and at most 500 characters.
  Record who corrected it, when, and the before/after outcome. Make that audit
  visible from the work-order detail.
- Preserve Closed status, original closer/closure time, work-order identity,
  linked asset/location, and the single canonical completion ID. A correction
  does not append another Closed transition or count as another repair.
- Show the latest outcome in work-order detail and owner asset Maintenance,
  with an Edited indicator and correction author/time. Historical revisions
  remain available in the correction audit.
- Recheck current membership/ownership and active estate under the estate-first
  lock. Asset movement/retirement does not prevent correction of existing work.
  Inactive estates remain read-only.
- Use expectedVersion and increment the work-order version atomically with the
  correction/audit. Reject stale/different concurrent changes with 409. Retain
  input and offer refresh/review. An identical retry of the latest correction
  after a lost response must not duplicate revisions. An unchanged submission
  should not create an audit revision.
- Initial PUT completion keeps its existing close/replay semantics; use a
  dedicated correction operation. Source reports, asset condition and forecast
  inputs stay unchanged.

### 4. Estate members table

- On `/estates/$estateId/council`, replace the member cards with the existing
  shared shadcn Table. Columns: Name, Email, Role/Owner badge, Actions.
- Retain current role editing, removal, ownership transfer, confirmation dialogs,
  per-row pending/error feedback, self-access restrictions and owner protections.
  Existing invitation forms and permission boundaries remain as built.
- Use labelled controls and a table caption/header structure. Keep long names
  and emails readable. On narrow screens, constrain horizontal scrolling to the
  table and keep all actions reachable; the page itself must not overflow.
- Paginate the existing member array locally at 20 members per page, with
  Previous/Next and a truthful visible range/total. Clamp the page after removal
  or a refreshed shorter roster; reset on estate/user change. No new member API
  or permission expansion is needed for this presentation change.

### 5. Table pagination presentation

- Keep work orders at 20 rows per server page. Provide a clear, responsive footer
  showing the displayed row count and First page/Next availability.
- Add Previous for pages visited in the current list session,
  retaining cursor history scoped to user, estate, filters and sorting. Reset
  that history on criteria/context changes. A directly opened later-page URL
  without prior cursors still offers First page; do not invent its previous
  cursor, page number or total. No bidirectional API change is required.
- Filters and ordering remain server-side before pagination. Navigation retains
  criteria; changing filters/sort resets pagination. Disable navigation while
  placeholder rows are displayed and retain the existing sorting scroll behavior.
- This follow-up targets work orders and estate members. Review additional tables
  individually when requested rather than refactoring every list in this change.

## Data and API

Prisma adds nullable editedByUserId/editedByName (VarChar 255) and editedAt
(Timestamptz) to WorkOrderCompletion. WorkOrderCompletionRevision stores UUID
id/estateId/workOrderId, integer fromVersion/version, correctionReason (500),
changedByUserId (255), nullable changedByName (255), server changedAt, and
beforeOutcome/afterOutcome JSONB snapshots of WorkOrderCompletionResponse.
A composite completion foreign key enforces the same estate; order/version is
unique. One transaction updates the canonical outcome and appends the revision,
preserving the original values in the first before snapshot. Prisma generated
the additive migration; Prisma/jOOQ and the live OpenAPI types were regenerated.

| Method | Path | Request/response | Access |
| --- | --- | --- | --- |
| PATCH | `/estates/{estateId}/work-orders/{workOrderId}/completion` | expectedVersion, correctionReason and complete replacement of editable outcome fields; 200 updated WorkOrderResponse | Active owner/Manager |
| GET | `/estates/{estateId}/work-orders/{workOrderId}/completion-revisions` | Ordered correction audit with before/after outcome, actor/name, reason, time and versions | Same read authority as work-order detail |

Use existing 400 validation, 401 identity, 403 known denied membership, 404
missing/foreign record and 409 stale version/inactive estate/wrong status rules.
Contract must explicitly represent clearing nullable optional values. Correction
success refreshes the detail, list and owner-only asset completion caches; cache
keys remain user-scoped. Downstream consumers must treat revisions as updates to
the same completion, not new maintenance/cost entries.

## TDD and delivery order

- [x] User agreed the draft, including correction permissions/audit and pagination.
  ID-49/50 integration must consume updates under the stable completion identity.
- [x] Observe failing web regressions for conflict refresh updating detail/history,
  clearing the warning, preserving form input and retrying a failed refresh. Fix
  recovery and presentation, then browser-review light/dark portrait/landscape.
- [x] Observe failing server tests for resolvable Created actor names and oldest
  priority ties across cursor boundaries; implement and update sorting docs.
- [x] Observe failing server tests for correction authorization, validation,
  optimistic concurrency, transaction rollback, retry/audit uniqueness and stable
  canonical identity; implement schema/API and regenerate the contract. Add the
  superseding decision and update downstream integration notes.
- [x] Observe failing web tests for editing/prefill, clear optional values,
  zero/unknown, input retention/conflict review, audit display and updated asset
  history; implement correction UI with existing shadcn components.
- [x] Observe failing member-table/pagination tests, including existing protected
  actions, 21+ entries, shorter refreshed lists and estate changes. Implement the
  table and agreed work-order footer/Previous behavior.
- [x] Update `.docs/api/work-orders.md`, `.docs/frontend/work-orders.md`, asset
  documentation and `.docs/frontend/council-invitations.md` to match implemented
  behavior. Run repository formatting, type checks, full tests and web build;
  repeat relevant authenticated/mobile browser checks. Human commits/pushes.

## Other findings recorded separately

Existing asset registration has an empty location picker with no guidance when
an estate has no locations. Existing asset retirement history displays a raw
user ID. Keep these as separately scoped follow-ups unless explicitly included.
Provider assignment/filter integration still depends on ID-37; the
independent review fixes and outcome corrections do not require inventing it.


## Verification and remaining integration

- Observed TDD failures before implementation: stale history after Refresh;
  missing table/Previous controls; 20 backend regressions for names/ordering and
  correction routes; correction form/audit tests; discarded draft after a failed
  refresh; dialog mode/navigation regressions. Revised prior priority tests were
  also observed failing against newest-first ordering before restoring the fix.
- Clean uncached combined workspace suite passed 936 backend and 573 web tests.
  The two final dialog changes then passed all 575 web tests; backend source was
  unchanged. Workspace type checks, pnpm fix/check, production web build and
  git diff --check pass. Rollback and identical/different concurrent correction
  requests are covered against migrated Testcontainers Postgres.
- Shared development received only the additive correction migration through
  Prisma. Read-only verification confirmed it and the pre-existing Device
  migration remain recorded. Live `/v3/api-docs` matches the generated contract.
- Authenticated browser checks passed owner/non-owner Manager corrections,
  stale-tab rejection with preserved input, refreshed status history and cleared
  warning, before/after audit, Crew read-only detail, and oldest-first priority
  ties. Simulating a lost 201 completion response followed by Refresh kept the
  dialog in completion mode and showed Closed with one completion/three status
  events. Edited retired-asset history retained one maintenance entry, the saved
  work location and original closer/time, with condition/forecast unchanged.
- Live dark portrait 320×740 edit dialog/member table, 390×844 corrected
  maintenance, and light landscape 844×390 edit dialog fit without page overflow.
  The member table scrolls within its container at 320px; landscape Save/Cancel
  are reachable by scrolling. Keyboard focus moved Findings → Work performed.
- Browser QA changed only the earlier QA outcomes TS-003-W0003 and BRO-123-W0001,
  and created/closed TS-003-W0004 (labelled refresh/status-history regression).
  Existing non-QA records and estate member permissions were only read. Browser
  fault interception was disabled, the extra QA tab closed and theme/viewport
  restored. Temporary drivers/screenshots stay outside the repository.
- Physical phone and a live 20+ matching-row dataset were not exercised. The
  21-member page/clamping/context-reset and work-order cursor navigation cases
  have automated coverage. Inactive-estate correction rules have backend coverage.
- ID-37 real provider assignment/filtering and ID-49/50 downstream consumption
  remain separate integration work. These checks do not mark full ID-38 done.
  No dependency installation, commit or push was performed.
