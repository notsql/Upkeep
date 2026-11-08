# Asset history timeline

**Status:** implemented — automated verification passed
**Owner:** TBD

## Problem

As a council member, I want to view an asset's continuous history and see all
associated service reports and invoices in a single timeline, so I can judge
whether to replace rather than repair the equipment and compare predictive
warnings with the work that followed.

Today, maintenance, completed work orders, condition assessments, inspections,
lifecycle changes and documents are separate views. Documents already link to
assets and work orders, but there is no combined history or document viewer.
Council members can read estate documents, but the ordinary asset profile and
asset attachment reads remain owner-only.

## Agreed scope and existing constraints

- Add a read-only **History** section to the asset profile. Keep existing
  specialist sections and workflows.
- Confirmed scope: estate Owners and current same-estate Council members can
  open the read-only asset profile, its history and linked invoices/service
  reports. Grant these reads independently of asset editing and other private
  screens; retain current document-read checks for metadata and file content.
- Council members can browse and search the estate's assets to reach a profile;
  access must not depend on having an existing asset link.
- Build the timeline from existing records on read. Do not create a second
  event store or copy documents into maintenance records.
- Documents have an upload timestamp, not a structured invoice or service date,
  amount, supplier or extracted contents. Labelled upload chronology is confirmed:
  label their events
  **Invoice uploaded** and **Service report uploaded**.
- Prediction/notification history and model-accuracy comparison are out of scope
  for this delivery. Existing stored condition assessments remain eligible as
  condition history; no new prediction events, comparison view or forecast
  snapshots are introduced. This delivery addresses the asset-history/document
  part of the original story, rather than its prediction-validation objective.

## Behaviour

1. An authorised reader can open History from an asset profile at
   `/estates/$estateId/assets/$assetId/history`. The asset reference, name,
   category, location and lifecycle status identify the equipment throughout.
2. History shows one combined timeline, newest first, containing every eligible
   record across all pages. It includes manual repairs/preventive maintenance,
   canonical completed work orders, condition assessments, inspection results,
   recorded lifecycle transitions, invoices and service reports.
3. Each entry has a text type label, meaningful title, event date and available
   summary. Invoice and service-report entries are distinct, including when
   they share a filename or timestamp. Colour and icons supplement text.
4. Ordering uses the source's event date/time, with deterministic type and UUID
   tie-breakers. Date-only records retain date-only presentation; timestamped
   records display Singapore time. A backdated repair appears at its occurrence
   date, rather than the date it was entered.
5. All non-deleted documents directly linked to the asset appear automatically.
   Also include documents linked to a same-estate work order whose asset is this
   asset. A document reachable through both links appears once by document UUID.
   Link/unlink operations do not create extra upload events.
6. Linking an older document places it at its original upload timestamp. A
   document remains eligible while either association path still connects it to
   this asset. It disappears when neither does, or when the document is deleted.
7. Selecting an invoice or service report opens a labelled document dialog with
   its filename, type, upload time and original file. PDF and image documents
   can be read in the viewer; Download remains available. Unsupported browser
   preview or a preview failure offers the existing authenticated download.
8. The file request checks current document authority on every access. A deleted,
   inaccessible or unavailable file produces a clear dialog error and Retry
   where appropriate; the timeline remains usable. Closing the dialog restores
   focus to its entry and preserves the loaded timeline and scroll position.
9. Condition entries show the stored condition, assessment date, notes and source
   label, including **Anomaly detection** for an existing system assessment.
   This is provenance for a recorded condition, not a prediction-history or
   model-accuracy comparison feature. No inference runs when history is read.
10. Completed work orders appear once using the canonical completion. Corrections
    display the current outcome and an Edited indication without moving the
    original completion in time. Inspection/work-order detail links appear only
    with independent permission to open those screens.
11. Existing recorded costs and downtime can appear with maintenance/completion
    summaries. Unknown values remain distinct from zero. Attaching an invoice
    neither records another repair nor adds its amount to maintenance costs.
12. Retired assets and inactive estates retain readable history. Missing legacy
    records are not invented: explain that history contains recorded activity.
    Asset installation information can appear in the profile summary without
    pretending it is an audited installation event.
13. Loading, no recorded history, access denied and load failure have distinct
    states. Pagination exposes all history through Load more. A page-load error
    keeps previously loaded entries and offers Retry.
14. Successful source mutations refresh the timeline through cache invalidation.
    Returning to History or refocusing the window refetches stale data. Initial
    release does not require streaming, polling or a live subscription.
15. Current Owner/Council history authority is resolved on the server, including
    membership revocation and the existing same-estate Resident override.
    Foreign-estate data remains inaccessible. History grants no asset mutation,
    document association, inspection recording or work-order management powers.
16. Account, estate and asset changes isolate cached results and viewer state.
    History-only readers never mount owner-only queries or management actions.
17. A Council member can open Assets from estate navigation, browse all the
    estate's active/retired assets, and search by asset reference or name.
    Selecting a result opens that asset's read-only profile and History.
    Search is case-insensitive, treats wildcard characters literally and is
    applied before pagination. No matches, no assets and load failure are distinct.
18. Council search and pagination preserve the query in the URL so browser Back
    restores the asset search. Council readers see no asset creation/editing or
    retirement controls. Inactive estates retain asset browsing and history reads.

## Data

Existing Prisma models involved:

| Model | Contribution |
| --- | --- |
| `Asset`, `Location`, `Estate`, `EstateUser` | Profile identity, scope and live access |
| `AssetEvent` | Manual maintenance/repairs, occurrence date, detail and costs |
| `AssetAssessment` | Human and anomaly-model condition assessments |
| `AssetInspectionResult` | Recorded inspection date, outcome and notes |
| `AssetLifecycleEvent` | Retirement, correction and restoration audit |
| `WorkOrder`, `WorkOrderCompletion` | Asset-associated canonical completed work and saved outcome |
| `Document` | File metadata, soft deletion and direct/work-order associations |

No initial schema migration or new dependency is proposed. Use existing UUID
relations, not filenames, asset names or inferred document contents. Both
association paths must remain inside the requested estate. Exclude soft-deleted
documents before pagination and deduplicate before applying a page limit.

Build a bounded, ordered projection in `apps/server` using typed jOOQ queries.
Apply the cursor to the combined result; independently paging each source and
merging the first pages in the browser would lose or misorder history. Reuse
existing outcome/cost mapping logic where appropriate. Use a consistent database
read for the sources contributing to one response. Review query plans against
realistic histories before proposing extra indexes; any needed index must go
through Prisma and the normal generation workflow.

## API

Agreed additions, now included in the generated contract:

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/asset-history` | UUID estate; optional `q: string` (trimmed, max 255), `status: ACTIVE | INACTIVE | ALL` (default ALL), opaque `cursor`, `limit: integer` (default 25, range 1–100) | 200 `AssetHistoryAssetPageResponse` | Current estate Owner or Council |
| GET | `/estates/{estateId}/assets/{assetId}/history` | UUID paths; optional opaque `cursor`; `limit: integer`, default 25, range 1–100 | 200 `AssetHistoryPageResponse` | Current estate Owner or Council; document events additionally require `VIEW_DOCUMENTS` |

`AssetHistoryAssetPageResponse` has `items: AssetHistorySummaryResponse[]` and
`nextCursor: string | null`. Search matches reference or name as a literal
case-insensitive substring; omitted/blank `q` returns all matching assets.
`INACTIVE` means retired, matching the existing asset-list filter vocabulary.
Sort by reference ascending, then UUID ascending. Bind list cursors to the
estate, normalized query and status, and reject mismatched cursors. Apply search
and status filters in the database before page limits. List reads return the
same 400/401/403/404/500 error envelope as history and private/no-store headers.
The existing owner register endpoint and its permissions remain unchanged.

`AssetHistoryPageResponse`:

- `asset: AssetHistorySummaryResponse`: `id: UUID`, `reference: string`,
  `name: string`, `category: string`, `locationPath: string`,
  `installedOn: date | null`, `retiredOn: date | null`,
  `status: ACTIVE | RETIRED`.
- `items: AssetHistoryEntryResponse[]`.
- `nextCursor: string | null`.
- `documentsVisible: boolean`: false means the viewer lacks document access,
  not that the asset has no attachments. Omit document entries in that case.

`AssetHistoryEntryResponse` has `id: string` (stable `kind:sourceId`),
`sourceId: UUID`, `kind: MAINTENANCE | WORK_ORDER_COMPLETED | CONDITION |
INSPECTION | LIFECYCLE | INVOICE | SERVICE_REPORT`, `title: string`,
`summary: string | null`, `occurredOn: date | null`,
`occurredAt: datetime | null`, `recordedAt: datetime` and a typed, kind-specific
`details` payload. Exactly one occurrence field is populated.

Define real Java record variants with an explicit OpenAPI discriminator. Reuse
the applicable fields of existing source DTOs for notes/findings, outcomes,
costs/downtime, lifecycle changes and document metadata. Condition details
include `origin: HUMAN | ANOMALY_MODEL`. Completion details include edited time
when present. Document details include the existing `DocumentResponse` metadata;
clients use `sourceId` with the content endpoint below. Link capabilities are
computed from current independent inspection/work-order permissions. Do not
expose storage keys, raw actor identity subjects or unrestricted source objects.

For ordering, map date-only values to midnight in Singapore for comparison with
timestamped values, retaining the original precision for display. Order by this
key descending, then kind and source UUID descending. Versioned cursors bind the
last complete ordering key to estate and asset; reject malformed/mismatched
cursors. Recheck permissions on every page. New/backdated records added between
pages become visible on refresh; pagination is not an immutable audit snapshot.

Errors use `EstateError { message: string }`: 400 invalid paths/cursor/limit,
401 missing identity, 403 denied authority, 404 inaccessible estate or
missing/foreign asset, 500 history read failure. Retirement/inactivity alone
does not cause 409 for this read. Use `Cache-Control: private, no-store`.

Reuse authenticated GET
`/estates/{estateId}/documents/{documentId}/content` for the original file;
preserve its current file validation, access, 404 and 503 semantics. Timeline
metadata does not depend on R2 availability. No file bytes travel in history
responses and no storage URL is exposed.

Extend `/access/context` with `canViewAssetHistory: boolean` under the confirmed
Owner/Council policy. Preserve existing `canViewAssets` semantics; do not turn
this read permission into an owner-equivalent asset capability. Add the explicit
history GET matcher to Spring Security and regenerate OpenAPI/types with
`pnpm api:generate` before implementing frontend consumers.

Example: GET `/estates/{estateId}/assets/{assetId}/history?limit=25` returns the
profile summary and up to 25 mixed events. Follow `nextCursor` to older entries.
Selecting an `INVOICE` entry requests its document UUID through the authenticated
content endpoint.

## Frontend

- Add the folder route
  `apps/web/src/routes/_auth/estates/$estateId/assets/$assetId/_details/history/index.tsx`.
  Keep History alongside the existing asset sections. Put its components in
  `history/-components/` and its hooks in `apps/web/src/lib/asset-history.ts`.
- Adjust the existing `_details/route.tsx` access branch: owners retain the
  existing frame; history-only Council readers use the history response's
  summary and a read-only profile frame. Do not fall through to the restricted
  inspection page or mount `useAsset`/owner sections for Council readers.
  Opening the asset profile root as a Council reader leads to History, where
  linked invoices and service reports can be opened under document-read access.
- Extend `apps/web/src/routes/_auth/estates/$estateId/assets/index.tsx` with a
  Council read-only asset-list branch, using the new summary-list endpoint.
  Expose Assets in estate navigation under `canViewAssetHistory`; preserve the
  existing owner and inspection-only branches. Put Council list components beside
  this route in `-components/`. Use existing shadcn Input/Table/Card/Button and
  the shared pagination/loading/error/empty components. Persist `q`, `status`
  and the current list cursor in URL search; changing search/status resets paging.
  Reuse existing search debounce conventions. Result links go to the profile,
  whose Council branch opens History.
- Build the timeline as a semantic ordered list with `time` elements, using
  existing shadcn Card/Badge/Button/Dialog and shared loading/error/empty states.
  Use accessible entry actions, a scrollable dialog, keyboard navigation and
  responsive layouts. Do not add a timeline package.
- Fetch pages with React Query and the generated client. Key prefix:
  `[userId, "asset-history", estateId, assetId]`. Throw API errors explicitly.
  Gate reads on the live capability and reset pagination on identity/scope changes.
  Council list keys use `[userId, "asset-history", estateId, "list", q, status,
  cursor]`; asset creation/edit/lifecycle changes invalidate the estate history
  prefix so list identity and status stay current.
- Invalidate the affected history after maintenance/condition/inspection writes,
  lifecycle changes, completion/correction and document upload, deletion or
  association changes. Document/work-order reassociation must refresh former
  and new asset history; invalidating the estate history prefix is acceptable.
  Restart a stale loaded history from page one to avoid retaining removed rows.
- Reuse the authenticated document binary-fetch and object-URL cleanup pattern.
  Fetch file content only when opened. Revoke object URLs on close/scope change
  and discard late responses after the viewer's document changes.

The approved [date-range extension](asset-history-date-filter.md) adds optional
From/To dates, inclusive in Singapore time, with Apply/Clear and URL restoration.
The server filters the combined projection before paging and binds both bounds
into versioned cursors. The Council frame and timeline share the selected range.

## Edge cases

- Mixed sources with equal dates, more than one page, and duplicate filenames
  retain stable identities/order. A direct and work-order link yield one entry.
- Removing one of two association paths retains the document; removing the last
  path or deleting the upload removes it after refresh. Retirement/relocation
  retains UUID-based history.
- Unknown costs, provider names and legacy fields display as unrecorded. Existing
  manual entries and work-order outcomes remain separate canonical records;
  do not deduplicate them by matching text or dates.
- A document's upload can precede or follow the work it describes. Display the
  date basis explicitly; do not claim it is the invoice issue/service date.
- Missing installation dates do not block history. Existing condition entries
  do not imply a complete record of model runs or notifications; prediction
  history and accuracy comparison are outside this delivery.
- Council search never returns another estate's assets. Empty queries, literal
  `%`/`_`, duplicate names, retired assets, inactive estates and revoked membership
  preserve the same estate-scoped read boundaries as the timeline.
- Permission loss, estate/account changes and deletion while the viewer is open
  clear inaccessible UI data and stop further reads. Every content request still
  enforces current server access.
- A database source failure fails the history request visibly; never present a
  partial result as complete. A file-storage outage affects only the viewer.
- New writes or backdated links during pagination require a fresh first page to
  see the latest complete ordering. Duplicate loads must not duplicate entries.

## Out of scope

- Automatic replace/repair recommendations, replacement workflows, model
  retraining, accuracy scores or causal claims about warnings and breakdowns.
- Prediction/notification history and model-accuracy comparison, including
  sending notifications or storing historical forecast/notification snapshots.
  Adding those would require an agreed extension and potentially a schema change.
- OCR, extracted invoice line items/totals, supplier capture, invoice/service
  dates, accounting totals or automatic cost ingestion.
- Streaming updates, timeline keyword/type filters, exports and a general
  event bus. Estate asset browsing/search is included.
- Changing document upload/association/deletion policies or granting Council
  owner-only editing, inspection-photo or work-order-detail access.

## Implementation phases

Scope is agreed and the implementation passes automated verification. Manual
browser checks remain pending. Follow `.spec/testing.md` for further
behaviour changes: observe a failing test before implementing its fix.

1. [x] Agree scope: Council browsing and profile/document reads, labelled upload
   dates, prediction exclusion, all listed event types and both document-link
   paths are confirmed.
2. [x] Add failing server HTTP tests for mixed ordering, complete pagination,
   document union/deduplication, deletion/relinking, retired/inactive reads,
   Council/Owner access and denied foreign/Resident/revoked requests. Cover
   Council asset-list browsing, literal reference/name search and pagination.
3. [x] Implement the bounded history projection, DTOs, live capability and
   explicit security matcher; make those tests pass without changing source writes.
4. [x] Run `pnpm api:generate`; review generated `packages/api/openapi.json` and
   `packages/api/src/schema.ts`. Keep generated changes with the implementation.
5. [x] Add and run failing web tests for History navigation, mixed entries,
   pagination/retry, file viewer/download, condition provenance, Council asset
   search/navigation, read-only layout and account/asset isolation.
   Use `renderWithProviders`, role/name
   queries and awaited states; test observable behaviour rather than internals.
6. [ ] Implement the route, generated-client hooks, viewer and source mutation
   invalidations. Verify keyboard/focus behaviour, long filenames, mobile and
   desktop layouts, light/dark themes and viewer/storage errors.
7. [x] Update `.docs/api/asset-history.md`, `.docs/frontend/asset-history.md` and
   `.docs/README.md`; update affected access/assets/document documentation.
   Record the agreed history access/projection choice in `.spec/decisions/`.
8. [x] Run `pnpm check-types`, `pnpm test`, `pnpm fix` and the web build through
   existing Nx-backed tasks. Inspect the final diff; leave changes uncommitted
   for the human. Install nothing.

## Initial test-first baseline

The server test stage is written and was run on 2026-11-07 against disposable,
Prisma-migrated Testcontainers Postgres. No feature implementation or generated
contract changes are included in this stage.

| Test file under `apps/server/src/test/java/com/proj/server/` | Coverage |
| --- | --- |
| `AssetHistoryIntegrationTests.java` | All seven source kinds, occurrence chronology, Singapore midnight, kind/UUID ties, complete pagination, replay/refresh, profile identity, legacy gaps, condition origin, canonical completion corrections, null/zero costs and lifecycle history |
| `AssetHistoryDocumentsIntegrationTests.java` | Direct/work-order union, deduplication before paging, identical filenames, upload chronology, unlink/relink/reassociation, deletion, authenticated content retry and live access |
| `AssetHistoryAccessIntegrationTests.java` | Owner/Council capability, denied roles, Resident override, revoked membership on subsequent pages, foreign/missing records, retired/inactive reads and unchanged private-screen/write authority |
| `AssetHistoryAssetListIntegrationTests.java` | Council browsing, reference/name search, literal SQL wildcard/escape characters, filtering before pagination, duplicate names, estate isolation, cursor bindings and input validation |
| `config/AssetHistorySecurityTests.java` | Explicit authenticated GET matchers independent of provider role; writes and unspecified paths remain denied |

`AssetHistoryTestSupport.java` seeds existing source tables inside rolled-back
test transactions and replaces file storage with a test double. It does not need
new DTOs, migrations, dependencies or external storage credentials.

Run the focused red suite from the repository root:

```bash
MAVEN_ARGS=-o pnpm nx run server:test --args='-Dtest=AssetHistory*Tests' --skip-nx-cache --output-style=static
```

Observed result before implementation: **75 tests, 62 failures, zero errors,
zero skipped**. Missing history GET matchers currently return 403; access context
also lacks `canViewAssetHistory`. The 13 passing cases protect existing
authentication and deny-by-default routing. Keep the failing expectations while
implementing phase 3.

The final formatted tests were also verified with the existing Maven wrapper,
offline, with the same result:

```bash
./mvnw -o -pl com.proj:server '-Dtest=AssetHistory*Tests' test
```

`pnpm check-types` and `pnpm fix` passed. The full `pnpm test` run executed
1,704 Java tests with only the 62 expected history failures and no execution
errors. The web suite ran 1,120 tests: 1,104 passed and 16 failed in the untouched
`manual-reading-form.test.tsx` suite. A separate web run reproduced those
failures. No application code or existing tests were changed to make checks pass.

## Implementation verification (2026-11-07)

The bounded server projection, directory, live capability/security matchers,
generated contract, folder routes, Council profile frame, document viewer and
source-mutation refresh hooks are implemented. Matching `.docs/` files and
decision 0044 describe the implementation.

- `pnpm api:generate` succeeded using the configured development services.
- `pnpm check-types`, `pnpm fix` and the production web build succeeded.
- The full uncached `pnpm test` run passed: 1,706 Java tests and 1,148 web tests
  across 133 web test files, with zero failures, errors or skipped tests.
- The focused web history suite passes 20 tests across timeline, Council directory
  and mutation invalidation. Parent access tests also cover Council navigation and
  private-screen denial. An additional regression first failed because revoking
  document access left cached invoice metadata visible; the fix hides those entries,
  closes the viewer and releases its object URL without hiding other history.
- The old asset-navigation assertion enumerated only the original six sections.
  Its expectation now includes the agreed History section.
- All 77 history server tests pass, including the original database-backed
  expectations for ordering, pagination, access, directory search and document
  associations. Docker was initially unavailable, causing 57 context-start errors;
  it became available for the full regression run, which executed these tests
  successfully on disposable Postgres. `AssetHistoryFailureTests` covers private
  source-failure errors.

Phase 6 still needs a manual browser review of keyboard
navigation, long filenames, mobile/desktop layouts and light/dark themes. No schema
change, new dependency, installation or commit was made.

## Completion regression (2026-11-07)

An actual completion request saves `WorkOrder.status = CLOSED`. The projection
incorrectly filtered on the nonexistent `COMPLETED` status, and the original
history fixture repeated that invalid value. This hid real completions while
making the seeded tests pass.

The fixture now uses the canonical status enum. New
`AssetHistoryWorkOrderIntegrationTests` create/start/complete orders through the
HTTP API and check Owner/Manager completion, Owner/Council history, replay,
correction, date filtering, asset-free orders and rejected completion. Before the
fix, five cases ran with three expected missing-entry failures and no execution
errors. The projection now filters on `WorkOrderStatus.CLOSED`, preserving the
existing response contract and canonical completion identity/time.
After the fix, all 121 history server tests pass, including all five real-workflow
regressions. The full uncached suite passes 1,750 Java and 1,168 web tests across
134 web test files, with zero failures/errors/skips. Type checks, formatting and
`git diff --check` pass. No controller, generated contract, database shape or
frontend behavior change was required. Changes remain uncommitted.

## Confirmed decisions

- **Council access:** the user confirmed that this plan includes Council access
  to asset profiles and linked documents. Implement the read-only profile,
  history and invoice/service-report viewer for current same-estate Council
  members, with live server authorization. Asset editing and document management
  retain their existing policies. Access grants for additional roles are outside
  this agreed scope.
- **Asset discovery:** Council can browse/search the estate's assets; include a
  read-only Assets list and navigation entry, not just direct profile links.
- **Document chronology:** use upload timestamps with explicit upload labels.
  Capturing invoice issue/service dates is not needed for this delivery.
- **Prediction evidence:** prediction/notification history and model-accuracy
  comparison are out of scope. Existing stored condition records may still
  appear as condition entries without adding a prediction comparison feature.

- **History coverage:** the user approved all recommended event types below and
  both document-link paths. Include files attached directly to the asset or to
  a work order for that asset; show a file once when both paths apply.

| Record type | Example entry |
| --- | --- |
| Lifecycle | Asset retired, retirement corrected, or asset restored |
| Manual maintenance | Pump repaired or preventive servicing recorded |
| Completed work order | Contractor's completed job and saved outcome |
| Condition assessment | Condition recorded as Needs attention or Faulty |
| Inspection | Recorded inspection pass/fail result |
| Invoice/service report | Uploaded document linked to the asset |

## Open questions

None remaining for the agreed scope.
