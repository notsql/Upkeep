# Asset history date range

**Status:** built — automated verification passed
**Owner:** TBD

## Problem

History currently requires paging through all recorded activity to find events
from a particular period. Readers need to narrow an asset's history to dates
relevant to a review.

This extends [asset-history-timeline.md](asset-history-timeline.md), which excluded
timeline date filters from its initial delivery.

## Behaviour

1. The asset History screen has labelled **From date** and **To date** fields,
   **Apply dates** and **Clear dates** actions. Dates are calendar dates in
   Singapore time, explained beside the controls.
2. Both fields are optional. No bounds shows all recorded history; From alone
   shows that date and later; To alone shows that date and earlier.
3. Both selected days are included. Choosing the same date for both fields
   returns that entire Singapore calendar day.
4. Filtering uses each entry's existing occurrence date/time. Date-only entries
   use their recorded occurrence day. Timestamped entries use Singapore time.
   Invoices and service reports use their original upload time; corrected
   completions retain their original completion time.
5. The server filters the combined sources before ordering and pagination.
   Every matching entry remains reachable through Load more, with existing
   kind/UUID tie-breakers and document deduplication preserved.
6. Editing date fields does not change results until Apply dates is selected.
   Applying a changed range starts at page one and closes an open document
   viewer. Clear dates clears both fields and restores unfiltered history.
7. Applied dates are stored as `from` and `to` in the History URL. Reload and
   browser Back/Forward restore the applied range and its displayed fields.
   Pagination and Retry preserve the applied range.
8. From after To is invalid. The screen shows an accessible validation message
   and retains the current results without submitting the invalid range.
   Invalid URL dates show an error instead of silently displaying all history.
9. No entries in a selected range displays **No recorded history in this date
   range**, with Clear dates available. Unfiltered empty history keeps its
   existing empty state. The asset identity summary remains visible in either case.
10. A changed range cannot retain rows, errors or a viewer from the old range.
    Late responses for an earlier range cannot replace current results. Source
    writes restart the applied range at page one through the existing history
    refresh prefix.
11. Existing Owner/Council, estate, account and document permissions apply to
    every filtered page and file read, including retired assets/inactive estates.

## Data

No Prisma schema changes or dependencies. Read the existing `Asset`, `Location`,
`Estate`, `EstateUser`, `AssetEvent`, `AssetAssessment`, `AssetInspectionResult`,
`AssetLifecycleEvent`, `WorkOrder`, `WorkOrderCompletion` and `Document` models.

Add range conditions to the combined typed jOOQ projection's occurrence key:
`sort_time >= from at Singapore midnight` and
`sort_time < the day after to at Singapore midnight`. Omit absent bounds.
Apply these conditions before the cursor and `limit + 1` so the browser never
filters just the entries already loaded.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/assets/{assetId}/history` | Existing UUID paths, `cursor` and `limit`; optional `from: date` and `to: date`, ISO `YYYY-MM-DD`, inclusive Singapore calendar days | Existing 200 `AssetHistoryPageResponse`; 400 invalid dates/range/cursor; existing 401/403/404/500 errors | Existing live Owner/Council history authority; document reads retain independent checks |

Omitted bounds are unbounded; explicit empty, malformed or impossible dates are
400 errors using `EstateError { message: string }`. Responses retain private,
no-store headers and the existing response DTOs. The asset-directory endpoint
does not gain date parameters.

Version timeline cursors to include estate, asset and both applied date bounds
alongside the occurrence/kind/UUID ordering key. Reject cursor reuse with changed
bounds, including filtered/unfiltered reuse. Older timeline cursors are rejected
with the existing 400 envelope; a fresh first-page request creates a current cursor.

Example: `GET /estates/{estateId}/assets/{assetId}/history?from=2026-03-01&to=2026-03-31&limit=25`
includes occurrences from `2026-03-01T00:00:00+08:00` up to, but excluding,
`2026-04-01T00:00:00+08:00`.

## Frontend

Keep the existing folder route and add its URL search validation for `from`/`to`.
Reuse the shared shadcn-based `DatePicker` and existing Button/Card components.
Keep route-specific filter controls in `history/-components/`.

Derive query filter types from the regenerated API contract. Include normalized
bounds after `[userId, "asset-history", estateId, assetId]` in timeline query keys;
preserve the existing prefix used by mutation refresh. The Council profile frame
and timeline must observe the same applied range/query so the frame does not
start a separate unfiltered history request. Keep file queries scoped to their
document and existing authority.

## Edge cases

- Events exactly at the first midnight are included; the midnight following
  To is excluded. UTC timestamps crossing Singapore midnight use the Singapore day.
- Leap days, month/year changes, impossible dates and reversed bounds are
  validated consistently in the browser and API.
- Same-day mixed sources and UUID/type ties remain stable across multiple pages.
- Filtering preserves canonical completion dates and original document upload
  dates, even after edits or reassociation.
- A range change while Load more, Retry or a file read is pending discards old
  scope state and releases an open viewer's object URL.
- Permission revocation and account/asset changes still hide inaccessible data;
  no matching records never implies that the asset itself is missing.

## Out of scope

- Event-type or keyword timeline search, saved presets and relative date shortcuts.
- Changes to estate asset-list search, exports, document dates or chronology.
- Schema changes, new date libraries, prediction history and notification history.

## Implementation phases

1. [x] Human agrees this spec before implementation.
2. [x] Write and run failing server tests for inclusive/one-sided bounds, Singapore
   midnight, all source kinds, validation, pagination and cursor range binding.
3. [x] Implement the API/projection changes; run `pnpm api:generate` and review
   generated contract changes.
4. [x] Write and run failing web tests for Apply/Clear, invalid/empty ranges,
   URL restoration, filtered pagination/retry and stale response/viewer isolation.
5. [x] Implement route search, shared query scope and date controls; make tests pass.
6. [x] Update `.docs/api/asset-history.md`, `.docs/frontend/asset-history.md` and
   the original history spec's scope to reflect the agreed extension.
7. [x] Run type checks, tests, formatting and the web build through Nx-backed
   commands; leave changes uncommitted.

## Initial test-first baseline (2026-11-07)

The user approved the scope and requested the tests. This stage adds test files
and updates spec status; it does not implement date filtering or modify the
generated contract. Assertions exercise the existing HTTP endpoint and real
frontend route tree, so the suites compile before implementation.

| Test file | Coverage |
| --- | --- |
| `apps/server/src/test/java/com/proj/server/AssetHistoryDateFilterIntegrationTests.java` | All source kinds; Singapore midnight and microsecond boundaries; optional/same-day bounds; leap/month/year dates; invalid/empty/reversed input; filtering before pagination; deduplication and tie ordering; range-bound and legacy cursors; empty summary; canonical completion/upload dates; retired/inactive reads; live membership and estate isolation |
| `apps/web/tests/routes/_auth/estates/$estateId/assets/$assetId/_details/history/index.test.tsx` | Apply/Clear and draft fields; optional/same-day bounds; URL restoration and Back/Forward; Council frame/query scope; invalid URLs and reversed drafts; filtered empty state; pagination/Retry; stale page and file responses; viewer/object-URL cleanup; source-write refresh prefix |

Observed before implementation: **39 server cases, 37 failures, zero errors and
zero skipped** on disposable Prisma-migrated Testcontainers Postgres. The two
passing controls preserve unbounded history and existing authorization. The API
currently ignores date parameters, accepts invalid ranges and permits cursor reuse
across ranges; those are the expected failure causes.
The combined server run executed 116 cases: the 77 existing history cases and
the two new controls passed; only the 37 expected date-filter cases failed.

The web suite has **19 failing cases**, with failures for absent controls,
missing range parameters/validation and retained viewer scope. The 20 existing
history web tests still pass in the combined run. Tests use the existing date-picker
stand-ins; they do not require a calendar package or fabricated production types.

At the test-only stage, `pnpm check-types` and `pnpm fix` passed while the new
date-filter expectations were intentionally red. Those expectations were retained
during implementation; the existing error-injection stub was updated only for the
service's additional arguments, keeping its HTTP assertions unchanged.

Reproduce the combined history checks from the repository root:

```bash
MAVEN_ARGS=-o NX_DAEMON=false pnpm nx run server:test --args='-Dtest=AssetHistory*Tests' --skip-nx-cache --output-style=static
MAVEN_ARGS=-o NX_DAEMON=false pnpm nx run web:test --skip-nx-cache --output-style=static -- asset-history history-asset-list _details/history/index.test.tsx
```

Use the web path fragment above: Nx forwards task arguments through a shell, which
otherwise expands literal `$estateId`/`$assetId` segments in a full test path.

## Implementation verification (2026-11-07)

- Server validates strict dates and range ordering, applies Singapore occurrence
  bounds before pagination, and binds both dates into v2 cursors. No schema,
  source-write or dependency changes were needed.
- `pnpm api:generate` succeeded. Frontend query/filter types come from that
  generated contract.
- The History leaf validates URL dates before mounting the Council frame.
  The frame/timeline share one applied range. Apply/Clear reset the destination
  range before navigation, and date changes remount the timeline/viewer.
- All 116 history server tests and 40 history web tests pass. This includes the
  original 39 server/19 web date cases and one extra web regression: reapplying
  a range with cached tail pages must restart at page one. That test first failed
  with an older entry still visible and then passed after the cache reset fix.
- The full uncached `pnpm test` run passed: 1,745 Java tests and 1,168 web tests
  across 134 web test files, with zero failures, errors or skipped tests.
- API regeneration, type checks, formatting, production web build and
  `git diff --check` pass. Changes remain uncommitted. Manual browser/visual
  review was not performed in this implementation stage.

## Open questions

None. The user approved inclusive Singapore dates, optional bounds and explicit
Apply/Clear before the test-first stage on 2026-11-07.
