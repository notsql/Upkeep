# Readings (frontend)

Estate-wide and per-asset sensor/manual readings with provenance and suspect-data flags. Paths are
relative to `apps/web/src/`. API: [../api/readings.md](../api/readings.md).

## Estate readings browser (ID-60)

Route: `routes/_auth/estates/$estateId/readings/index.tsx`, URL
`/estates/$estateId/readings`. The auth guard checks `canViewReadings` before
management/resident fallbacks, rendering Page not found for unavailable features.
Owner, Manager and Crew receive this read capability without asset-register
access. Header labels come from access context; no owner-only queries are made.

Readings appears in desktop/mobile estate navigation only with that capability.
Estate switching preserves Readings for permitted destinations and retains the
Resident fallback to estate-filtered My reports. The asset detail Devices
section links here with `assetId` preselected. Legacy per-asset bookmarks remain.

### Components

All new components are in the route's `-components/` folder:

| File | Responsibility |
| --- | --- |
| `estate-readings-page.tsx` | Access-context header, breadcrumbs, selected asset and queries |
| `reading-filter-controls.tsx` | shadcn Fields, metric Select, From/To Inputs, suspect Checkbox and Clear filters |
| `reading-asset-picker.tsx` | Button/Dialog picker, name/reference search, retired labels, All assets and option pagination |
| `reading-results.tsx` | Loading, validation, errors/Retry, empty states and page recovery |
| `reading-pagination.tsx` | Previous/Next, current-page indicator, numbered page jumps and ellipses |
| `reading-table.tsx` | Contained scrolling, time, asset labels, metric, value/unit, source/recorder, device and flag Badges |

Filters stack on mobile; long labels wrap without widening the page. Both estate-wide and legacy tables use auto-height, width-bounded flag badges with wrapping, left-aligned text and a readable line height; long flag labels stay inside their borders. Device columns reserve a readable minimum width rather than wrapping identifiers into tall strips. Both Flags columns reserve a minimum width so labels remain readable on mobile; the table scrolls within its own region. Browser checks cover 1280, 375 and 320 px. Crew rows
do not link to owner-only asset pages. **Record manual reading** appears only
with `canRecordReadings` and preselects the current asset/metric.

The estate table shows every page for up to six pages. Longer results show the
first/last pages plus an edge window or the current page and its neighbours, with
non-interactive ellipses for skipped ranges. Numbered shadcn Buttons use
`aria-current="page"` and accessible page labels. Jumps retain active filters and
update the same zero-based URL page; page one omits the page parameter. All
controls disable while placeholder rows are displayed. Buttons wrap on narrow
screens; Previous/Next remain available. The asset picker and legacy per-asset
table retain their existing Previous/Next controls.

### State and requests

`lib/reading-filters.ts` owns URL/form `ReadingSearch`: `assetId?`, `metric?`,
`from?`, `to?`, `suspect?`, `page?`. Invalid UUIDs, metrics, impossible dates or
equal/reversed ranges produce visible feedback; they are not silently dropped.
One-sided ranges are valid. Browser-local times convert to UTC; From is
inclusive, To exclusive. Filter changes return to page zero. Each edit is merged into the latest URL state, so rapid changes to different fields do not overwrite an earlier pending navigation. Clear filters resets even pending edits. URL navigation
preserves scroll and supports reload/Back/Forward restoration.

`lib/readings.ts` uses generated API types:

| Hook | GET endpoint | Query key |
| --- | --- | --- |
| `useEstateReadings(estateId, filters)` | `/estates/{estateId}/readings` | `[userId, "estate-readings", estateId, filters]` |
| `useReadingAssets(estateId, search, page, enabled)` | `/estates/{estateId}/readings/assets` | `[userId, "reading-assets", estateId, search, page]` |

Queries require session readiness and target-estate `canViewReadings`. Invalid
reading filters disable the reading request. Page size is 50; Suspect only
sends all three flags. API errors throw `estateError`; retry is explicit.
Placeholder reading rows carry over only within the same user/estate, labelled
Refreshing readings, with pagination disabled until the new page arrives.
Errors hide stale rows. A refreshed access projection that revokes readings permission also hides cached rows immediately. The page is keyed by user/estate to reset chosen options
on context changes. No invalidations are needed. A preselected asset outside
the current options/results temporarily displays Selected asset, retaining its
original ID until labelled data is available.

Empty states distinguish No assets yet, No readings yet, No readings match
these filters and No suspect readings match. A page beyond a nonzero total
offers Go to first page instead of claiming there have never been readings.

### Performance evidence

`ReadingBrowserBenchmark` is explicitly opt-in, outside ordinary Surefire test
patterns. It uses migrated disposable Postgres 18, not Neon: 43,200 readings per
device (30 days, one per minute), two assets in the selected estate and one in a
different estate, 129,600 rows total. Fixture times are UTC. Reproduce with Docker:

```bash
./mvnw -o -pl com.proj:server test -Dtest=ReadingBrowserBenchmark
```

The ID-60/61/63/64 integration tests and both reading benchmarks use generated
jOOQ tables for fixture inserts, updates, cleanup and storage assertions. Bulk
benchmark data is produced with jOOQ `generateSeries`, with typed decimal values
and UTC timestamps. The browser benchmark sets its transaction-local timeout
through jOOQ and prints the plan through `DSLContext.explain`. Both benchmarks
leave statistics collection to PostgreSQL; they no longer issue explicit
`ANALYZE`, and the plan output does not include execution or buffer statistics.
The 2026-10-27/28 measurements below predate this fixture refactor.

Rechecked on 2026-10-31 with the refactored fixtures: all 89 reading integration
cases and both opt-in benchmarks passed. The mixed browser workload had p95s of
569 ms (first page), 1,375 ms (page 800), 605 ms (suspect first page), 601 ms
(suspect page 800) and 1,058 ms (all assets). The real HTTP export produced
100,000 rows / 44,642,745 bytes in 2.441 seconds; its filtered export and
cancellation cleanup also passed. These are disposable-database measurements.
The full uncached workspace run passed 1,480 backend tests and 880 web tests;
`pnpm check-types` and `pnpm fix` also completed successfully.

Measured 2026-10-27 in Ubuntu WSL / Java 25.0.5. MockMvc exercises the actual
Spring request, authorization, SQL and serialization path; timings exclude
network latency and process/database startup. Each case uses two warm-ups and
10 measurements; nearest-rank p95 is the maximum for ten samples. Ordinary CI
has no machine-dependent wall-clock assertion.

| Case | Median | p95 |
| --- | --- | --- |
| Selected asset/month, first page | 351.4 ms | 382.3 ms |
| Selected asset/month, page 800 | 388.6 ms | 429.5 ms |
| Suspect first page | 346.8 ms | 376.9 ms |
| Suspect page 800 | 357.3 ms | 415.7 ms |
| All same-estate assets, first page | 644.1 ms | 686.5 ms |

All meet the agreed warm p95 target of 2 seconds. The original gap-window query
exceeded a 20-second statement timeout on a month-sized workload. Indexed
strictly-earlier predecessor lookups preserve existing flag semantics and remove
the bottleneck. No migration or dependency was needed. This is local acceptance
evidence, not a deployment SLA or physical-phone measurement.

Additional real browser HTTP/JSON measurements on 2026-10-28 used 43,200
readings in the disposable Owner fixture, with two warm-ups and ten requests
per case: first-page p95 275 ms (median 253), deep page 800 p95 293 ms (median
284), suspect first page p95 272 ms (median 261), suspect page 80 p95 261 ms
(median 251). The suspect filter matched 4,320 rows. These include browser
transport and JSON parsing and also meet the 2-second target.

The isolated browser QA server uses a controlled JWT subject with real database-backed
role guards; frontend WorkOS sign-in is real. This checks role-specific feature
behaviour, not live WorkOS membership provisioning. It does not load the regular
Infisical WorkOS management API key, so Pending invitations can show WorkOS is
not configured in this isolated setup. R2 is disabled and Neon is untouched.

### Mixed manual/sensor performance (ID-63 / ID-64)

On 2026-10-28 the same opt-in benchmark was rerun with
`-Dreadings.benchmark.manual=true`: each of three assets had 43,200 sensor rows
and 4,320 manual rows (142,560 total, including the foreign-estate fixture).
Manual rows share timestamps with sensor rows, exercising mixed duplicates.
Warm-up/sampling and the two-second p95 target are unchanged.

| Case | Median | p95 |
| --- | --- | --- |
| Selected asset/month, first page | 454.0 ms | 485.4 ms |
| Selected asset/month, page 800 | 482.2 ms | 525.6 ms |
| Suspect first page | 472.6 ms | 510.2 ms |
| Suspect page 800 | 544.7 ms | 775.4 ms |
| All same-estate assets, first page | 910.5 ms | 1060.3 ms |

Selected totals were 47,520 and the two-asset estate total 95,040. All cases
passed response/count assertions and the agreed local p95 target. These are
MockMvc request/authorization/query/serialization measurements, not network or
production SLA measurements. Source data and all benchmark records were disposable.

### Live child-branch QA

On 2026-10-28, the user also authorized persistent demo records on their Neon
child branch. Normal `pnpm dev` and real WorkOS identity/recorder lookup were
used. The labelled demo contained 100 sensor and ten manual readings, including
an actual mobile form save, alongside active/retired assets and work orders.
Numbered paging, seven suspect results, retired history, recorder names and
320/375 px layouts passed. This run changed only the labelled demo records and
applied existing pending migrations; the earlier isolated runs above did not
use Neon. Demo UUIDs and credentials are not part of the committed documentation.

### Manual review

1. As Owner, Manager and Crew, open Readings in an assigned estate; verify Crew
   cannot access asset editing, financial data or credentials through this page.
2. Search/select an asset, combine metric and time filters, then Suspect only.
   Check rows, totals and estate/asset scoping.
3. Use Next/Previous, change filters, reload and use Back/Forward. Check reset to
   page one on filter changes, URL restoration and preserved scroll.
4. Check no assets/readings/matches, invalid ranges and an excessive page URL.
   Simulate a failed request and Retry; confirm clear feedback and recovery.
5. Open a legacy per-asset bookmark and the asset-detail preselected entry.
6. Switch estates/accounts, including Resident destinations and denied URLs;
   old scoped cached rows must not appear in the new context.
7. At 320/375 px check long labels, stacked filters, compact reading cards,
   dialog options/paging, keyboard focus/selection and Escape.

## Manual entry and provenance (ID-63 / ID-64)

Route `/estates/$estateId/readings/new` lives in
`routes/_auth/estates/$estateId/readings/new/index.tsx`. It is protected by
`canRecordReadings`, checked before management/Resident fallbacks. Owners,
Managers and Crew receive this capability only in active estates. A refreshed
access projection immediately hides the form if recording access is revoked.

Components in `readings/new/-components/`:

| File | Responsibility |
| --- | --- |
| `manual-reading-form.tsx` | Access/header, local state, options feedback, warning and save/cancel UI |
| `manual-measurement-fields.tsx` | Existing shadcn asset picker in record mode, metric Select, numeric Value and local measurement-time Input |
| `use-manual-reading-submission.ts` | Validation, stable retry UUID/fingerprint, pending/saved state and success callback |

`lib/manual-reading-form.ts` contains local form state and date/value validation,
not API DTOs. The clock defaults to the user's current local minute. The fixed
catalogue comes from the server, including units and expected ranges. Numeric
values outside that range show a warning and remain saveable. No custom metrics
are created. Measurement time accepts backdating and converts to UTC on save.

The existing `reading-asset-picker.tsx` has `mode="record"`: it offers an active
asset selection, disables retired assets and omits All assets. Its default
filter mode still includes retired history. No owner-only asset query is used.
An initial asset beyond the first option page uses a Selected asset fallback;
the server validates its current estate/lifecycle state on submit.

Hook contracts in `lib/readings.ts`:

| Hook | Endpoint / cache effects |
| --- | --- |
| `useReadingMetrics(estateId)` | GET `/estates/{estateId}/readings/metrics`; `[userId, "reading-metrics", estateId]`; gated by ready/read access, explicit Retry |
| `useCreateManualReading(estateId)` | POST `/estates/{estateId}/readings/manual`; checks ready/write capability and throws API errors |

Successful creation invalidates `[userId, "estate-readings", estateId]` and
`[...assetQueryKey(userId, estateId, assetId), "readings"]`. The route then returns
to Readings with only that asset selected, clearing stale time/metric/suspect/page
filters. Ordering remains newest first, so a backdated entry may require paging
or time filtering. The mutation invalidates access and asset options on
403/404/409 to refresh stale permissions/lifecycle state.

Fields and errors remain on failed save. Network failures explain that the
reading could not be saved, ask the user to check the connection/retry and
confirm their entries were kept. Server validation messages remain intact.
Identical uncertain retries reuse a
submission UUID; changing the effective asset/metric/value/time generates a new
one. There is no automatic mutation retry. Fieldset/save disable while pending,
and a successful form cannot submit again during navigation.

`components/readings/reading-provenance.tsx` is shared by both reading tables.
Every row has a text Manual or Sensor Badge in the Source column. Manual rows
show the stored recorder name, falling back to Name unavailable with the stable
subject. Sensor rows show their device identifier; manual device cells show an
em dash. Long names wrap. Desktop tables retain contained horizontal scrolling; mobile
uses labelled cards.
Read pagination/filters/counts cover both sources on the server. Manual values
never fill sensor gaps or change device last-seen/monitoring state.

ID-61 now exports source and recorder metadata as described below, completing
ID-64's CSV criterion. Manual reading edits and deletion remain outside scope.

Manual review additions:

1. Owner/Manager/Crew: open Record manual reading, choose an asset without a
   device, verify local default time, set a backdated time/value and save.
2. Verify name and Manual source in the unified table; compare a Sensor row.
   Combine filters and numbered page jumps; verify mixed matching totals.
3. Change the metric and confirm unit/range update. Save an extreme value and
   check its warning and subsequent Out of range flag.
4. Check retired options disabled; direct retired/inactive saves fail clearly.
   Resident/Council/unassigned entry URLs must return Page not found.
5. Simulate a failed response, verify fields survive and retry creates one row.
6. Check keyboard access, long recorder/asset names and 320/375 px layouts.

## Routes

`/estates/$estateId/assets/$assetId/readings`
(`routes/_auth/estates/$estateId/assets/$assetId/readings/index.tsx`, page
title "Readings"). Requires sign-in. Linked from the asset details page by an
outline "Readings" link in `AssetDevicesSection`'s action row
(`$assetId/-components/asset-devices-section.tsx`, see [devices.md](devices.md)),
shown to everyone who can see the section, before "Register device".

### Search params

Filters live in the URL, so a filtered view can be shared. `validateSearch`
drops anything invalid.

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `metric` | DeviceMetric | all | Must be a key of `deviceMetrics` |
| `from` | string | none | `datetime-local` value (`YYYY-MM-DDTHH:mm[:ss]`), browser-local time |
| `to` | string | none | As `from` |
| `suspect` | `true` | off | `true` or `"true"`; anything else is dropped |
| `page` | integer | 0 | Only kept when a whole number > 0 |

Any filter change (metric, from, to, suspect) resets `page` to the first page.

## Screens and components

Both in `readings/-components/`.

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `ReadingsPage` (`readings-page.tsx`) | "Back to asset" link; `PageHeader` "Readings" with breadcrumbs Estates / estate name / Assets / asset name / Readings (from `useEstate`, `useAsset`) and description "Sensor readings for this asset, newest first. Suspect readings are flagged."; the filters; "Loading readings…" (`role="status"`) while pending; errors as a destructive alert. Table `aria-label="Readings"`, columns Measured (`toLocaleString`), Metric (catalogue name), Value (`{value} {unit}`), Source (Manual/Sensor and human recorder), Device (`deviceIdentifier`), Flags (one outline badge per flag). Pagination `nav` "Pagination": "Page {n} of {pages} · {total} reading(s)", "Previous page" (disabled on the first page) and "Next page" (disabled on the last). | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `Badge`, `Button`, `Alert`, `AlertDescription`, `Empty`, `EmptyHeader`, `EmptyTitle` |
| `ReadingFilterControls` (`reading-filters.tsx`) | "Metric" select ("All metrics" plus each catalogue name), "From" and "To" `datetime-local` inputs, and a "Suspect only" checkbox. | `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `Field`, `FieldLabel`, `Input`, `Checkbox`, `Label` |

### Badges (`flagLabel`)

| Flag | Text |
| --- | --- |
| GAP | `Gap {formatGap(gapSeconds)}`, e.g. "Gap 2h 5m" (units d/h/m/s, zero parts left out, "0s" for zero) |
| DUPLICATE_TIMESTAMP | `Duplicate timestamp` |
| OUT_OF_RANGE | `Out of range (valid {validMin} to {validMax} {unit})`, numbers via `toLocaleString`; the range comes from the API, never hard-coded |

### Empty states

Shown (as an `Empty`, `role="status"`) when the response has `totalItems` 0.
First match wins:

1. `suspect` on: "No suspect readings match"
2. `metric`, `from` or `to` set: "No readings match these filters"
3. Otherwise: "No readings yet"

## Data (`lib/readings.ts`)

Types: `AssetReadingPage`, `AssetReading` (= `AssetReadingResponse`),
`ReadingFlag` (= `ReadingFlagResponse`), `ReadingFilters` (`metric`, `from`,
`to`, `suspect`, `page`). `READINGS_PAGE_SIZE = 50`.

Query key: `readingsQueryKey(userId, estateId, assetId, filters)` =
`["estates", userId, "assets", estateId, assetId, "readings", filters]` -
`assetQueryKey` plus `"readings"`, like the other per-asset queries.

| Hook | Endpoint | On success |
| --- | --- | --- |
| `useReadings(estateId, assetId, filters)` | `GET /estates/{estateId}/assets/{assetId}/readings` | query |

Query params sent: `metric`; `from`/`to` converted from `datetime-local` to ISO
UTC (`new Date(local).toISOString()`); `flag` = `GAP`, `DUPLICATE_TIMESTAMP`,
`OUT_OF_RANGE` when `suspect` is on; `page` (default 0); `size` 50. Undefined
params are left out. `enabled: ready`, `retry: false`,
`placeholderData: keepPreviousData` (the previous page stays visible while the
next loads); errors via `estateError`.

No mutations, so nothing is invalidated.

## Mobile reading records

Below 768px, `components/readings/reading-cards.tsx` renders both the estate-wide
and legacy asset lists as a single accessible `Readings` list. Each shadcn Card
shows the metric/value/unit, measured time, Manual/Sensor provenance (including
manual recorder name/ID fallback), applicable device, all flags and estate-list
asset name/reference. Long labels and flags wrap. Manual entries do not invent
a device. The estate `reading-table.tsx` and asset `readings-page.tsx` use the
existing `useMobile` hook to select cards or desktop tables from the same query
result; filters, query keys, numbered estate paging and legacy paging are
unchanged. Only the current presentation mounts. Cards expose refresh busy
state while existing data remains visible.


## Export CSV (ID-61 / ID-64)

The estate Readings screen has a shadcn Export CSV Button with help: Exports all
matching readings, across every page. `-components/reading-export.tsx` supplies
pending Spinner, Cancel export Button, destructive error Alert and cancellation
status. Visibility follows current `canViewReadings` plus a ready authenticated
session; no new permission is introduced. The action is disabled for invalid
filters, an initial/refreshing list, errors and an already-running transfer.
Completed empty results may export their schema header.

`lib/use-reading-export.ts` owns the React Query mutation. It calls the generated
client GET `/estates/{estateId}/readings/export`, `parseAs: "stream"`, an
AbortSignal and no automatic retry. `readingFilterQuery` in `lib/readings.ts`
serializes the same asset/metric/local-time-to-UTC/suspect fields for the list and
export. Page/size are never sent to export. The request captures applied filters
at click time; changing filters afterward does not rewrite an in-flight export.

A transfer ref scopes its controller to user and estate. Cancel, unmount,
revoked/failed access and a user/estate change abort it. Synchronous repeat starts
are guarded before React Query's pending render. Late responses cannot save a
file for another scope. Export does not invalidate reading data or create DB/R2
records. Errors preserve the current filters; retry is explicit.

The server prefixes the CSV with one UTF-8 BOM for Excel encoding detection.
`lib/reading-csv-download.ts` consumes bytes incrementally with UTF-8 validation,
tracks quoting/columns across chunks, checks the fixed v1 header and compares
records with X-Export-Row-Count. This handles quoted multiline fields without
counting their embedded newlines as extra records. Missing metadata, truncated
responses or stream failures never create a download. It collects the validated
bytes into a browser Blob; browser memory is proportional to the file, while
server fetching stays bounded. A safe server attachment filename is used with a
`readings-v1.csv` fallback. The temporary object URL/link is cleaned up after use.

The API document defines every CSV column, UTC/decimal/null/source/escaping rule
and a pipeline parser example. No legacy per-asset export button, CSV import,
source filter, chart, scheduled export or background job is included.

The validation decoder consumes the leading BOM, while the downloaded Blob
preserves the original bytes. This also works when the three BOM bytes arrive
in separate stream chunks, including header-only exports.

### Performance and browser review

Opt-in benchmark, disposable Postgres only:

```bash
./mvnw -o -pl com.proj:server -Dtest=ReadingExportBenchmark -Dreadings.export.rows=1000000 test
```

The benchmark runs the actual Spring/Tomcat HTTP endpoint with controlled JWT
identity against a migrated Testcontainers database. It seeds two same-estate
assets with 70% sensor/30% manual rows and a foreign-estate control, checks exact
row count and transport metadata and consumes bytes with a small buffer. It also
cancels an HTTP download and waits for both worker and database connection to
return, then checks a suspect-filter export. It is excluded from normal Surefire
`*Tests` selection; machine-dependent timing is asserted only in this opt-in run.

Observed 2026-10-28: 100,000 rows / 44,642,742 bytes in 4.801s; final stress run
1,000,000 rows / 446,426,066 bytes in 13.282s; 27,272 out-of-range rows /
11,672,552 bytes in 5.022s. HTTP/1.1 chunked transfer was verified, including files
over 32 MiB. These are local measurements, with all responses below the proposed
120s budget. Cancellation returned worker/connection successfully. No production
Cloud Run revision was manually deployed.

Manual/browser checks: export a multi-page result; compare the downloaded CSV's
records with the filter and total rather than just the visible page. Repeat for
asset/metric/time/suspect filters and an empty result. Verify both source labels,
manual recorder IDs/names, disabled/pending/cancel/error/retry states, narrow
320/375px controls and existing Owner/Manager/Crew versus Resident/Council access.

## Combined acceptance QA — 2026-10-31

Reviewed the current Jira acceptance criteria for ID-60, ID-61, ID-63 and ID-64
against `feat/browse-raw-sensor-readings` at `09fde7d`. Application source was
not changed during this review. One manual-entry precision issue remains below;
the passing automated suite does not cover that edge case.

Verified together:

- ID-60: actual asset/metric/suspect controls, combined local-time boundaries,
  numbered page jumps (50/50/10 on the initial 110-reading demo), first-page
  recovery, Back/Forward restoration, retired history and clear empty/no-match
  states. A combined asset/metric/time/suspect filter returned the expected row.
- ID-63/64: on mobile, selected an asset without a device, checked the current
  local default time, backdated a temperature reading to 2026-10-30 08:23 SGT,
  and saved 151.246813. The warning allowed saving as agreed. The resulting row
  showed Manual, the authenticated recorder and Out of range; its filtered CSV
  preserved 151.246813, the recorder identity/name, UTC measurement/recording
  instants, no fabricated device and the flag. This added one labelled-demo
  reading; demo readings now total 111. Retired choices were disabled for entry
  and remained available for historical filtering.
- ID-61: full 110-row initial export beyond the visible page, pressure-only
  export (25), empty suspect-pressure export (0), combined filtered export (1),
  source/recorder columns and the leading UTF-8 BOM. Celsius remained `°C`.
  Cancelling a throttled export saved no file and preserved filters. Blocking
  just the save request showed connection feedback and preserved entered fields;
  blocking was removed afterward.
- Actual mixed-role session: Owner demo flow and Manager/Crew reading lists,
  manual-entry forms and CSV exports passed. Resident, Council and a foreign
  estate's reading/list-entry routes showed Page not found. Manager/Crew retained
  only the pre-existing restricted inspection asset context, without asset
  registration controls; that context is intentional, not owner-register access.
  Actual estate switching cleared the Owner demo rows in the Crew context;
  selecting a Resident estate opened its My reports page as agreed.
- Visual review at 320, 375, 768 and 1280 px: no horizontal page overflow; mobile
  reading cards and source/flag labels remained readable, the asset picker fit,
  and desktop/tablet table scrolling stayed contained. Escape closed the picker
  and returned focus to its trigger. Browser emulation was used, not a physical
  phone; Excel encoding was checked from downloaded bytes, not by automating Excel.

Fresh uncached combined regression: **1,470 server / 866 web tests passed**.
Workspace types, read-only lint/format checks and the production web build passed.
Disposable mixed-source month benchmark (43,200 sensor plus 4,320 manual rows per
asset): p95 selected first/deep 509/584 ms, suspect first/deep 672/604 ms and
all-assets first 934 ms, each below the agreed 2-second local target. Real HTTP
export of 1,000,000 mixed rows / 446,426,069 bytes completed in 13.645 seconds;
27,272 suspect rows completed in 5.024 seconds. HTTP cancellation released both
worker and connection. These are local measurements, not a deployed Cloud Run SLA.

### Resolved QA finding: manual-entry decimal precision (ID-63)

Original QA finding, corrected by the follow-up below. The form accepted up to
12 integer digits, but `new/-components/use-manual-reading-submission.ts` converted
the user's string with `Number(fields.value)` before JSON serialization.
Entering `999999999999.123456` produced the actual outbound numeric payload
`999999999999.1234`. This changes the requested six-decimal measurement before
the backend receives it. The value is implausible for the metric, but retaining
flagged extreme values is explicitly supported. This is separate from the
server's intentional rounding beyond six fractional places.

Reproduced in the real form with only the manual-save URL blocked: the request
body lost the digits, the original input remained in the form after the failure,
and no incorrect row was stored. The backend's decimal parser cannot recover
original digits lost in the client. The pre-fix passing suite missed this case.
The follow-up added failing regressions for exact submission, boundary values,
retry identity and reading display, then verified storage/CSV consistency.
No fix was applied during that QA review; the user subsequently approved the
precision correction documented below.


## Exact manual decimal transport — 2026-10-31

`lib/manual-reading-form.ts` parses and canonicalizes the editable number as
text, including exponent notation. It checks twelve integer / six meaningful
fractional digits before any decimal expansion, so enormous exponents cannot
allocate huge strings. Invalid/excess precision shows feedback without a request
and preserves input. Trailing zeroes and equivalent exponent forms normalize to
the same canonical value. Out-of-range warnings still allow valid stored values.

`use-manual-reading-submission.ts` sends canonical decimal text in the generated
CreateManualReadingRequest value union, without converting the measurement to
Number. The exact canonical value also determines the uncertain-retry fingerprint:
changing the last decimal digit changes the key; equivalent decimal text reuses it.
The server still accepts legacy numeric requests. The contract was regenerated
from the running Spring OpenAPI document; the uncached Maven exporter cannot run
offline under the repository's no-install rule, so the installed type generator
consumes that actual runtime export.

Both reading lists, legacy asset history and shared mobile cards prefer optional
valueText from the server, falling back to value for older responses. Exact display
text removes unnecessary trailing zeroes while retaining every significant digit;
CSV still writes the stored decimal with six fractional places. No schema change,
new dependency, manual API type or device-ingestion change is involved.

TDD evidence: the initial web run observed eight failures across the form and
read screens; canonical-value/retry additions also failed before implementation.
The server run observed two failures (string submission and exact response).
Legacy display was separately observed failing before its renderer changed.
Focused verification now passes 60 backend and 57 web cases; actual form requests,
storage-backed responses, mobile/desktop/legacy display and CSV retain
999999999999.123456 exactly. Excess fractional precision retains the input and
shows a clear error. The live demo now has 112 readings after this valid QA save.

Final verification: 1,480 backend tests passed in the clean uncached run;
the full 880-case web suite passed after the readiness correction below. Types,
formatting and production web build passed. One unrelated inspection/work-order
test failed once
with an unedited description; its unchanged 32-case file and the full 880-case
web suite passed on recheck. The cached combined retry restored older Java
classes, confirmed with javap: valueText and decimal-string parsing were absent.
The prescribed generated-output/Nx reset restored current bytecode and the clean
backend run passed. A separate unhandled React Query callback identified a premature
absence assertion in document-navigation.test.tsx; that test now waits for the
loaded denied-access UI before asserting absence. No assertions were removed and
no errors were suppressed; its five cases and the full web run then passed.
No inspection source/test changes, schema migrations, dependencies, commits or
pushes were made. The final parser uses equivalent String.match instead of
RegExp.exec to avoid Biome's nullable-result inference false positive.


When checking very large CSV values in Excel, import the value column as Text
before numeric conversion. The CSV retains all stored digits, but Excel numeric
cells support only 15 significant digits; formatting a previously rounded cell
cannot restore its original digits. See [Microsoft's import guidance](https://support.microsoft.com/en-us/excel/keeping-leading-zeros-and-large-numbers).
