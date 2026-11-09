# Import historical readings from CSV

**Status:** implemented; automated verification complete, browser/vendor acceptance pending
**Owner:** to be assigned

## Problem

An admin cannot populate an estate with historical measurements. Until enough
live data arrives, the reading browser and exported datasets contain little
useful history. Vendor extracts also differ in their headers, and one bad row
must not force the admin to repair and resubmit the whole file.

User story: as an admin, upload past readings, receive a per-row error report,
and trace or revert a bad vendor batch.

## Agreed choices

- **Agreed:** admin means the estate Owner or Manager, using the existing
  `EstatePermissions.Authority.manager()` policy. Crew's permission to record
  manual readings does not automatically grant bulk import or rollback.
- **Agreed:** out-of-range values import with warnings, consistent with existing
  ingestion and decisions 0028 and 0041. Invalid numeric representations still
  reject the row.
- **Agreed:** imported measurement identity is asset, metric and timestamp,
  scoped to the estate. There is no additional vendor or device channel key.
- **Agreed:** no import or rollback actions may occur on a deactivated estate.
  Enforce this in the UI and on the server, including retry requests.
- **Agreed:** imports populate historical browsing and exports only. Import and
  rollback do not trigger anomaly checks, condition assessments or failure-risk
  updates.
- **Agreed:** start with limits of 25 MiB and 100,000 data records per file,
  offset-aware ISO-8601 timestamps, and the one-metric month acceptance workload.
  Check a representative vendor file before release.
- **Agreed:** block imports into retired assets, matching manual entry. Report
  those rows as `ASSET_RETIRED` while importing valid rows for active assets.
  An Owner may restore an asset before importing, using the existing lifecycle.
- **Agreed:** retain batch metadata and row reports indefinitely, including
  after rollback. Keep source label, uploader, file hash, mapping, outcomes and
  rollback details. Do not permanently store the original CSV.

## Accepted implementation choices

Accepted through the user's request to implement the test-first contracts on
2026-11-06. See [decision 0044](../decisions/0044-imported-reading-batches.md).

- Store imported measurements separately, with `source: IMPORT`. Do not create
  fake devices or attribute vendor measurements to a manual recorder.
- Reuse the eight `DeviceMetric` codes, units and ranges.
- Configure header mapping for each upload. Saving reusable vendor profiles is
  deferred; it is not needed to support different vendor column formats.
- Start with a bounded, synchronous upload and one atomic database commit for
  accepted rows and their report, within the agreed limits. Do not add a queue
  or worker yet.

## Behaviour

### Upload and column mapping

- An authorized admin opens **Import CSV** from the estate Readings page,
  chooses a CSV and supplies a required source label, such as
  `Vendor A — October 2026 extract`.
- The first screen displays headers and a small parsed sample. The admin maps
  CSV columns to `asset_id` or `asset_reference`, `metric`, `measured_at` and
  `value`. These four measurement fields are required; exactly one asset lookup
  mode is selected. `unit` and the export's identity/provenance fields are
  optional. A source column can supply only one mapped field.
- Exact export headers map automatically. A complete file produced by the
  existing export endpoint can be uploaded without changing its columns.
  Its extra metadata columns are accepted without becoming trusted identities
  or authority to change assets, device assignments or recorder attribution.
- CSV uses UTF-8, with or without a leading BOM, a header and comma delimiter.
  Support quoted commas, escaped quotes, embedded newlines and LF/CRLF endings
  through the existing Apache Commons CSV dependency. Do not split on commas.
- For the export preset, reverse the documented spreadsheet escaping only in
  its escaped text columns. Do not strip an apostrophe from arbitrary vendor
  text. Vendor mappings preserve reference text exactly.
- Missing/duplicate headers, absent required mappings and duplicate mapping
  assignments produce actionable file errors before import. Header-only files
  are rejected as empty. Entirely blank records are ignored and do not affect
  totals or record numbering; records with some missing values are validated.
- Submit includes the file, mapping, source label and a client-generated
  submission UUID. Pending feedback prevents repeat clicks. The server remains
  authoritative for parsing, limits, authorization and row validation.

### Row validation and report

- Resolve an asset only within the selected estate, by UUID or its estate-unique
  reference. Missing and foreign assets share `ASSET_NOT_FOUND`; do not disclose
  another estate's asset labels. A deactivated estate rejects all import and
  rollback actions. A retired asset within an active estate rejects the row
  with `ASSET_RETIRED`, including when the measurement predates retirement;
  valid rows for active assets still import. An Owner may restore the asset
  before submitting a new import.
- `metric` must exactly match a current catalogue code. Assets need no device
  or registered device metric to receive imported history. If supplied, `unit`
  must match the metric's fixed unit; otherwise derive it from the catalogue.
- `measured_at` must be an ISO-8601 date-time with an explicit UTC offset or
  `Z`. Normalize to UTC and truncate to microseconds before deduplication.
  Accept old/out-of-order observations with no month-long waiting period.
  Reject impossible dates and times more than five minutes ahead of the
  server's batch validation time. Do not guess a timezone or ambiguous date.
- Parse `value` directly as a decimal, never through JavaScript Number or Java
  double. Accept finite decimal notation representable in `numeric(18,6)`,
  including equivalent trailing zeroes; reject missing/non-numeric values,
  overflow and more than six meaningful fractional places. Preserve exact
  stored decimal text in responses and export.
- Validate the value against the metric's inclusive minimum and maximum.
  Values outside those bounds import with an
  `OUT_OF_RANGE` warning and appear with the existing suspect flag. Structural
  numeric errors always reject the row.
- Collect every independently checkable error for a row. Skip dependent checks
  when a prerequisite is invalid: an unknown metric cannot produce a meaningful
  range or unit check.
- A completed batch reports `totalRows`, `importedRows`, `duplicateRows`,
  `invalidRows` and `warningRows`. Every nonblank data record has exactly one
  outcome: `IMPORTED`, `DUPLICATE` or `INVALID`. The first three outcome counts
  sum to `totalRows`; warning count is additional and may overlap imported rows.
- Each outcome includes the CSV record number, starting with header record 1,
  its starting physical line number, outcome, optional reading ID, and issues
  with field, stable code and readable reason. A multiline quoted record has
  one record number. Issues are shown in a paginated table and downloadable CSV.
- Example: record 2 imports, record 3 has `ASSET_NOT_FOUND`, record 4 has
  `INVALID_TIMESTAMP`, and record 5 is a duplicate. The batch returns counts
  4/1/1/2 for total/imported/duplicate/invalid, with the valid row committed.
- If CSV quoting/encoding is malformed and record boundaries cannot be trusted,
  reject the whole file and import nothing. Row-level data errors do not have
  this effect. Exceeding any file, row or field limit also imports nothing.

### Deduplication and retries

- Imported measurement identity is `(estateId, assetId, metric, measuredAt)` at
  normalized storage precision, enforced by a database unique constraint.
  It does not depend on filename, source label, mapping order, CSV row order,
  batch ID or textual decimal/offset representation.
- An existing imported key with the same exact decimal value is `DUPLICATE`.
  A different value is `INVALID` with `READING_CONFLICT`; never overwrite it.
  Apply the same rule to repeated rows within a file, processing in record order.
- Multiple vendor observations for the same asset/metric/instant use the same
  agreed key: equal values are duplicates and differing values are conflicts,
  regardless of vendor or device labels. Do not impose this uniqueness rule on
  existing sensor or manual tables.
- With the export preset, use `(source, reading_id)` to recognize an existing
  same-estate measurement only after verifying its asset, metric, time and value.
  An unchanged exported row is a duplicate even if its original source was
  SENSOR or MANUAL; a mismatching existing ID is a row conflict. Unknown IDs are
  untrusted provenance hints, not IDs for new rows. Rows from another estate
  still fail asset validation. Fresh vendor rows use the imported identity above.
- A file SHA-256 is audit metadata, not the only deduplication mechanism.
  Re-uploading the same file under a new submission UUID creates a report batch
  with duplicates and no new measurements. Overlapping files also deduplicate.
- Reuse a submission UUID after an uncertain network result. Identical file
  bytes, source label and normalized mapping return the existing batch; changed
  input under that UUID returns 409. Concurrent requests are protected by
  database constraints and transactional conflict handling.
- Validation errors allow partial acceptance; infrastructure/database failures
  commit neither readings nor a completed batch. A committed batch is retrievable
  after a lost response. Retrying does not depend on the browser staying open.

### Batch provenance and rollback

- Persist the source label, original filename, file hash/size, mapping and
  parser version, authenticated uploader ID/name snapshot, creation time,
  counts and row outcomes. Retain batch metadata and row reports indefinitely,
  including after rollback, with no automatic expiration or audit deletion in
  this feature. Do not retain a permanent uploaded file; keep its hash instead.
- Every inserted reading belongs to exactly one batch. A duplicate row links to
  its existing measurement but never transfers that measurement's ownership.
  A source label or uploader supplied inside CSV cannot replace server-derived
  batch attribution. Preserve exported origin metadata as untrusted context.
- Authorized admins can list batches, inspect their reports and request a
  rollback with a required reason. The confirmation shows the source label and
  the number of readings actually inserted by that batch.
- Rollback atomically deletes only that batch's imported measurements. Retain
  the batch, normalized row audit values, original outcomes, rollback actor,
  timestamp, reason and removed count. Never delete pre-existing duplicates,
  sensor/manual readings or measurements owned by another batch.
- On an active estate, rollback is idempotent. A repeated request returns the
  recorded result.
  Serialize imports and rollbacks within an estate using the existing estate
  write-lock convention; check current authority and lifecycle under the lock.
  A deactivated estate returns 409 for import and rollback, including retries,
  before any action. The UI disables both actions with an inactive-estate
  explanation. Deactivation racing with a write is serialized by the estate
  lock; no write may proceed if deactivation took effect first.
- Reusing the original upload UUID after rollback returns the reverted batch
  and does not restore rows. A deliberate new upload with a new UUID may import
  those measurements again. Reverting a zero-insert batch removes zero rows.

### Reading consumers

- Estate and legacy asset reading lists, counts, filters, pagination, mobile
  cards and CSV export include imported rows before filtering and paging.
  Add `IMPORT` to the source enum and show the source label and batch reference.
  Keep import reports and uploader details restricted to admin batch endpoints.
- Preserve the export's existing column layout. Imported rows use `source=IMPORT`,
  their own reading UUID and import time in `recorded_at`; device and manual
  recorder columns remain empty. Batch provenance is available through the
  reading DTO's batch ID and admin batch detail. Document the additive source
  value explicitly for CSV consumers; do not silently change the header.
- Duplicate-timestamp flags consider all three sources. Imported rows do not
  fill sensor GAPs, update device last-seen, or act as live flatline evidence.
  Rollback removes them from subsequent reading queries and exports; flags are
  recalculated by the existing query semantics.
- Historical browsing and export are immediately useful after import. The
  current anomaly endpoint scores readings supplied in its request; it does
  not load stored reading history. Import and rollback do not invoke that
  endpoint, create condition assessments or recompute failure risk. No derived
  model results are created by a batch or need undoing when it is reverted.

## Data

Prisma owns all additions in `packages/db/prisma/schema/schema.prisma`.

| Model | Proposed fields and constraints |
| --- | --- |
| `ReadingImportBatch` (new) | UUID `id`, `estateId`; uploader subject/name snapshot; `submissionId`; source label; original filename; SHA-256; byte size; normalized mapping JSON; parser version; creation time; report counts; `COMPLETED`/`REVERTED` status; nullable rollback actor/time/reason and removed count. Unique `(estateId, uploaderUserId, submissionId)` and `(id, estateId)`; estate/history index. |
| `ImportedReading` (new) | UUID `id`, `estateId`, `assetId`, `batchId`; catalogue `metric`; decimal(18,6) `value`; microsecond `measuredAt` and `recordedAt`. Composite same-estate asset/batch foreign keys, restrictive delete/update; unique imported measurement key above and asset/metric/time index. No device required. |
| `ReadingImportRow` (new) | Batch ID and record number as key; starting line; outcome; bounded normalized measurement fields; optional reading ID/source; optional untrusted origin metadata; typed issues stored as JSON. Retained after rollback; references to removed readings are audit values rather than restrictive reading FKs. |
| `Estate`, `Asset` | Add appropriate inverse relations; measurement/lifecycle fields unchanged. |
| `DeviceReading`, `ManualReading`, `Device` | Existing shape and uniqueness unchanged. |

Use typed jOOQ repositories. Add an architecture decision for separate imported
storage, deduplication, range policy and rollback once reviewed. Migrations must
be additive and compatible with the currently deployed server. Generate Prisma
migrations and jOOQ sources; never edit generated classes by hand.

## API

Proposed contract; all request/response DTOs are Java records documented in
OpenAPI and generated into `packages/api`, not handwritten frontend types.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/estates/{estateId}/readings/imports` | Multipart `file` plus JSON `options`: submission UUID, source label, preset, column mapping and asset lookup mode | 201 `ReadingImportBatchResponse`; 200 identical submission retry | Estate Owner/Manager; active estate, including retries |
| GET | `/estates/{estateId}/readings/imports` | Zero-based `page`, bounded `size` | 200 paginated batch summaries, newest first | Estate Owner/Manager |
| GET | `/estates/{estateId}/readings/imports/{batchId}` | None | 200 batch metadata, counts and rollback audit | Estate Owner/Manager |
| GET | `/estates/{estateId}/readings/imports/{batchId}/rows` | `page`, `size`, optional outcome filter | 200 paginated typed row results | Estate Owner/Manager |
| GET | `/estates/{estateId}/readings/imports/{batchId}/report` | None | 200 attachment CSV: record/line, outcome, field, code, reason; one line per issue, or one line for an outcome without issues | Estate Owner/Manager |
| POST | `/estates/{estateId}/readings/imports/{batchId}/revert` | JSON `reason: string` | 200 rollback result, including repeated requests | Estate Owner/Manager; active estate, including retries |
| GET | `/access/context` | Existing | Add `canImportReadings` and `canRevertReadingImports` capabilities | Existing signed-in policy |

Extend existing reading DTOs with optional import batch ID/source label and
`ReadingSource.IMPORT`; retain exact `valueText`. Existing GET authorization
does not change. Reuse `/readings/metrics` for units/ranges.

Whole-request errors use `EstateError`: 400 malformed file/options, 401 signed
out, 403 insufficient role, 404 missing/foreign estate or batch, 409 lifecycle or
submission conflict, 413 file/record/field limits, 415 unsupported content or
encoding, and 503 bounded import capacity busy. A well-formed all-invalid file
still returns a completed 201 batch with zero inserts and a full report.
Reports use `private, no-store` and spreadsheet-safe text escaping.

## Frontend

### Agreed batch-page refactor (2026-11-07)

The user approved extracting the existing batch screen into five files within
`$batchId/-components/`: `reading-import-batch-page.tsx` for page composition,
`use-reading-import-batch-state.ts` for the existing coordinated state and
request lifecycle, and `import-batch-metadata.tsx`, `import-batch-results.tsx`
and `import-batch-rollback.tsx` for the existing sections. Keep
`import-row-results.tsx` as the responsive row renderer. Sections receive only
their required data and callbacks through explicit props, using generated API
types. Preserve all current behavior, including permissions, filtering,
pagination, download, rollback, cancellation and scope resets. Verify the
existing behavior tests before and after extraction and update the frontend
documentation. No API, database, dependency or routing changes are needed.

### Screen conventions

- Add folder-based routes under
  `apps/web/src/routes/_auth/estates/$estateId/readings/imports/`:
  `index.tsx` for upload/history and `$batchId/index.tsx` for result/rollback.
  Put screen-only components beside each route in `-components/`.
- Follow the existing [dashboard design conventions](../../.docs/frontend/design-system.md)
  and [Readings screen conventions](../../.docs/frontend/readings.md). Use the
  installed shadcn preset, semantic light/dark tokens and Tailwind utilities.
  Keep existing component sizes, typography, spacing and radii; introduce no
  custom CSS, colour tokens or global style overrides.
- Reuse `PageLayout` with the Readings screen's `min-w-0 space-y-6` and
  long-text wrapping. Render one page header: `FormPageHeader` for Import CSV,
  with `Readings › Import CSV` breadcrumbs, and `DetailPageHeader` for a batch,
  with linked parent crumbs, status Badge and muted metadata. Extend the typed
  breadcrumb route union for the import parent. Keep form/detail headers free
  of icons and repeated estate names, following the existing variants.
- Add the outline **Import CSV** link with a leading Upload icon through the
  existing Readings `ListPageHeader.actions` slot, between Filters and Create.
  Preserve the existing Create action and the export control below the header.
- Match manual entry's `Card className="max-w-3xl"` > `CardContent` form,
  labelled shadcn Input/Field/Select controls and `space-y-5`/`space-y-6`
  grouping. Select triggers use `w-full`; validation connects to fields with
  `aria-invalid`/`aria-describedby`. Reuse `FormActions` for the Import/Cancel
  footer, including its pending disabling. Use `SectionCard` for batch history,
  metadata and row results, rather than decorating each field with a card.
- Use shared `LoadingState`, `ErrorState` with Retry, and `EmptyState` for
  query-driven regions; show mapping preview, completed counts, row issues and
  all-invalid results in the normal content flow. Use existing stock Badge
  variants with visible outcome text, labelled Alerts for validation feedback
  and Sonner for successful actions. Colour alone must not convey an outcome.
- Batch and report lists use semantic shadcn Tables at widths >=768px and
  labelled Card records below, selected through the existing `use-mobile` hook.
  Preserve every row number, reason and action in both presentations; resize
  retains mapping, filters and page without another query. Wide desktop tables
  have a named, keyboard-reachable overflow region. Long filenames/source
  labels/reasons wrap; controls and pagination stay within the viewport.
- Reuse shared `Pagination` for batch/report pages. Any report outcome filter
  uses `FilterBar`, `useFilterPanel` and `FilterToggle` with the existing active
  count/Clear filters behaviour. Use `ConfirmDialog` for rollback, with the
  source label, inserted-row count, required reason Field, destructive confirm
  button and the shared pending/error/focus behaviour.
- Keep the selected file/mapping on recoverable failures. File preview is local
  and bounded; it is not authoritative validation. Abort stale browser requests
  on estate/account changes and hide old results; aborting a request does not
  promise to undo a server commit. Batch history resolves uncertain outcomes.
- Put generated-client query/mutation hooks in `lib/reading-imports.ts`, using
  keys beginning `[userId, "reading-imports", estateId, ...]`. Throw returned
  API errors explicitly. Gate routes/actions with server-projected capabilities.
- After import or rollback, invalidate batch list/detail/rows, estate readings,
  affected legacy asset-reading queries and reading asset options. Leave
  existing reading filters intact; a backdated insert may not appear on page 1.

## Edge cases and runtime limits

- Cross-estate batch IDs, forged origin IDs, stale permissions and concurrent
  asset retirement cannot bypass server checks. Recheck asset lifecycle under
  the write locks; rows targeting retired assets receive `ASSET_RETIRED`.
- Offset-equivalent timestamps, sub-microsecond truncation, decimal trailing
  zeroes, repeated files and simultaneous overlapping files cannot add duplicate
  imported measurements. Conflicting values preserve the original reading.
- Test original-export round trips, including out-of-range rows, source variants,
  spreadsheet-escaped references, quoted newlines, Unicode units and no device.
- Bound field lengths, parsed sample size, retained issue values, report page
  size and concurrent work. Do not load an unbounded dataset or log complete CSV
  contents. Use bounded parsing and bulk inserts within the file limits.
- Current multipart limits are 5 MB/file and 17 MB/request, shared with document
  uploads. Any raised transport ceiling must preserve existing document-specific
  limits and pass their regressions; also check Cloud Run's upload boundary and
  Tomcat drain limits. Do not reuse export limits as proof uploads will work.
- Benchmark at least 43,200 records, representing 30 days at one reading/minute,
  plus a maximum-admitted file, mixed invalid/duplicate rows and rollback. Target
  a warm request below 120 seconds and every configured deadline. Check transaction
  duration, memory, connection cleanup, estate-lock contention and report size.
  Timing is an opt-in workload check, not a flaky normal-CI assertion.
- If the agreed month-sized workload cannot meet deployment limits, return to
  review for a durable-job design or revised limits; do not silently truncate.

## Implementation phases

Every behaviour change starts with a failing test that is run and observed
before implementation, following `.spec/testing.md`.

1. [x] Agree the open questions and this spec; record the architectural choices.
2. [x] Write parser/normalization/report tests for export compatibility, vendor
   mappings, line numbers, all validation branches and malformed whole files.
3. [x] Add Prisma models/migration; regenerate jOOQ. Write transactional tests
   for partial acceptance, exact values, unique constraints, concurrent retries,
   provenance retention, cross-estate access, rollback ownership/retries and
   deactivated-estate rejection, including a race with estate deactivation.
   Cover mixed active/retired assets, retirement racing with import, and batch
   metadata/row reports remaining readable and intact after rollback.
4. [x] Add thin import/report/rollback controllers and permission projections.
   Test real HTTP multipart/error contracts, lost-response recovery and limits.
   Run `pnpm api:generate` and consume the generated frontend contract.
5. [x] Extend unified reading queries, flags, DTOs and CSV sources. Add regression
   tests for list/count/filter/page correctness, export round trips, sensor
   monitoring isolation and removal after rollback. Verify that import and
   rollback leave condition assessments and failure-risk inputs unchanged.
6. [x] Write failing web tests, then build upload/mapping/history/report/rollback
   screens and typed hooks using the shared design-system components above.
   Cover access, uncertain retries, context changes, retained input, accessible
   issue rendering, dialog pending behaviour and cache refresh.
7. [ ] Run the month-sized workload and desktop/mobile acceptance flow. Review
   against the existing Readings/manual-entry screens in both themes at 360,
   768 and 1280–1440 px and 200% zoom; check long text, keyboard navigation,
   dialog focus restoration and mobile cards with complete issue details. Complete
   `pnpm check-types`, `pnpm test` and `pnpm fix` through existing Nx scripts;
   verify production web build when route/contract generation requires it.
   Check a representative vendor file against the agreed limits and timestamp
   requirements; report any unsupported format before expanding scope.
8. [x] Update `.docs/api/readings.md`, `.docs/frontend/readings.md` and their
   `.docs/README.md` index entries with the built contract and flows. Update
   `.spec/README.md` status and present the uncommitted change for human review.

No packages were installed: Commons CSV and the existing UI/testing tools were
reused. Implementation includes the Prisma migration, regenerated jOOQ and API
contract, and the web screens. Deployment and commits remain human steps.

## Out of scope

- XLSX, compressed files, alternate delimiters, custom date patterns, timezone
  guessing, metric-name translation, unit conversion or wide-to-long reshaping.
- Reusable saved mapping profiles, scheduled vendor connectors or unlimited
  imports/background processing without a demonstrated need.
- Creating assets/devices/metrics from CSV, editing existing readings, silent
  corrections, or reverting rows that predate a batch.
- Automatic anomaly checks, condition assessments, failure-risk updates and
  model retraining. Historical imports do not count as live device availability.

## Acceptance coverage

| Requested criterion | Planned evidence |
| --- | --- |
| Same columns as export | Export-preset parser and real mixed-source export/import round-trip tests |
| Asset, metric, timestamp and range validation | Boundary/unit tests and mixed-validity database-backed HTTP tests |
| Row numbers/reasons; valid rows still import | Multiline record numbering, persisted report and partial-acceptance tests |
| Re-import creates no duplicates | Same/overlapping/reordered files, exact decimal/UTC normalization and concurrent uniqueness tests |
| Source per batch; trace and revert | Persisted metadata/history tests and rollback proving duplicate/other-source rows survive |
| Configurable column mapping | Two differently headed vendor files yield equivalent normalized measurements; mapping failures preserve input |

## Open questions

None outstanding for the implemented product policies. Browser acceptance and
a representative vendor-file review remain release checks.

## Test-first coverage

The initial test-only phase is complete. The user subsequently authorized
implementation based on these tests on 2026-11-06. Preserve their assertions
while implementing the approved feature; deployment and commits remain human steps.

| Suite | Coverage |
| --- | --- |
| `apps/server/src/test/java/com/proj/server/reading/ReadingImportParserTests.java` | Header/data field limits, including unused fields and entirely blank records that exceed field/column limits |
| `apps/server/src/test/java/com/proj/server/ReadingImportValidationIntegrationTests.java` | Historical imports without devices, all eight metrics, exact decimals, ranges, timestamps, partial acceptance, estate/asset validation, vendor mapping, UTF-8/BOM, quoting, multiline/blank record numbering, malformed files/options and record limits |
| `apps/server/src/test/java/com/proj/server/ReadingImportBatchIntegrationTests.java` | Measurement identity, conflicts, overlapping files, uploader-scoped submission retries, audit/history/reports, rollback ownership/idempotency, preserved outcomes, reading filters/paging/export round trips and isolation from live monitoring/assessments/failure risk |
| `apps/server/src/test/java/com/proj/server/ReadingImportAuthorizationIntegrationTests.java` | Owner/Manager policy, denied roles, authentication, foreign estates/batches, capabilities, permission revocation and deactivated-estate import/rollback retries |
| `apps/server/src/test/java/com/proj/server/ReadingImportConcurrencyIntegrationTests.java` | Concurrent submissions/overlaps/conflicts, estate-lock lifecycle/authority races, rollback versus deactivation, and atomic recovery after report persistence failure |
| `apps/server/src/test/java/com/proj/server/ReadingImportMultipartIntegrationTests.java` | Actual Tomcat HTTP uploads beyond the old document ceiling, the exact 25 MiB boundary, oversized files and unsupported spreadsheets |
| `apps/server/src/test/java/com/proj/server/ReadingImportBenchmark.java` | Opt-in 43,200/100,000-record HTTP workloads with mixed outcomes, report retention and rollback; 120-second assertions stay outside normal test discovery |
| `apps/web/tests/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/estate-readings-page.import.test.tsx` | Existing Readings entry point/capabilities, inactive-estate explanation and desktop/mobile import provenance |
| `apps/web/tests/routes/_auth/estates/$estateId/readings/imports/index.test.tsx` | Planned upload and batch screens: labelled controls, export/vendor mapping, multipart transport, validation/pending state, uncertain retries, retained input, estate/account cancellation, reading-cache invalidation, reports and rollback |
| `apps/web/tests/lib/reading-import-preview.test.ts` | Exact decimal text and a final unquoted/quoted empty column without a trailing newline |

Backend tests use public HTTP contracts and disposable, Prisma-migrated Postgres,
without importing nonexistent production DTOs or generated import tables. The
screen tests load the components inside each test, so the initial absent screens
produced individual failures without breaking TypeScript compilation. The built
screens now exercise these assertions through the generated client.

The plan did not specify exact wire enum spellings, audit DTO field names or
screen component exports. Test fixtures established `preset: VENDOR | EXPORT`,
`assetLookupMode: asset_id | asset_reference`, a `mapping` object from canonical
field to CSV header, `importBatchId`/`sourceLabel` on reading responses, and the
audit/report field names used in the tests. The implemented page exports are
`ReadingImportsPage({ estateId })` and
`ReadingImportBatchPage({ estateId, batchId })` at the folder-based paths in the
web suite. The implemented backend contract is now published in the generated
OpenAPI document; frontend hooks derive their types from it.

The implemented limits are 25 MiB, 100,000 records, 128 columns, 4,096 characters
per field, report pages of at most 200, and two concurrent processing slots.
Parser unit regressions cover oversized mapped/unmapped fields and blank-record
limit bypasses. The preview regressions cover a final empty column without a
trailing newline, preserving exact decimal strings. Existing document multipart
limit regressions remain in the full server suite.

The opt-in workload passed after implementation: both 43,200 and 100,000 mixed
records imported and rolled back within their individual 120-second assertions,
with reports retained, alongside the four inherited real-HTTP multipart cases.
This is local test evidence; it does not establish deployed memory usage or
network timing. Busy-capacity/resource-cleanup measurements, report escaping
coverage and the physical/browser/vendor-file acceptance review remain pending.

### Running the tests

```bash
# Focused backend contracts (Docker and a cached postgres:18-alpine image required).
./mvnw -o -pl com.proj:server '-Dtest=ReadingImport*IntegrationTests' test

# Opt-in workload plus inherited HTTP multipart boundary cases.
./mvnw -o -pl com.proj:server -Dtest=ReadingImportBenchmark test

# Both new web test files, through Nx.
pnpm nx run web:test --skip-nx-cache -- 'readings/imports/index.test.tsx' 'estate-readings-page.import.test.tsx'
```

The installed Nx Maven batch runner ignored both attempted test-filter forms
and ran the whole server suite. The focused backend commands therefore use the
repository wrapper directly and explicitly stay offline.

Observed red phase on 2026-11-06: **105 backend cases** including the opt-in
workload (104 expected failures, one existing authentication behaviour passing,
zero errors/skips); **27 new web cases** (26 expected failures, one existing
permission behaviour passing). Backend requests encountered the security
fallback or missing handlers. Upload/report screen cases stopped at their absent
modules; the existing Readings-page cases reached missing-action/provenance
assertions. These failures establish the original starting point, not completed acceptance.

The full web run passed all 130 existing test files before the last five new
import cases were added; the final focused run includes those additions.
Workspace type checks and web lint passed. The configured Spotless 3.11.0 could
not run offline because some dependencies were not cached. No packages were
downloaded: cached Spotless 3.4.0 formatted and checked only the seven
`ReadingImport*.java` test files using its `spotlessFiles` regex filter.

### Implementation verification — 2026-11-06

- Full regression results: 1,733 server tests and 1,151 web tests pass. The
  additional parser/preview regressions were first observed failing before
  their fixes; the original import-contract assertions were preserved.
- `pnpm check-types`, web lint and the production web build pass. API export
  and type generation succeeded during implementation; the Prisma migration
  and regenerated jOOQ sources are included in the uncommitted change.
- `pnpm fix` ran successfully for the TypeScript projects. Its server target
  cannot resolve the configured Spotless 3.11.0 dependencies offline. Cached
  Spotless 3.4.0 formatted the feature's Java changes; the parser continuation
  was formatted and checked with that cached version. Biome also reports its
  existing generated-schema type-inference limit as a warning.
- An uncapped combined rerun lost its test JVM to an operating-system memory
  kill (exit 137) after 1,515 passing tests. The recovered server run passed all
  1,733 cases with a 1 GiB heap and eight cached Spring test contexts. The POM
  hardcodes Surefire's `argLine`, so passing `-DargLine=...` did not apply those
  JVM options. The successful Nx invocation inherits them instead:

  ```bash
  JAVA_TOOL_OPTIONS='-Xmx1024m -Dspring.test.context.cache.maxSize=8 -Ddebug=false -Dlogging.level.root=WARN -Dlogging.level.org.jooq=WARN -Dlogging.level.org.springframework=WARN -Dlogging.level.com.proj.server=WARN' MAVEN_ARGS=-o pnpm test --output-style=static
  ```

The 43,200/100,000-record benchmark passed separately after implementation.
Phase 7 remains open for the browser/theme/zoom/keyboard review, representative
vendor file, deployed resource measurements and the follow-up coverage listed
above. No dependency installation, deployment or Git commit was performed.
