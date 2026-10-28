# Manual readings and reading provenance

**Status:** implemented and verified — final combined 1,470 server / 866 web tests; browser, performance, types, formatting and build passed; ID-64 CSV provenance completed by ID-61
**Owner:** Chan Ding Jie
**Jira:** [ID-63](https://notjira.atlassian.net/browse/ID-63),
[ID-64](https://notjira.atlassian.net/browse/ID-64)
**Base:** ID-60 committed as `5ba6950` on `feat/browse-raw-sensor-readings`.

## Problem

An asset without a sensor cannot have readings recorded through the application.
Technicians also need to distinguish measurements entered by a person from
measurements submitted by a device, and identify the person who recorded them.

This combines manual entry with its provenance display. ID-64 additionally
requires provenance in CSV exports; ID-61 now implements that criterion on
this branch, with mixed-source export and recorder tests.

## Agreed choices

1. **Agreed:** Owners, Managers and Crew may record readings, matching ID-60's
   read access. Council, Residents, unrelated users and custom roles without
   this explicit policy remain denied. The user explicitly approved extending
   Crew access from browsing to manual entry for these stories.
2. **Agreed:** retain out-of-range measurements, display a warning and flag them. This
   follows the existing ID-67 specification, which explicitly applies to ID-63,
   and decision 0028. ID-63's range validation is a plausibility check rather
   than a rejection of a potentially real fault. Invalid numbers, unsupported
   metrics, incorrect units and invalid timestamps still fail validation.
3. **Agreed:** use the eight existing catalogue metrics and fixed units/ranges.
   Custom metric management is deferred, as confirmed by the user. Water-meter
   volume and running-hours catalogue additions are not included without agreed
   units/ranges. They do not block entering the existing metrics manually.

## Behaviour

### Recording

- A permitted user opens **Record manual reading** from the estate Readings
  page. A selected asset/metric preselects the corresponding form fields.
- The user chooses a same-estate asset and catalogue metric, enters a numeric
  value and sets the measurement time. The metric displays its fixed unit and
  expected range; free-text units are not accepted.
- No device is required. Assets with and without devices can both receive
  manual readings. A manual reading never creates a fake device.
- Measurement time defaults to the user's current local time. Backdating is
  permitted. Offset-aware API timestamps are normalized to UTC, at stored
  microsecond precision. Future times beyond the existing five-minute clock
  tolerance are rejected.
- Values use `numeric(18,6)` and the existing half-up rounding rule. Missing,
  non-numeric, non-finite and unrepresentable values are rejected clearly.
- New entries require an active estate and non-retired asset. Historical
  readings remain readable after estate deactivation or asset retirement.
  A location's deactivation alone does not retire the asset.
- The server derives recorder identity from authentication, not request fields.
  Store recorder subject and a display-name snapshot using the existing
  identity lookup conventions. Name-service failure must not lose a valid
  reading; retain the stable subject and show an honest name-unavailable fallback.
- Save disables while pending. Validation feedback preserves entered fields.
  A successful save refreshes readings and returns to the asset's readings,
  with filters reset so a backdated or suspect-only mismatch cannot hide the
  new entry. Newest-first ordering remains intact; do not claim a backdated
  row must be on page one.
- The form creates an idempotency UUID for a submission and reuses it on an
  uncertain retry. An identical retry returns the original reading, while a
  conflicting payload under the same key returns 409. A materially edited
  submission gets a new key. Concurrent retries cannot create duplicate rows.
- No edit or delete endpoint is included in these stories.

### Unified browsing and attribution

- Both the estate browser and legacy per-asset reading history show manual
  and sensor readings in one newest-first series, with deterministic ID ties.
- Every row has a visible **Manual** or **Sensor** source label. The distinction
  uses text and styling rather than colour alone.
- Manual rows show who recorded the measurement. Sensor rows show their
  device identifier; manual rows have no device identifier.
- Existing asset, metric, time and suspect filters, totals and numbered estate
  pagination operate across both sources before paging. Do not fetch a page
  from each source and merge only those pages in the browser.
- Sensor rows return `source: SENSOR`; manual rows return `source: MANUAL`,
  with server-derived recorder metadata. No source backfill is required for
  existing device rows because source is derived from the stored table.
- Out-of-range flags apply to both sources. Duplicate-timestamp flags apply
  to multiple stored readings of the same asset/metric/instant, including
  mixed sources, without treating an idempotent retry as a second reading.
- GAP remains a sensor-cadence rule. Manual rows do not receive GAP flags and
  do not fill or suppress a gap between sensor readings. Device last-seen,
  flatline monitoring and sensor ingestion continue to use device data only.
- Legacy per-asset history retains its owner-only authorization. Recording
  permission does not open the owner-only asset register or financial data.

## Data

Implemented architecture: an append-only `ManualReading` model rather than
making the existing `DeviceReading.deviceId` nullable. Device readings are used
by device authentication, retry/last-seen and monitoring logic; their guarantees
should remain intact. Add a short decision record once this choice is agreed.

`ManualReading` fields:

- `id: uuid`, `estateId: uuid`, `assetId: uuid`.
- `metric: varchar(30)`, `value: numeric(18,6)`.
- `measuredAt: timestamptz(6)`, `recordedAt: timestamptz(6)`.
- `recordedByUserId: string`, `recordedByName: string?`.
- `submissionId: uuid`, unique together with estate and recorder subject.
- Composite `(assetId, estateId)` foreign key, restrictive delete/update.
- Asset relation and `(assetId, metric, measuredAt)` index; evaluate estate-wide
  query plans before adding further indexes.

Generate the migration through Prisma against a disposable database, then
regenerate jOOQ and the API contract. Do not apply to Neon during development
without the user's authorization. No dependency installation is planned.

## API

Implemented contract (generated from Spring):

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/estates/{estateId}/readings/manual` | `assetId`, `metric`, `value`, `unit`, `measuredAt`, `submissionId` | 201 new / 200 identical retry, manual reading DTO | Agreed manual-entry roles |
| GET | `/estates/{estateId}/readings` | Existing filters/page/size | Existing page envelope; unified rows | Existing ID-60 policy |
| GET | `/estates/{estateId}/assets/{assetId}/readings` | Existing filters/page/size | Existing page envelope; unified rows | Existing owner-only policy |
| GET | `/estates/{estateId}/readings/assets` | Existing asset search/page/size | Existing minimal asset options | Existing ID-60 policy |
| GET | `/estates/{estateId}/readings/metrics` | None | Catalogue metric, fixed unit, valid minimum/maximum | Existing ID-60 policy |
| GET | `/access/context` | Existing | Add `canRecordReadings` alongside `canViewReadings` | Signed-in user |

Read row DTOs gain required `source: SENSOR | MANUAL`, recorder identity/name
for manual rows and nullable device fields. Define nullable fields explicitly
in OpenAPI; regenerate frontend types. Device-ingestion request/response
contracts stay intact. Expose the authoritative server metric catalogue through
the minimal metrics endpoint for form units/ranges. Existing device responses
only expose a device’s registered metrics and units; Crew must not need device
management access to fill this form. Do not duplicate range values in the UI.

Errors use the existing reading/estate error body: 400 invalid payload, 401
signed out, 403 insufficient role, 404 missing/foreign estate or asset, 409
inactive/retired write target or conflicting idempotency payload.

## Frontend

- Existing screen: `routes/_auth/estates/$estateId/readings/index.tsx` and
  its route-local components. Add the source/recorder display and entry button.
- New entry route: `routes/_auth/estates/$estateId/readings/new/index.tsx`,
  with form components in its `-components/` folder and breadcrumbs back to
  Readings. Use existing shadcn Fields, Select, Input, Alert and Button, and
  the existing minimal searchable asset picker.
- Extend `lib/readings.ts` with typed catalogue/mutation hooks as needed.
  Query keys remain user/estate scoped. Invalidate both estate and affected
  legacy asset-reading queries on successful creation.
- The entry route checks write capability directly, including bookmarked URLs.
  Hide inaccessible actions and guard mutations independently on the server.
- Mobile controls, long asset/recorder names, flag wrapping and keyboard access
  are part of acceptance, not a later polish step.

## Edge cases and test plan

- Write failing server tests for roles, cross-estate IDs, no-device assets,
  inactive/retired targets, validation boundaries, UTC/backdating, identity
  spoofing, rounding and identical/conflicting/concurrent retries.
- Test source/recorder DTOs, mixed totals/order/filter/page boundaries, duplicate
  instants across sources and time zones, and sensor gaps unaffected by manual
  entries. Keep existing ingestion and monitoring tests passing.
- Write failing web tests for entry access, defaults, metric/unit/range feedback,
  validation, pending/error/retry states, backdated save navigation, source labels,
  recorder display and invalidations. Do not assert implementation details.
- Re-run the ID-60 month-sized performance check with mixed data; retain the
  agreed warm p95 target of two seconds and correct pre-pagination totals.
- Regenerate the contract and jOOQ; run tests, types, formatting and build.
- Browser-check the approved roles, manual creation, mixed reading history,
  keyboard operation and 320/375 px layouts using disposable fixtures first.
- Update `.docs/api/readings.md`, `.docs/frontend/readings.md`, access/shell
  docs and `.docs/README.md` with the final built contract and routes.

## Dependencies and out of scope

- ID-60 is committed and supplies the browser and minimal asset picker.
- ID-61 now includes source and recorder columns in CSV; see its feature spec
  for mixed-source tests and the large-export verification evidence.
- No dependency on CSV import, aggregation, retention or inference stories.
- No chart, import/export implementation, custom metric editor, source filter,
  manual-reading edits/deletion or custom-role permission framework here.

## Implementation order (completed)

1. Record the agreed contract and separate-table decision, then start failing tests.
2. Server tests first, then Prisma migration, generated jOOQ and manual writes.
3. Tests first for unified reads/provenance/flags, then implementation and
   OpenAPI generation.
4. Tests first for entry UI and provenance display, then implement and document.
5. Automated, performance and browser verification. Leave changes uncommitted.


## Verification record (2026-10-28)

- Began from committed ID-60 (`5ba6950`) with a clean working tree. Only plans
  were written before the user agreed permissions, range handling and the
  existing-metric scope. No dependency installation, commit or push occurred.
- TDD: 28 initial server tests ran with 25 expected missing-feature failures and
  zero test errors. After implementation the 57 manual/estate tests passed.
  Added concurrent-retry coverage; full backend regression passed 1,449 tests.
- Web TDD: three new source/action/guard tests failed before implementation;
  nine form tests failed against an empty component. A later network-feedback
  test failed on the technical browser message before adding the readable
  connection message. The focused final form suite passes all ten tests.
- The final normal combined `pnpm test` passed 1,449 server / 831 web tests
  across 96 web files. Tests reside at the new route component’s mirrored path.
  All generated API types, formatting, workspace types and production web build
  passed on the final implementation.
- Types, repository formatting and the production web build pass. A concurrent
  Nx invocation briefly encountered partially written generated Maven metadata;
  it regenerated without source/data changes, and sequential checks and the
  normal combined command then passed. No persistent Nx configuration workaround.
- Prisma generated migration `20261027190834_manual_readings` against disposable
  Postgres, deployed there and generated Prisma/jOOQ output. Neon was not used.
- The actual Spring runtime exported OpenAPI against disposable Postgres using
  the existing offline launcher because the declared springdoc Maven export
  plugin remains uncached. Generated TypeScript through the existing Nx target.
  Semantic comparison confirms two new paths, three new DTO schemas and changes
  only to the two reading row schemas and estate-access schema. No test endpoints.
- Mixed month-sized benchmark passed with 142,560 total rows, 47,520 selected
  matches and 95,040 same-estate matches. Worst warm p95 1,060.3 ms, below the
  agreed 2-second target. Measurements and reproducible flag are in frontend docs.
- Browser QA used isolated fixture identities with real feature authorization
  and a controlled name provider. Frontend WorkOS sign-in was real; this does
  not test live membership provisioning/name lookup. R2 was disabled and Neon
  untouched. After the user stopped ordinary pnpm dev, QA used 3001/8080.
- Actual browser clicks passed Owner, Manager and Crew manual creation;
  unsensored assets; disabled retired options; backdating/default-now/zero;
  unit/range changes with keyboard selection; warning plus saved out-of-range
  flags; recorder names and mixed source totals; legacy Owner history; and
  Resident/Council entry URLs returning Page not found without report redirects.
- A genuinely backdated Crew reading sorted below newer sensor readings and
  was located with the Pressure filter, as designed. An initial browser script
  incorrectly expected it on page one; the UI ordering was not changed.
- Layout checks passed at 1280/375/320 px, including a 320x568 asset dialog and
  Escape dismissal. A failing geometry assertion found a 212.5 px mobile sensor
  row caused by a narrow device column; minimum width reduced it to 112.5 px
  with page overflow still contained. Both reading views received this fix.
- Browser save-request blocking verified readable network feedback, preserved
  values, and one new row after each successful retry. The first whole-browser
  offline attempt delayed token retrieval until reconnect rather than producing
  a save error; the definitive check blocked only the save endpoint and left
  authentication online. All blocking/emulation was removed afterward.
- ID-64's CSV source/recorder requirement remains explicitly pending ID-61.
- Temporary QA frontend/API and the disposable schema-generation database
  were stopped/removed after verification. No temporary launcher or browser
  helper is inside the repository; no files were staged, committed or pushed.
  Deploy the new migration to the human-selected normal dev database before
  exercising manual entry through ordinary `pnpm dev`.


## Follow-up live Neon child-branch QA (2026-10-28)

At the user's explicit request, repeated QA against their selected Neon child
branch using normal `pnpm dev`, real WorkOS identity/name lookups and application
permission checks. Verified the API and Prisma selected the same Neon host and
database. Applied the four existing pending migrations; all 31 are now applied.
This is separate from the earlier disposable-fixture verification above.

Created a labelled, persistent demo estate through authenticated APIs: three
assets (two active, one retired), one block/two levels, two simulated devices,
100 sensor readings and ten manual readings (one submitted through the actual
mobile UI), five work orders (three Open, one In progress, one Closed), one
corrected completion and one manual preventive-maintenance event. Device
measurements used device authentication outside the browser; credentials stayed
in process memory/stdin and were not logged or saved. Existing non-demo records
were left alone; no invitations or messages were sent.

Live checks passed 110-row numbered paging, seven suspect matches, retired
mixed-source history, asset and work-order filters, three chronological status
changes, correction reason/snapshots, the corrected SGD 123.50 completion in
asset Maintenance/costs, and the SGD 35.00 preventive event. Recorder names came
from the real account lookup. Live priority sorting placed Urgent/High ahead of lower priorities and the
older of the two Medium orders first. Mobile checks covered 320/375 px entry/detail
views and the 320 px work-order list without page overflow. Demo records remain available to the user and the
normal development app remains running. The credential-free record index is in
`/tmp/cs203-neon-demo-records.json`, outside the repository.


### ID-61 follow-up — 2026-10-28

CSV export now includes both sources and their actual device/manual-recorder
metadata, completing ID-64's remaining export criterion. The ID-61 spec records
TDD evidence, scope/cancellation/transport checks, the million-row benchmark and
live Neon demo downloads. Final combined checks passed: 1,469 server / 864 web
tests, types, formatting and web build. Earlier pending-CSV notes above describe
the state before this follow-up.
