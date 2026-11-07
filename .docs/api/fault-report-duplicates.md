# Duplicate fault reports API (ID-74)

Source of truth: `packages/api/openapi.json`. Spec:
`.spec/features/fault-report-duplicates.md`; decision 0044. Implementation:
`com.proj.server.report` (`DuplicateDetector`, `DuplicateRepository`,
`DuplicateService`, `EstateReportService`); Prisma model
`IssueReportDuplicate`.

Repeat reports of one fault are linked to the original report, never discarded.
Detection only suggests a link. A manager confirms or rejects it, or links two
reports by hand. Nothing changes a work order's priority. Residents see none of
this: every `/resident/**` response is unchanged.

## Data

`IssueReportDuplicate` holds one row per linked report (`reportId` is the
primary key):

| Column | Type | Meaning |
| --- | --- | --- |
| `reportId` | UUID | The duplicate |
| `estateId` | UUID | Carried for composite foreign keys |
| `originalReportId` | UUID | The original |
| `state` | `SUSPECTED` \| `CONFIRMED` \| `REJECTED` | Current state |
| `source` | `DETECTED` \| `MANUAL` | How the link was made |
| `locationMatch` | `EXACT` \| `NEARBY` \| null | Detection signal; null for `MANUAL` |
| `textSimilarity` | decimal(4,3) \| null | Detection signal; null for `MANUAL` |
| `repeatCue` | boolean \| null | Detection signal; null for `MANUAL` |
| `createdAt` | timestamptz | Database default |
| `decidedByUserId`, `decidedAt` | string, timestamptz \| null | Last confirm, reject or manual link |

- Both report references are composite `(id, estateId)` foreign keys, so a link
  cannot cross estates.
- `CHECK (reportId <> originalReportId)` stops a report linking to itself.
- `(estateId, originalReportId, state)` is indexed for the counts.
- `WorkOrder(estateId, sourceReportId)` is indexed for the open check and the
  work-order count.
- Migration: `20261105083026_fault_report_duplicates`. It is expand-only, so
  the code already running can ignore it.
- Only the last decision on each link is kept.

## Detection

Detection runs inside the `POST /resident/reports` transaction, after the insert
and while the estate row is locked, so submissions to one estate are
serialized. The 201 response is the same whether or not a link is saved.

1. **Candidates.** Reports in the same estate that:
   - are open: no work orders, or at least one work order that is not
     `CLOSED`;
   - have no `SUSPECTED` or `CONFIRMED` link of their own;
   - are in the new report's location group.

   A LEVEL and its COMMON_AREAs form one group. A BLOCK's direct COMMON_AREAs
   form another. Groups use the current `locationId` and parent edges,
   including deactivated nodes. There is no time limit.
2. **Signals.**
   - Text is title plus description, lowercased and split on anything that
     isn't a Unicode letter or digit. Tokens shorter than 3 characters and
     English stop words are dropped.
   - Similarity is the Jaccard index of the two token sets.
   - A repeat cue is any of `again`, `still`, `another`, `same`, `keeps`,
     `recurring`, `recurred`, `repeated`, `not fixed`, `came back`,
     `once more`, as a whole word or phrase in the new report.
3. **Qualifying.** A candidate qualifies when its similarity is at least 0.25,
   or the new report has a repeat cue.
4. **Choosing.** Exact location before nearby, then higher similarity, then
   older `createdAt`, then lower ID. The chosen candidate gets a `SUSPECTED`,
   `DETECTED` link.

The threshold and the word lists are untuned first guesses, held as constants in
`DuplicateDetector`.

## DTOs

| DTO | Fields |
| --- | --- |
| `DuplicateState` | `SUSPECTED` \| `CONFIRMED` \| `REJECTED` |
| `DuplicateOf` | `reportId: UUID`, `title: string`, `state: DuplicateState` (only active states appear) |
| `LinkedDuplicate` | `reportId: UUID`, `title: string`, `location: ReportLocation`, `state: DuplicateState`, `createdAt: date-time` |
| `EstateIssueReportSummaryResponse` | All `IssueReportSummaryResponse` fields, plus `urgency: LOW \| MEDIUM \| HIGH \| URGENT`, `isSafety: boolean`, `urgencyVersion: int`, `confirmedDuplicateCount: int`, `suspectedDuplicateCount: int`, `duplicateOf: DuplicateOf \| null` |
| `EstateIssueReportDetailResponse` | The summary fields, `images: ReportImage[]`, `lastUrgencyChange: ReportUrgencyChange \| null`, and `duplicates: LinkedDuplicate[]` (active links to this report, newest first) |
| `EstateIssueReportPageResponse` | `items: EstateIssueReportSummaryResponse[]`, `nextCursor: string \| null` |
| `ReviewDuplicateRequest` | `state: CONFIRMED \| REJECTED`, `expectedState: SUSPECTED \| CONFIRMED` (both required) |
| `LinkDuplicateRequest` | `originalReportId: UUID` (required) |

`duplicateOf` is `oneOf: [DuplicateOf, null]` in the contract, so the generated
type is `DuplicateOf | null`. `DuplicateOpenApiConfiguration` rewrites it,
following the other feature nullability customizers, because a nullable sibling
of `$ref` generates as always present.

Neither the counts nor `duplicateOf` include `REJECTED` links. The estate list,
detail and relocation endpoints (see [estate-reports.md](estate-reports.md))
return these estate DTOs. The resident endpoints keep the original DTOs.

## Endpoints

Both endpoints need current MANAGER membership in an active estate. Owners
qualify through their MANAGER membership. CREW, CUSTOM, COUNCIL, RESIDENT and
MEMBER get 403. Strangers, and estates or reports that are missing or
inaccessible, get 404. The estate row is locked before membership is checked.
Responses carry `Cache-Control: private, no-store`.

| Method and path | Request | Success | Errors |
| --- | --- | --- | --- |
| PATCH `/estates/{estateId}/reports/{reportId}/duplicate` | `ReviewDuplicateRequest` | 200 `EstateIssueReportDetailResponse` | 400 malformed body or a disallowed pair; 401; 403; 404 report missing or has no link; 409 `expectedState` is stale, or the estate is inactive |
| PUT `/estates/{estateId}/reports/{reportId}/duplicate` | `LinkDuplicateRequest` | 200 `EstateIssueReportDetailResponse` of the duplicate | 400 missing original, self-link, the original has its own active link, or the report has active duplicates of its own; 401; 403; 404 report or original missing or in another estate; 409 the report already has an active link, or the estate is inactive |

**Review** allows `SUSPECTED → CONFIRMED`, `SUSPECTED → REJECTED` and
`CONFIRMED → REJECTED`. Any other pair is 400, checked before staleness. It
records `decidedByUserId` and `decidedAt`, and changes no report, image or work
order. Detection never re-runs on existing reports, so a rejected pair is not
suggested again. A report whose link was rejected becomes eligible as an
original.

**Manual linking** saves a `CONFIRMED`, `MANUAL` link and replaces a
`REJECTED` one. It ignores location and openness. A closed original, or one in
another block, is allowed. There is no `expectedState`: the 409 for an existing
active link covers detection or another manager linking first. Merging two
groups is not supported.

```text
PATCH /estates/<estate>/reports/<report>/duplicate
{"state":"CONFIRMED","expectedState":"SUSPECTED"}

PUT /estates/<estate>/reports/<report>/duplicate
{"originalReportId":"<original-report>"}
```

## Work orders from linked reports

`POST /estates/{estateId}/work-orders` with a `sourceReportId` that has a
`SUSPECTED` or `CONFIRMED` link returns 409, "This report is linked as a
duplicate. Create the work order from the original report, or reject the link
first.", and saves nothing. The check runs after the estate lock, alongside the
other source-report checks. Reports with a `REJECTED` link or no link are
unaffected. Work orders that existed before a report was linked are kept.

## Related contracts

- `WorkOrderResponse.sourceReportConfirmedDuplicateCount: int`: the
  `CONFIRMED` duplicates of the work order's source report, or 0 without one.
  It is on every work-order list and detail response; see
  [work-orders.md](work-orders.md).
- `EstateAccessResponse.canReviewFaultReportDuplicates: boolean`: true only for
  current MANAGER membership in an active estate; see [access.md](access.md).
