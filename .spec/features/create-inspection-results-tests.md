# Create inspection results: test-first history and implementation verification

The user authorised writing tests from
[the feature plan](create-inspection-results.md), then implementation, on
2026-10-26. The original red-stage results are preserved below. The implementation
now includes the additive schema, server endpoints, generated contracts, limited
asset/estate views, inspection screens and linked work-order conversion.

## Coverage

All Java paths below are under `apps/server/src/test/java/com/proj/server/`.

| Plan behaviour | Tests |
| --- | --- |
| 1–3: estate-local authority, Resident override, independent ownership, authenticated inspector and association integrity | `InspectionResultsIntegrationTests`; `config/InspectionSecurityTests` |
| 4–6: required outcome/date/location, Singapore calendar dates, installation boundary, trimmed notes, recorded metadata and moved-asset conflicts | `InspectionResultsIntegrationTests`; web `inspection-results.test.tsx` |
| 5–6, 17: private photos, content/size/dimension limits, role revocation and complete photo relationship checks | `InspectionPhotosIntegrationTests` |
| 7–9, 11: standalone Pass/Fail persistence, no automatic work order, cancellation/refresh, and the same role-specific handoff | `InspectionResultsIntegrationTests`; `InspectionWorkOrdersIntegrationTests`; web `inspection-results.test.tsx` |
| 10, 12: source/asset integrity, observed current location, one linked order, duplicate and concurrent conversion | `InspectionWorkOrdersIntegrationTests` |
| 13–14: stable historical Fail after completion and continued manual inspection sources | `InspectionWorkOrdersIntegrationTests`; `InspectionCrewAccessIntegrationTests`; existing `WorkOrdersIntegrationTests` |
| 15–16: canonical history reads, empty results, duplicate dates, deterministic pagination and scoped cursors, without maintenance/condition/lifecycle writes | `InspectionResultsIntegrationTests` |
| 17–18: evidence stays private, survives retirement, and has no update/delete API or saved-record controls | `InspectionPhotosIntegrationTests`; `config/InspectionSecurityTests`; web `inspection-results.test.tsx` |
| Read-only Crew estate access, denied direct mutations, limited asset picker and independent work-order progress permissions | `InspectionCrewAccessIntegrationTests`; existing `WorkOrdersIntegrationTests`; web estate-detail, work-order-list and route-guard tests |
| Queued writes and state changes during uploads | `InspectionConcurrencyIntegrationTests`; `InspectionPhotosIntegrationTests` |
| Upload failure, failed persistence, compensating cleanup and cleanup failure | `InspectionPhotosIntegrationTests` |
| Frontend save errors, retained inputs, duplicate-click prevention, ambiguous-response handling, revoked access and scoped cache invalidation | web `inspection-results.test.tsx`; `tests/lib/work-orders.test.tsx` |
| 19–25: asset history table on Owner/Manager/Crew views, canonical rows, inspector fallback, follow-up authority, cursor navigation, loading/empty/error/revoked states, save/link refresh and accessible scroll region | web `tests/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table.test.tsx` (26 passing tests after the documented red stage) |

The web acceptance tests are in
`apps/web/tests/routes/_auth/estates/inspection-results.test.tsx`. They use the
real generated route tree and mock the HTTP boundary. They can execute before
inspection routes exist; missing pages produce assertion failures rather than
unresolved module imports. Generate the route tree normally when implementing
the new routes. Production hooks must use regenerated API types; the response
examples here are test fixtures only.

Work-order conversion tests reuse ID-36's `expectedSourceLocationId` for the
observed current asset location. The browser source-loading test asserts
authorised server loading without imposing a new source-lookup endpoint: the
conversion URL carries only `sourceInspectionId`, while the planned inspection
detail URL also needs `assetId`. The implemented lookup is GET `/estates/{estateId}/inspection-results/{inspectionId}`;
it resolves the asset under current estate authority. Extra browser prefill
fields do not supply authority.

The original recording implementation deferred the table to ID-49. On
2026-10-26 the user requested including it in this inspection plan and writing
its tests before implementation. The history-table red stage is recorded below;
the previously completed recording verification remains historical evidence.
Actual narrow-layout/keyboard and live private-storage verification remain
manual acceptance work. The implementation uses a bounded hourly orphan sweep and logs cleanup failures;
its live storage verification remains manual acceptance work. The tests require failure reporting and no submitted
database record in that case.

## Running

Run from the repository root using existing dependencies; Docker is required
for the integration suites:

```bash
MAVEN_ARGS=-o pnpm nx run server:test --args=-Dtest=Inspection*Tests --skip-nx-cache --output-style=static
pnpm nx run web:test --skip-nx-cache --output-style=static
pnpm check-types
MAVEN_ARGS=-o pnpm fix
MAVEN_ARGS=-o pnpm test --skip-nx-cache --output-style=static
```

Nx's Maven batch executor did not forward `-Dtest` from `MAVEN_ARGS`; use the
single `--args=-Dtest=Inspection*Tests` override for a focused run. Passing a
comma-separated suite list inside a longer `--args` string was also parsed
incorrectly in the installed version. Confirm Surefire reports rather than
assuming a filtered run happened.

## Verification on 2026-10-26

- `pnpm check-types` and `pnpm fix` passed.
- The combined run executed 1,328 Java tests with 97 assertion failures and no
  errors. The new inspection suites account for 115 cases and 95 failures; the
  remaining two failures are the deliberately updated Crew creation/demotion
  expectations in `WorkOrdersIntegrationTests`.
- The combined web run executed 696 tests: 665 passed and 31 failed. This
  includes two unrelated existing `Devices`-link assertions; the rest exercise
  the missing inspection, Crew-read and invalidation behaviours.
- Review found that the mixed-source URL test could pass on a downstream
  report-loading error. It was strengthened to require rejection before any
  source read, then rerun as part of the focused inspection UI suite.

These results establish the red stage. They do not mark feature implementation
or its manual/integration acceptance complete.

## Implementation notes

- Corrected three test-draft defects separately: legacy owner-only asset reads
  return 404; first work-order completion returns 201; the fake S3 HTTP server
  must provide a real MD5 ETag for SDK checksum validation.
- Updated prior Crew estate-visibility expectations and permission fixtures for
  the approved read-only estate/inspection capabilities, preserving denied
  estate/asset administration and work-order progress.
- Added an Owner/custom-membership regression with no custom read grants, saw
  it fail with 403, then fixed independent ownership in the estate read guard.
- A cached compiled EstateRepository initially retained the old guard. Verified
  the mismatch with javap and followed `.spec/testing.md`'s clean/reset recovery
  before the final uncached regression run.
- Prisma generated `20261026014754_create_inspection_results` against a disposable
  Postgres replayed from repository migrations. Prisma/jOOQ generation and the
  OpenAPI export used that canonical database.
- Development Prisma deploy applied that migration plus the already-pending
  `20261025110000_documents`. Both completed without a reset. The existing
  development-only `20261022045018_device_deactivation_and_replacement` history
  entry is absent from this checkout; no unrelated schema removal was attempted.
- Live authenticated browser, narrow-layout/keyboard and private-R2 smoke
  checks remain manual acceptance items. No browser is installed in this
  environment. At that verification stage, the normal inspection-history table
  was deferred to ID-49; the revised plan now includes it in this feature.

## Final automated verification

On 2026-10-26, after the documented Java clean/Nx reset recovery:

- `MAVEN_ARGS=-o pnpm test --skip-nx-cache --output-style=static`: exit 0;
  1,329 Java tests and 696 web tests passed, with no failures, errors or skips.
  The inspection result suite includes the new independent-ownership case.
- `pnpm check-types`: passed across the workspace.
- `pnpm fix`: passed across the workspace.
- Production `web:build` through Nx: passed.
- `git diff --check`: passed.

The generated API contract includes all successful read responses, multipart
creation, new capability/source fields and a correctly generated nullable
work-order link. Prisma and jOOQ artifacts accompany the migration. Source
changes remain uncommitted. The live browser/R2 acceptance remains separate.
The history-table scope was subsequently revised as recorded below.

## Inspection history table: plan and tests on 2026-10-26

The user explicitly requested modifying the inspection plan to include the
table, then writing its tests. No table implementation is included in this
stage. No endpoint, DTO, schema, dependency or generated-contract changes are
needed. The new suite uses the existing generated route tree, generated API
types for fixtures and the real inspection hooks with a mocked HTTP boundary.
It imports no missing table component, so missing behaviour fails assertions
rather than module resolution.

The 26 cases cover:

- Owner, Manager and Crew asset routes; named table, five semantic headers,
  saved date, outcome, inspector and saved-record URL. Restricted screens do
  not read owner-only asset/assessment/event/forecast/device data.
- Server order with separate same-day records and backdated dates; unavailable
  inspector names without exposing account identifiers.
- Pass/Closed with no conversion/edit/delete; unlinked Fail/Awaiting work
  order with the saved source URL; linked Fail with its work-order reference.
  Work-order read and create capabilities are independent of inspection reads.
- Inactive estate, retired asset and inactive location preserving reads while
  suppressing creation; initial missing inspection authority and revocation of
  authority while the Owner asset screen remains mounted.
- Pending, successful empty and failed history reads; retry while retaining
  asset context and recording entry point; hiding cached rows after 403 or 503.
- Opaque-cursor Next/Previous, first/last page controls, replacing rows, retrying
  the failed second page and resetting to page one when switching assets.
- Returning after a real form save with one Pass row; scoped history
  invalidation replacing awaiting follow-up with the work-order reference while
  retaining Fail and one saved-record link.
- Focusable named scroll region, semantic native links and programmatic focus.
  jsdom cannot verify actual tab traversal, focus styling or rendered overflow;
  a signed-in browser check at 320px remains an explicit manual acceptance item.

Run the focused suite from the repository root:

```bash
pnpm nx run web:test --skip-nx-cache --output-style=static -- inspection-history-table.test.tsx
```

The `nx:run-script` executor forwards positional arguments after `--` directly
to Vitest. `--args=...` is forwarded literally and Vitest rejects it; that
initial CLI failure is not red-stage test evidence. Type checking also caught
unsupported Testing Library `exact` options in the test draft. These were
removed because string role names already match exactly. The loading assertion
was scoped to the history message rather than a transient asset-loading status.
Neither correction changes application behaviour or weakens a requirement.

Initial executable red stage: **26 cases, 25 failed and 1 passed**. The failures
are missing table/row, history loading, empty and error UI assertions. The
passing case verifies that absent inspection authority already prevents history
requests on the Owner asset route. No imports or fixtures failed to load.
Workspace type checks passed after the test-draft correction.

Final verification of the plan/test stage:

- `MAVEN_ARGS=-o pnpm test --skip-nx-cache --output-style=static`: exit 1,
  solely from the new table suite. All 1,329 Java tests passed with no failures,
  errors or skips. Web ran 722 tests: 697 passed and 25 failed, all 25 in the
  new 26-case history-table suite. All 89 other web test files passed.
- `pnpm check-types --output-style=static`: passed across the workspace.
- `pnpm fix --output-style=static`: passed across the workspace.
- `git diff --check`: passed.

The table implementation and real-browser layout/keyboard checks remain
unchecked in the plan. Only the plan, spec index, this verification record and
the new test suite were changed in this stage; existing application changes
remain uncommitted and were preserved.

## Inspection history table implementation on 2026-10-26

After the user requested implementation, added the route-local shared
`inspection-history-table.tsx` to the Owner and restricted Manager/Crew asset
detail views. It uses the existing generated-contract hooks and shadcn Table,
Badge, Button and Alert. It preserves canonical order/calendar dates, gates
work-order links/actions independently, and retains history for inactive context.
The inner page is keyed by user/estate/asset to reset cursors without issuing a
request using another asset's cursor. Errors and revoked authority hide cached
rows; retry targets the current cursor. No tests were changed to pass the
implementation, and no API, schema or dependency changes were required.

The focused suite first passed all 26 cases. Conditional rendering was then
simplified to satisfy lint rules, with the full suite verifying that refactor.
Final automated verification:

- `MAVEN_ARGS=-o pnpm test --output-style=static`: exit 0, no cache hits;
  722 web tests across 90 files passed, including all 26 table cases. Fresh
  Surefire reports confirm 1,329 Java tests, zero failures, errors or skips.
- `pnpm check-types --output-style=static`: exit 0 across the workspace.
- `pnpm fix --output-style=static`: exit 0 across the workspace.
- `pnpm nx run web:build --output-style=static`: exit 0.
- `git diff --check`: passed.

As-built inspection and asset frontend docs now describe the table, paging,
eligibility queries, independent authority and existing invalidations. Native
link/scroll-region focus and table semantics are tested in jsdom. No browser
tool or installed browser is available for actual 320px overflow, tab traversal,
visible focus or signed-in QA, so those remain manual acceptance items. The
existing live private-R2 acceptance is unchanged. All work remains uncommitted.
