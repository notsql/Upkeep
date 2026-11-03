# Export a filtered reading view to CSV

**Status:** implemented and verified 2026-10-28 — 1,470 server / 866 web tests, types, formatting, build and live browser QA passed
**Owner:** Chan Ding Jie
**Jira:** [ID-61](https://notjira.atlassian.net/browse/ID-61), completing the CSV
criterion of [ID-64](https://notjira.atlassian.net/browse/ID-64)
**Base:** current readings branch, `feat/browse-raw-sensor-readings`.

## Problem

A user can browse sensor and manual readings but cannot download a complete
filtered dataset for model preparation. Copying the visible page would omit
matching measurements, and exporting measurements without their source would
lose the distinction between device and human observations.

Jira requires all active filters, results beyond the visible page, timestamp /
asset / metric / value / unit / provenance columns, large-export handling and
a documented format that a model pipeline can consume reliably.

## Agreed choices

- Add Export CSV to the existing estate Readings screen. The asset filter also
  supports a single-asset export; no second per-asset endpoint is necessary.
- **Agreed 2026-10-28:** Owners, Managers and Crew may export, matching browsing.
- Use direct server-side streaming with bounded database fetching, using
  existing dependencies. Start with a tested large workload rather than adding
  an export-job queue, storage objects and a background worker speculatively.
  Streaming remains subject to request timeouts; it is not an unlimited-duration
  guarantee. The large-data acceptance test below is a release requirement.
- Include both sources with their recorder/device provenance,
  preserving the current browser's filters and newest-first order.

## Behaviour

### Selecting and downloading

- An authorized user selects Export CSV on `/estates/$estateId/readings`.
  A help label makes clear that it exports all matching readings, not just the
  current page. The action works on desktop and mobile.
- Capture the applied asset, metric, inclusive from, exclusive to and suspect
  filters at click time. Browser page number and page size do not restrict the
  export. Do not use placeholder rows from a previous filter as export input.
- Export uses the same server-side filter semantics, union of sources and flag
  calculation as browsing. Suspect means any of GAP, DUPLICATE_TIMESTAMP or
  OUT_OF_RANGE, matching the current checkbox. There is no new source filter.
- All matching rows are included, with no page/row cap or silent truncation.
  Order is `measuredAt DESC, id DESC`, consistent with the current list.
- Export reads one database query snapshot. New submissions after that query
  starts are not promised to appear. It is not a snapshot of an earlier browser
  page fetch, and it is not assembled by repeatedly fetching offset pages.
- An empty result produces a valid CSV with only its header row.
- While downloading, show readable pending feedback and prevent repeat starts.
  Provide Cancel. Cancellation, leaving the screen, changing estate or signing
  out aborts the download and prevents a stale account/estate file being saved.
- Invalid filters, unresolved/revoked access and an initial/unsettled filtered
  list disable export. Completed-empty results remain exportable.
- Errors are visible and preserve filters. Retry is explicit. Create the browser
  download only after the entire response body is received; a failed/cancelled
  transfer must not be announced as a successful CSV download.

### Access and historical data

- Agreed export roles match current `canViewReadings`: Owners, Managers and Crew.
  Reuse that capability for UI visibility and the corresponding current-role
  checks on the server; no separate export permission is needed.
- Check authenticated identity and current estate authority on the server before
  starting output. Foreign estate/asset IDs cannot expose rows or labels.
- Retired assets and inactive-estate historical reads follow the approved read
  policy. Exporting does not grant the owner-only asset register, financial
  information, device credentials or another resident's fault reports.
- Export contains sensor device identity or manual recorder attribution already
  available in reading DTOs. It never exposes device API keys or auth tokens.

## CSV v1 contract

UTF-8 with one leading BOM (EF BB BF), comma delimiter, header row and CRLF record endings.
The user approved this Excel compatibility correction on 2026-10-28 after Excel
displayed the degree symbol as `Â°`. Consumers should use a BOM-aware UTF-8
decoder (`utf-8-sig` in Python); columns, values and row counts remain unchanged.
Quote/escape commas, double quotes and embedded newlines correctly. Empty fields
represent unavailable nullable metadata; numeric zero remains a numeric value.

| Column, in fixed order | Format / meaning |
| --- | --- |
| reading_id | UUID of the stored measurement; use together with source as identity |
| measured_at | Measurement instant, UTC ISO-8601 with six fractional digits and Z |
| asset_id | Stable asset UUID |
| asset_reference | Current asset reference from the export query |
| asset_name | Current asset name from the export query |
| metric | Stable DeviceMetric code, e.g. TEMPERATURE; no localized display label |
| value | Stored decimal, six fractional places, dot separator, no grouping/exponent |
| unit | Fixed catalogue unit, e.g. °C or kWh |
| source | SENSOR or MANUAL |
| device_id | Sensor device UUID; empty for manual readings |
| device_identifier | Sensor device identifier; empty for manual readings |
| recorded_by_user_id | Authenticated manual recorder subject; empty for sensor readings |
| recorded_by_name | Stored manual recorder name; empty when unavailable or sensor |
| recorded_at | Sensor receipt/manual record instant, same UTC format as measured_at |
| flags | Semicolon-separated GAP;DUPLICATE_TIMESTAMP;OUT_OF_RANGE codes in that order; empty if none |

Do not export formatted UI fallback names as if they were genuine recorder
names. Preserve the stable recorder ID when the name is unavailable. Do not
invent a device for a manual reading. Flag rules remain unchanged: duplicates
include both sources, GAP uses only sensor cadence and out-of-range values are
retained. No interpolation, aggregation or training transformations occur.

Text-field spreadsheet protection must be explicit and reversible in the
documented ingestion contract. Implemented rule: prefix potentially spreadsheet-
active user-controlled text with an apostrophe; also escape an original leading
apostrophe so the consumer can remove exactly one added prefix. Cover leading
whitespace/control-character cases. Apply this to labels/recorder text, never
to genuine numeric values such as negative temperatures. Document the precise
rule and examples alongside the finalized CSV schema before shipping.

Choose a safe filename using estate UUID, schema version and UTC export time,
without interpolating raw estate names. Document the final name pattern and a
small mixed-source example in `.docs/api/readings.md`.

## Data

No Prisma table, migration, persisted export file or new package is needed.
Read existing DeviceReading, ManualReading, Asset and Device through Spring's
typed jOOQ queries. Reuse the same source/flag/filter projection as the list;
add the cursor-based export read path without fetching a List of every result.
Do not change existing ingestion, monitoring or manual-entry semantics.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/readings/export` | Optional assetId UUID, metric DeviceMetric, from/to offset date-times, repeated flag ReadingFlagType; no pagination | 200 streamed `text/csv; charset=utf-8`, attachment disposition | Owner/Manager/Crew, agreed |

Annotate the binary CSV media type explicitly in Spring OpenAPI and regenerate
the frontend contract. JSON failures use the existing EstateError DTO:
400 invalid filters, 401 signed out, 403 insufficient authority, 404 missing /
foreign estate or asset. Resource-exhaustion failures before streaming return a
clear retryable error rather than silently queueing unlimited export work.

Set `Cache-Control: private, no-store`. Expose Content-Disposition and
X-Export-Row-Count through CORS
if the generated client reads the server's filename. Keep export as an explicit
SecurityConfig path and authorize before committing CSV output. A mid-transfer
failure terminates the transfer; do not append a JSON error to a partial CSV
and present it as complete. `X-Export-Row-Count` is the complete matching count
from the same SQL snapshot, excluding the header. The browser incrementally
validates UTF-8, the fixed header, quoted record boundaries, column count and
final row count before creating a download. Truncated successful responses
therefore fail visibly. Test this transport boundary.

## Large exports and runtime boundaries

- Use a single SQL cursor with a read-only transaction on the actual streaming
  worker thread, a bounded fetch size and try-with-resources cleanup. Flag windows
  must still see the necessary full per-asset history before time/flag filtering.
- Do not load every reading into Java objects, StringWriter or a whole-file byte
  array. Flush output in reasonable batches. The browser may use a completed
  Blob for download; this does not imply constant-memory storage on the client.
- Configure/verify Spring MVC's streaming executor and timeout. Bound concurrent
  export work so downloads cannot consume the whole API connection pool.
- Check the Cloud Run deployment timeout and any application/database deadline.
  The workflow now declares Cloud Run `--timeout=300`. MVC allows 240 seconds;
  the streaming transaction allows 230 seconds. Two workers with zero queue
  and explicit admission return retryable JSON 503 when occupied. Each cursor
  fetches 512 records; output flushes every 128. Deployment changes take effect
  through the normal main-branch deployment, not a manual cloud update.
- Proposed acceptance workload: at least 100,000 matching mixed-source readings
  across assets, plus foreign-estate control data, completing within a 120-second
  warm server-side budget and below all configured request deadlines. Verify
  complete row count, order, memory behaviour and cancellation. Also exercise
  the expensive suspect-filter case and run a larger stress case to establish
  the practical boundary. Wall-clock timing is a reproducible opt-in benchmark,
  not a flaky normal-CI assertion.
- Verify a file over 32 MiB through a representative HTTP transport path where
  feasible; a local small mock response is insufficient large-export evidence.
- If the proposed workload cannot meet deployment limits, do not claim this
  criterion is complete, silently truncate or merely increase timeouts. Bring
  back a durable asynchronous-export proposal for agreement before adding job
  tables, storage or external services. This is the principal implementation risk.

Primary references checked while drafting:
[Spring StreamingResponseBody](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/servlet/mvc/method/annotation/StreamingResponseBody.html),
[Cloud Run request timeouts](https://docs.cloud.google.com/run/docs/configuring/request-timeout),
[Cloud Run response limits](https://docs.cloud.google.com/run/quotas).
Streaming does not remove Cloud Run's finite request deadline.

## Frontend and documentation

- Add the existing shadcn Button/Spinner/error feedback to the estate Readings
  header/actions area; keep mobile wrapping and the new record layouts intact.
- Add `lib/use-reading-export.ts`, using the generated client and React
  Query mutation lifecycle, with abort support and no automatic retry. Do not
  navigate to an unauthenticated raw download URL or attach bearer headers by hand.
- Share filter serialization with the existing browser so timezone conversion
  and suspect-filter mapping cannot drift. Do not send page/size to export.
- Keep the export request/filter snapshot separate from subsequent UI changes.
  Revoked access and account/estate changes cannot reuse a previous user's file.
- Update `.docs/api/readings.md`, `.docs/frontend/readings.md`, `.docs/README.md`
  and this spec in the implementation change. Include CSV column/null/escaping/
  timezone/decimal/source rules and parser examples for the model pipeline.
- Mark ID-64's CSV provenance requirement complete only after mixed-source
  export tests pass; do not change Jira status without a separate instruction.

## Edge cases and TDD

- Write and run failing server tests before adding the endpoint: permissions,
  foreign IDs, malformed filters, all matching rows beyond page size, zero rows,
  time boundaries, retired history and combined filters.
- Cover sensor/manual mixtures, missing recorder names, null device metadata,
  negative/zero/six-decimal values, UTC microseconds, commas/quotes/newlines,
  Unicode, spreadsheet-active labels and the fixed column order.
- Compare exported IDs/flags/order with the existing filtered-list semantics,
  including a sensor predecessor outside the requested time window and a
  duplicate timestamp shared by sensor/manual rows.
- Exercise concurrent new submissions against the export query snapshot,
  disconnect/cancel cleanup, pre-output error status and mid-output failure.
- Write failing web tests for authorization, exact filter capture without page,
  pending/repeat protection, cancel/error/retry and no stale download after
  account/estate changes. Observe each missing behaviour fail before implementing.
- Regenerate OpenAPI; run combined tests, types, formatting and web build.
  Browser-check an actual CSV file against filters at desktop/320/375px and the
  supported real roles. Use disposable data for load tests; any persistent demo
  export must stay on the already-authorized Neon child branch.

## Implementation phases

- [x] Agree export permissions: Owners, Managers and Crew.
- [x] Agree the remaining draft, including the streaming workload.
- [x] Server tests first; implement shared filtered export query and CSV writer.
- [x] Streaming/security/cleanup tests first; implement endpoint and runtime bounds.
- [x] Generate API contract and fix frontend types.
- [x] Web tests first; implement export/cancel/error UI using current filters.
- [x] Update built documentation and verify large-data/HTTP/browser behaviour.
- [x] Complete required checks; leave code uncommitted for the human.

## Dependencies and out of scope

- ID-60 provides filters/read permission; ID-63/64 provide unified readings and
  provenance. These are available locally; prior changes are currently staged.
- No dependency on CSV import, aggregation, retention, model training, document
  extraction or verification stories. This exports authorized estate data;
  cross-estate anonymized training pooling is a separate story.
- No CSV import, charts, custom metrics, new source filter, saved export history,
  scheduled exports, public file links, job queue or new storage bucket in this
  first implementation. Legacy owner-only asset history is unchanged.

## Confirmed scope

The user approved implementation on 2026-10-28, including the proposed large-data
acceptance target. No remaining product questions block implementation.


## Verification evidence — 2026-10-28

- TDD: the initial server run had 13 expected failures among 16 cases before
  the endpoint existed; the initial 14 web cases failed before the export UI
  existed. Additional failing cases covered the completion header and busy
  executor response before those behaviours were implemented.
- The focused suite now passes 20 server integration cases and 15 web cases.
  Coverage includes mixed-source/flag parity, exact filter boundaries, scope and
  permissions, quoted Unicode/multiline fields, incomplete bodies, cancellation,
  concurrent insertion snapshots, retry and connection cleanup.
- Disposable Postgres, real HTTP: 100,000 mixed readings / 44,642,742 bytes in
  4.801 seconds. Final larger run: 1,000,000 / 446,426,066 bytes in 13.282 seconds;
  its suspect-only export returned 27,272 / 11,672,552 bytes in 5.022 seconds.
  Both complete counts matched. Cancelling the real HTTP response released
  the worker and pooled connection. Timings are local evidence, not a production
  latency guarantee. The opt-in benchmark is documented in the frontend guide.
- Live ordinary localhost app on the authorized Neon child branch: all 110 demo
  readings downloaded (100 sensor / 10 manual). Pressure (25), empty suspect
  pressure (0), suspect (7) and combined asset/metric/time/suspect (1) exports
  matched the full CSV's IDs, flags and order exactly. Blocking just the export
  request produced readable feedback and no file; an explicit retry succeeded.
- The authenticated Crew session downloaded a valid header-only export for its
  empty estate; Resident and Council readings routes showed Page not found with
  no export control. Owner export passed on the labelled demo estate.
- Desktop 1280px and mobile 320/375px checks showed no horizontal page overflow.
  No new Neon records were created by CSV QA; existing demo records remain.
- Spring's running `/v3/api-docs` supplies the generated contract. The uncached
  springdoc Maven export plugin cannot be downloaded under the no-install rule;
  the runtime export uses the same annotated application without that plugin.
- Final combined regression passed: 1,469 normal server tests and 864 web tests
  (31 Nx tasks, cache bypassed). Nx initially exhausted memory while reading a
  305 MiB generated Maven hash file, before tests started. `pnpm nx reset`
  cleared generated metadata only; the full command then passed in 3m21s.
- Final workspace types, `pnpm fix` and production web build passed. Refactoring
  the parser state initialization avoided a Biome false positive without
  changing validation; its 15 focused cases passed again afterward. Biome still
  reports its generated-schema type-budget warning, and the build retains the
  CSS sourcemap warning; both commands exit successfully.
- Final non-owner Manager live export passed as well. No database migration is
  needed for ID-61. CSV changes remain unstaged over the human-staged ID-63/64
  work; nothing was committed or pushed.


### Excel encoding correction — 2026-10-28

The downloaded UTF-8 data contained correct `°C` bytes, but Excel opened the
BOM-free file as a legacy encoding and displayed `Â°C`. The user approved one
leading UTF-8 BOM. A new endpoint test was run and failed on the missing bytes
before adding the marker. The CSV test reader and empty-result expectation now
follow this agreed format correction; byte-preservation browser tests cover
both empty and mixed-data downloads, with the marker split across chunks.
Python ingestion documentation now uses `utf-8-sig`. All 21 CSV endpoint tests
and 17 web export tests pass. The full uncached workspace run passes 1,470 server
and 866 web tests. Formatting and types pass. A live download from the normal
localhost app preserved all 110 demo readings, started with EF BB BF, and
contained `°C` with no `Â°C`. Existing downloaded files need to be downloaded
again; no database change is required.
