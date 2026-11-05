# Duplicate fault reports

**Status:** agreed by the user on 2026-11-05; built 2026-11-05, tests first; work-order block for linked reports added after review; manual browser check pending
**Owner:** unassigned
**Jira:** ID-74
**Related features:** [Resident fault reporting](resident-fault-reporting.md),
[fault report locations](fault-report-locations.md),
[create work order](create-work-order.md)

## Problem

As a manager, I want repeat reports of the same fault grouped so that one leak
does not become five work orders.

Today every resident submission is an independent `IssueReport`. Nothing
connects a second, third or fifth report of the same leak to the first, so
responders read each one cold, may raise a work order for each, and cannot see
that one fault has been reported many times. That repetition is itself a signal
of urgency, and it is lost.

Two facts about the current system shape this spec:

- Reports have no lifecycle. `IssueReport.status` is always `SUBMITTED`, so
  whether a report is "open" must be derived from its work orders.
- Reports have no severity. Severity lives on work orders as `priority`, and
  there is no endpoint that changes a saved work order's priority.

### Acceptance criteria mapping

| Story criterion | Planned work |
| --- | --- |
| New reports are compared against open reports at the same or nearby location | On submission, candidates are open, unlinked reports in the same estate at the same location or the same location group (defined below). No time limit. |
| Repeat cues such as "again" are a duplicate signal | A fixed list of cue words and phrases in the new report's title or description counts as a signal alongside text similarity. |
| Duplicates are linked to the original rather than discarded | A match saves a `SUSPECTED` link to the original. The new report is saved in full either way. Managers confirm or reject the link, and can link reports that detection missed. |
| Duplicate count is visible and can raise the original's severity | Confirmed and suspected counts appear on estate report lists and detail, and on work orders raised from the original, to signal urgency. Raising priority is left to the manager and is not part of this story. |

Decisions agreed with the user on 2026-11-05:

- Detection only suggests. A manager confirms or rejects each link.
- Managers can also link two reports by hand.
- Priority is never raised automatically. The count is shown to signal urgency.
  Changing a saved work order's priority is out of scope for this story.
- Only MANAGER members review and link duplicates.
- There is no time limit on candidates. A fault that resurfaces a year later is
  still the same fault. A report with no work order stays open indefinitely and
  keeps collecting duplicates; this is intended.
- The detection threshold and word lists are untuned first guesses. There is no
  sample data to check them against yet.
- Residents see nothing of this feature.

## Behaviour

### Open reports

- A report is **open** when it has no work orders, or when at least one of the
  work orders whose `sourceReportId` is that report is not `CLOSED`.
- A report is **closed** when it has at least one work order and every one of
  them is `CLOSED`.
- Openness is computed when it is needed. No column stores it, and
  `IssueReport.status` is unchanged by this feature.

### Location matching

- Two reports have an **exact** location match when their `locationId`s are
  equal.
- Each report location belongs to one **location group**:
  - a LEVEL, and every COMMON_AREA whose parent is that LEVEL, form one group;
  - the COMMON_AREAs whose parent is a BLOCK form one group for that block.
- Two reports have a **nearby** match when their locations differ but belong to
  the same group.
- Reports on different levels, in different blocks, or one in a level's group
  and one in a block's direct common-area group, do not match.
- Matching uses each report's current `locationId` and current parent edges, and
  includes deactivated location nodes, consistent with report filtering.

### Text signals

- Text is the title and description joined together, lowercased and split on
  every non-letter, non-digit character. Tokens shorter than three characters,
  and tokens in a fixed English stop-word list, are dropped.
- **Text similarity** is the Jaccard index of the two reports' token sets: the
  size of the intersection divided by the size of the union. Two empty sets have
  similarity 0.
- A report has a **repeat cue** when its title or description contains, as a
  whole word or phrase and case-insensitively, any of: `again`, `still`,
  `another`, `same`, `keeps`, `recurring`, `recurred`, `repeated`, `not fixed`,
  `came back`, `once more`.
- Only the new report is checked for repeat cues.
- The similarity threshold (0.25), the stop-word list and the cue list live as
  constants in one detection class, not configuration.

### Detection on submission

- Detection runs inside the existing `POST /resident/reports` write
  transaction, after the report is inserted and while the estate lock is held.
- Candidates are reports that:
  - are in the same estate;
  - are not the new report;
  - are open;
  - have an exact or nearby location match with the new report;
  - are not themselves a `SUSPECTED` or `CONFIRMED` duplicate. Reports with a
    `REJECTED` link, or no link, are candidates.
- A candidate qualifies when its text similarity with the new report is at
  least 0.25, or the new report has a repeat cue.
- If no candidate qualifies, no link is saved.
- If several qualify, the original is chosen by, in order:
  1. exact match before nearby;
  2. higher text similarity first;
  3. older `createdAt` first;
  4. lower `id` first.
- A qualifying match saves one `SUSPECTED` link from the new report to the
  chosen original, with source `DETECTED`, the location match (`EXACT` or
  `NEARBY`), the similarity and whether a repeat cue was present.
- Submission returns the same 201 response, with the same fields, whether or not
  a link was saved.
- Because the resident create path already locks the estate row, two
  submissions in the same estate are serialized. The second one sees the first
  as a candidate.
- A link always points at a report that has no `SUSPECTED` or `CONFIRMED` link
  of its own, so chains of duplicates cannot form.

### Reviewing links

- A link has one state: `SUSPECTED`, `CONFIRMED` or `REJECTED`.
- The allowed transitions are `SUSPECTED → CONFIRMED`, `SUSPECTED → REJECTED`
  and `CONFIRMED → REJECTED`. Review cannot move a link out of `REJECTED`; only
  manual linking (below) replaces a rejected link. Any other transition returns
  400.
- The request carries the state the caller saw. If that is not the current
  state, the request returns 409 and nothing changes.
- A transition records the deciding user and the decision time.
- Rejecting a link leaves both reports, their images and their work orders
  unchanged. The rejected report becomes an eligible original for later
  submissions.
- Confirming or rejecting does not change any work order, including priority.

### Work orders from duplicates

- **Revised by the user on 2026-11-05:** a work order cannot be created from a
  report that has a `SUSPECTED` or `CONFIRMED` link. `POST
  /estates/{estateId}/work-orders` with that report as `sourceReportId`
  returns 409 and saves nothing.
- The check runs after the estate row is locked, so it is serialized with
  review, linking and detection.
- A report whose link is `REJECTED`, or that has no link, can be used as before.
  Rejecting a suspected link lifts the block.
- Work orders that already exist on a report before it is linked are kept and
  unchanged.
- Detection never runs again on a report that already exists, so a rejected
  pair is not suggested again.

### Manual linking

- A manager can link a report (the duplicate) to another report (the original).
  The link is saved as `CONFIRMED` with source `MANUAL`, the deciding user and
  time, and no location match, similarity or cue values.
- The duplicate must have no link, or a `REJECTED` link. A `REJECTED` link is
  replaced by the manual link. To re-point a `SUSPECTED` or `CONFIRMED` link, a
  manager first rejects it.
- If the duplicate currently has a `SUSPECTED` or `CONFIRMED` link, the request
  returns 409 and nothing changes. This covers detection or another manager
  linking it in the meantime.
- **Revised during build on 2026-11-05:** the request has no `expectedState`.
  Estate responses expose only active links, so a caller cannot tell "no link"
  from "rejected link", and linking treats both the same way.
- The original must be in the same estate. Otherwise it returns 404.
- The original must not be the duplicate itself. Otherwise it returns 400.
- The original must not have a `SUSPECTED` or `CONFIRMED` link of its own.
  Otherwise it returns 400, with a message saying to link to that report's
  original instead.
- The duplicate must not have `SUSPECTED` or `CONFIRMED` duplicates linked to
  it. Otherwise it returns 400, because merging two groups is out of scope.
- Manual linking ignores location and openness. A closed original, or one in
  another block, can be chosen.
- Linking does not change either report, its images or its work orders.

### Who can review and link

- Only current MANAGER members of the estate may confirm, reject or link. This
  includes owners, through their MANAGER membership. CREW, custom roles,
  COUNCIL, RESIDENT and MEMBER get 403. Unknown or inaccessible estates and
  reports get 404.
- Reviewing and linking require an active estate. An inactive estate returns
  409.
- Membership is checked after the estate row is locked, the same order
  relocation uses.

### Visibility

- Estate report list items and details carry:
  - `confirmedDuplicateCount` and `suspectedDuplicateCount`: the number of
    links in each state pointing at this report;
  - `duplicateOf`: the original's ID and title and the link state, or null when
    the report has no `SUSPECTED` or `CONFIRMED` link.
- `REJECTED` links appear in neither count nor in `duplicateOf`.
- Estate report detail lists the reports linked to it as `SUSPECTED` or
  `CONFIRMED`, newest first.
- Reading this data requires VIEW_FAULT_REPORTS (MANAGER, CREW or a custom
  grant), the same as the rest of the estate report endpoints.
- Every work-order response carries `sourceReportConfirmedDuplicateCount`: the
  confirmed duplicates of its source report, or 0 when it has no source report.
- Resident endpoints return exactly the fields they return today. No resident
  response, screen or message mentions duplicates.
- Access context exposes `canReviewFaultReportDuplicates` per estate, true only
  for an active estate with current MANAGER membership.

### Web

- The estate report list shows a "N duplicates" badge on an original with
  confirmed duplicates, and a "Possible duplicate" or "Duplicate" badge on a
  linked report.
- When suspected duplicates exist, the original also shows a "N to review"
  badge.
- Report detail of a linked report shows "Possible duplicate of <title>" or
  "Duplicate of <title>", linking to the original. With
  `canReviewFaultReportDuplicates` it offers Confirm and Not a duplicate on a
  suspected link, and Not a duplicate on a confirmed link.
- Report detail of an original shows its confirmed and suspected counts and
  lists the linked reports, each linking to its own detail.
- With `canReviewFaultReportDuplicates`, report detail offers Mark as duplicate
  when the report has no `SUSPECTED` or `CONFIRMED` link and no duplicates of
  its own. It opens the existing `ReportSourcePicker` dialog, with its block and
  level filters and pagination, to choose the original. The current report is
  not offered.
- `ReportSourcePicker` moves from the work-order `new/-components/` folder to
  `apps/web/src/components/reports/`, because two routes now use it. Its
  work-order behaviour is unchanged.
- A 400 from linking (for example, the chosen report is itself a duplicate)
  shows the server's message in the dialog and keeps the dialog open.
- On a linked report's detail, Create work order is hidden. The duplicate
  section says the report cannot get its own work order and links to the
  original; for a suspected link it adds that rejecting the link allows one.
- `ReportSourcePicker` does not offer reports with an active link, in either
  the work-order form or Mark as duplicate.
- Work-order list rows and detail show the confirmed-duplicate count when it is
  above 0.
- A 409 on review shows an error and offers Reload. Nothing changes
  optimistically.

## Data

New model `IssueReportDuplicate` in
`packages/db/prisma/schema/schema.prisma`, one row per linked report:

| Field | Type | Notes |
| --- | --- | --- |
| `reportId` | UUID, primary key | The duplicate. One link per report. |
| `estateId` | UUID | Carried for composite FKs. |
| `originalReportId` | UUID | The original. |
| `state` | VarChar(20) | `SUSPECTED`, `CONFIRMED`, `REJECTED`. |
| `source` | VarChar(20) | `DETECTED` or `MANUAL`. |
| `locationMatch` | VarChar(10)? | `EXACT` or `NEARBY`; null for `MANUAL`. |
| `textSimilarity` | Decimal(4,3)? | 0.000 to 1.000; null for `MANUAL`. |
| `repeatCue` | Boolean? | Null for `MANUAL`. |
| `createdAt` | Timestamptz | Database default. |
| `decidedByUserId` | VarChar(255)? | Set on confirm or reject. |
| `decidedAt` | Timestamptz? | Set on confirm or reject. |

- `(reportId, estateId)` and `(originalReportId, estateId)` are composite
  foreign keys to `IssueReport(id, estateId)`, both `Restrict`, so a link
  cannot cross estates.
- A hand-written `CHECK (reportId <> originalReportId)` goes in the migration.
- Index on `(estateId, originalReportId, state)` for counts and the linked list.
- An index on `WorkOrder(estateId, sourceReportId)` supports the openness check
  and the work-order count.
- `IssueReport` and `WorkOrder` are not changed.
- This is an expand-only migration: the running API ignores the new table, so it
  is safe to deploy before or after the server.
- Run `pnpm db:generate` to regenerate jOOQ, and commit the migration and
  generated sources together.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/reports` | Unchanged | 200 `EstateIssueReportPageResponse` | VIEW_FAULT_REPORTS |
| GET | `/estates/{estateId}/reports/{reportId}` | Unchanged | 200 `EstateIssueReportDetailResponse` | VIEW_FAULT_REPORTS |
| PATCH | `/estates/{estateId}/reports/{reportId}/location` | Unchanged | 200 `EstateIssueReportDetailResponse` | RELOCATE_FAULT_REPORTS |
| PATCH | `/estates/{estateId}/reports/{reportId}/duplicate` | `ReviewDuplicateRequest` | 200 `EstateIssueReportDetailResponse`; 400 invalid transition or body; 401; 403; 404 report has no link, or estate/report missing; 409 stale `expectedState` or inactive estate | MANAGER membership |
| PUT | `/estates/{estateId}/reports/{reportId}/duplicate` | `LinkDuplicateRequest` | 200 `EstateIssueReportDetailResponse` of the duplicate; 400 invalid body, self-link, original is itself linked, or duplicate has its own duplicates; 401; 403; 404 estate, report or original missing or in another estate; 409 current link is `SUSPECTED`/`CONFIRMED`, or inactive estate | MANAGER membership |
| GET | `/estates/{estateId}/work-orders` and `/{workOrderId}` | Unchanged | `WorkOrderResponse` plus `sourceReportConfirmedDuplicateCount` | Unchanged |
| POST | `/estates/{estateId}/work-orders` | Unchanged | Adds 409 when `sourceReportId` has a `SUSPECTED` or `CONFIRMED` link | Unchanged |
| GET | `/access/...` (existing access context) | Unchanged | Estate capabilities plus `canReviewFaultReportDuplicates: boolean` | Unchanged |

DTOs:

- `DuplicateState`: `SUSPECTED | CONFIRMED | REJECTED`.
- `DuplicateOf`: `reportId: UUID`, `title: string`, `state: DuplicateState`
  (only `SUSPECTED` or `CONFIRMED` appear).
- `EstateIssueReportSummaryResponse`: every `IssueReportSummaryResponse` field,
  plus `confirmedDuplicateCount: integer`, `suspectedDuplicateCount: integer`
  and `duplicateOf: DuplicateOf | null`.
- `EstateIssueReportDetailResponse`: the summary fields, `images`, and
  `duplicates: LinkedDuplicate[]`.
- `LinkedDuplicate`: `reportId: UUID`, `title: string`, `location:
  ReportLocation`, `state: DuplicateState`, `createdAt: date-time`.
- `EstateIssueReportPageResponse`: `items: EstateIssueReportSummaryResponse[]`,
  `nextCursor: string | null`.
- `ReviewDuplicateRequest`: `state: CONFIRMED | REJECTED` (required),
  `expectedState: SUSPECTED | CONFIRMED` (required).
- `LinkDuplicateRequest`: `originalReportId: UUID` (required).

New estate-only DTOs are used because `IssueReportSummaryResponse` and
`IssueReportDetailResponse` are shared with the resident endpoints, and those
must stay unchanged. The resident endpoints keep the existing DTOs.

Example:

```text
PATCH /estates/<estate-uuid>/reports/<report-uuid>/duplicate
Content-Type: application/json

{"state":"CONFIRMED","expectedState":"SUSPECTED"}
```

```text
PUT /estates/<estate-uuid>/reports/<report-uuid>/duplicate
Content-Type: application/json

{"originalReportId":"<original-report-uuid>"}
```

## Edge cases

- **First report of a fault.** No candidates, so no link is saved.
- **Repeat cue but no open report nearby.** No link. A cue never links on its
  own without a location match.
- **Similar text in another location group.** No link.
- **Original closes after a link is saved.** The link and counts remain. Later
  submissions no longer treat it as a candidate. If the fault recurs, the new
  report starts a new group or joins another open original.
- **A closed report with an open work order added later** becomes open again and
  is a candidate for later submissions.
- **Relocating a linked report.** The link stays and is not re-evaluated. A
  manager can reject it if the new location makes it wrong.
- **Relocating an original.** The links stay. Later candidacy uses the new
  location.
- **Rejected duplicates as originals.** A report whose link was rejected can be
  chosen as an original for later submissions.
- **Work order raised from a duplicate.** Blocked with 409 for `SUSPECTED` and
  `CONFIRMED` links (revised 2026-11-05). A request built from a stale page
  still gets the 409, because the server checks under the estate lock.
- **Linking a report that already has work orders.** Allowed. Its existing work
  orders are kept; only new ones are blocked.
- **Two managers review at once.** The second gets 409 because its
  `expectedState` is stale.
- **Manual link races detection.** Linking and resident submission both lock
  the estate row, so a report that detection has just linked returns 409 to a
  manager who saw it unlinked.
- **Manual link to a report that has since been linked elsewhere.** The original
  is checked under the estate lock and returns 400 if it now has its own
  `SUSPECTED` or `CONFIRMED` link.
- **Manually linking an original that already has duplicates.** Rejected with
  400. A manager must reject that group's links first, since merging groups is
  out of scope.
- **Membership revoked mid-session.** The next review request returns 403, as
  with relocation.
- **Inactive estate.** Reading still works; review returns 409.
- **Large estates with no time limit.** Candidates are limited to one location
  group within one estate, so the set stays small. Text scoring happens in Java
  over that set.
- **Unicode text.** Tokenizing uses Unicode letter and digit classes, so
  non-ASCII words still contribute to similarity. The stop-word and cue lists
  are English only.

## Out of scope

- Changing a saved work order's priority. No such endpoint exists, so a manager
  cannot yet act on the count in the app. This is left for a later story.
- Raising priority or severity automatically.
- Merging two duplicate groups, or re-pointing a link without rejecting it
  first.
- Re-running detection on existing reports, including a backfill of current data.
- A severity field on reports, or a report lifecycle or status change.
- Any resident-facing display, notification or message.
- A list filter for "needs review".
- Matching across levels, for example a leak reported on the level below.
- Machine-learning or Postgres full-text and trigram similarity.
- Audit history beyond the last decision on each link.
- Custom-role permission codes for reviewing duplicates.

## Implementation phases

- [x] Prisma model, migration (CHECK and indexes), `pnpm db:generate`.
- [x] Detection logic (tokenizing, similarity, cues, location groups, ranking)
      as plain unit tests first.
- [x] Detection wired into resident submission; Testcontainers context tests,
      including the resident response staying unchanged.
- [x] Estate DTOs, counts, `duplicateOf` and linked list on list and detail.
- [x] Review endpoint with transitions, 409 and MANAGER-only access; access
      context capability.
- [x] Manual link endpoint with original, chain and group checks.
- [x] `sourceReportConfirmedDuplicateCount` on work orders.
- [x] `pnpm api:generate`, then web: list badges, detail section, review
      actions, work-order warning and count, all test-first.
- [x] Move `ReportSourcePicker` to `components/reports/` (work-order tests stay
      green), then add the Mark as duplicate dialog test-first.
- [x] Decision note (rule-based detection with suggest-and-confirm), `.docs/api/`
      and `.docs/frontend/` updates for estate reports and work orders, and the
      `.spec/README.md` status row.

## Open questions

None outstanding. The questions raised in the first draft were answered on
2026-11-05 and are recorded under "Decisions agreed" above.
