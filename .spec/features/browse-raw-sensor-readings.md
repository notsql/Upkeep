# Browse raw sensor readings

**Status:** implemented — automated, browser and performance verification passed
**Owner:** Chan Ding Jie
**Jira:** [ID-60](https://notjira.atlassian.net/browse/ID-60)
**Estimate:** provisionally 2 points; verify after assessing the agreed access changes

## Problem

A technician needs to investigate measurements across an estate without writing
SQL or opening each asset separately. ID-67 already provides a per-asset reading
browser, but it does not provide the cross-asset filter or performance evidence
required by ID-60. Its API also requires estate ownership, whereas this story
names a technician as the user.

Initial planning audit: `feat/work-order-document-association` at `05faa2c` on
2026-10-27, with a clean working tree before this draft. On the same date,
fetched origin, fast-forwarded local `main`, and created the dedicated branch
`feat/browse-raw-sensor-readings` at `8cfbababf7a1b76483052d1e51de07287d535ca7`.
This matches the fetched `origin/main`: PR #42 (ID-50 maintenance costs), also
including ID-26, device replacement, inspection results and maintenance history.
The uncommitted draft and index entry were preserved without a stash or commit.
The existing per-asset reading browser, its query service/repository and its
documentation are unchanged between the audit commit and this new base;
device-ingestion changes from device replacement are now included in the base.

## Existing implementation and acceptance gaps

| Jira acceptance criterion | Existing evidence | Remaining work |
| --- | --- | --- |
| Combine asset, metric and start/end filters | Asset is fixed by the existing URL; metric and time filters combine | Estate-wide screen with an optional asset filter |
| Paginate and order by timestamp | Server sorts `measuredAt DESC, id DESC`; page/size and matching totals exist | Preserve ordering/counts across assets and reset pagination on filter changes |
| Acceptable performance for one month of one sensor's readings | `(assetId, metric, measuredAt)` index exists; no month-sized benchmark identified | Agree a measurable target and record a disposable-database benchmark |
| Clear empty/no-match states | Existing per-asset screen distinguishes no readings, no filter matches and no suspect matches | Equivalent estate-wide states, validation and recovery |

Existing sources: `.spec/features/suspect-readings.md`, `.docs/api/readings.md`,
`.docs/frontend/readings.md`, `AssetReadingService`, `AssetReadingRepository`,
`AssetReadingIntegrationTests`, and the existing readings web tests.

## Behaviour

### Access — role policy agreed on 2026-10-27

- The agreed policy allows an estate's Owner, Manager and Crew to
  read its sensor readings. Crew represents the technician named in the story.
- This grants read-only readings access and the minimum asset labels needed for
  filtering; it does not grant access to the asset register, editing, costs,
  credential secrets or other management data.
- Resident, Council and custom-role memberships do not gain access implicitly.
  There is currently no readings permission in the custom permission catalogue;
  adding one is a separate decision, not a dependency on ID-95.
- A proposed `canViewReadings` access projection drives navigation and route
  guards. The server checks current estate membership independently of the UI.
- Unauthenticated requests return 401; non-members/missing estates return 404;
  same-estate roles without readings access return 403. Browser guards use the
  application's Page not found behaviour for unavailable estate features.
- Existing owner-only asset APIs remain owner-only. The legacy per-asset reading
  endpoint retains its current access contract; broader technician access uses
  the new estate screen and endpoints.
- Historical readings remain readable for retired assets and inactive estates
  under the same reading-access policy. Reading this screen writes no data.

### Browsing and filtering

- The estate Readings screen defaults to all of the estate's recorded sensor
  readings, newest measured time first; descending reading ID breaks ties.
- A searchable asset selector offers All assets and same-estate asset names and
  references. It includes retired assets with a clear label, so history remains
  selectable. Asset options are paginated/searchable on the server.
- Each row shows measured time, asset name/reference, metric, value with unit,
  device identifier and the existing suspect-reading badges.
- Optional asset, metric, start and end filters combine before pagination and
  before the matching total is calculated. Start is inclusive and end exclusive.
  Either end of the time range may be omitted.
- Preserve ID-67's optional Suspect only filter. Flag calculations remain scoped
  to each asset and metric; readings on different assets never create a gap or
  duplicate-timestamp flag together. Time filters must not hide the predecessor
  needed to determine a gap.
- Filters and page live in the URL; reload and browser back/forward restore the
  view. Changing a filter resets to page zero and preserves scroll. Rapid edits
  merge into the latest URL state rather than overwriting pending filters.
- Pagination uses 50 rows by default, a server maximum of 200, Previous/Next
  buttons and a matching total. Following the user’s pagination refinement,
  clickable page numbers highlight the current page, retain the first/last
  pages and use non-interactive ellipses for skipped ranges. Small result sets
  show every page; longer lists show an edge window or the current page and
  its neighbours. Jumps retain filters, use the URL and preserve scroll; all
  navigation is disabled while placeholder rows are displayed. Controls wrap
  within narrow screens. These are live results, not a snapshot across
  concurrent sensor submissions.
- Browser-local date/time inputs convert to UTC for requests. Invalid dates or
  a start not before the end produce readable field feedback without a broken
  query or a silent unfiltered request. The API independently returns 400.
- Existing per-asset reading bookmarks remain usable. Asset detail pages gain
  an entry to the estate browser prefiltered to that asset. Do not broaden asset
  detail access merely to make the new screen work for Crew.

### Feedback and responsive layout

- Distinguish no assets, no readings yet, no filter matches and no suspect matches.
- Show initial loading and an accessible refresh indicator. Keep current results
  visible during same-scope filtering/pagination, with their loading state clear;
  never retain another user's or estate's rows during a context change.
- A failed request shows an error with Retry rather than an empty-success state.
- Use existing shadcn controls, table, badges, alerts and pagination buttons.
  Filters stack on mobile and any table overflow is contained in the table.
  Long asset/estate names do not widen the page; keyboard access remains usable.

### Performance — agreed acceptance target

- Use a migrated disposable Postgres database with 30 days of one reading per
  minute for one device/metric: 43,200 readings. Include another asset/estate as
  distractor data to exercise correct scoping.
- After application/database warm-up, the complete paginated
  HTTP response, including the total and existing flags, has p95 <= 2 seconds
  over at least 10 requests in the documented local test environment.
- Measure the first page and a deep page for the selected asset/month, and
  repeat with Suspect only. Check that the estate-wide first page is practical
  on the same fixture. Record browser usability separately; exclude process
  startup and deployment cold starts from this query target.
- Record baseline timings and query plans before optimizing. Optimize only a
  demonstrated bottleneck and preserve all flag/filter semantics.
- Keep timing measurements separate from ordinary functional CI assertions;
  shared runners must not fail because of an arbitrary fixed wall-clock delay.
  Record dataset, machine/environment, sample count and results for review.

## Data

- Read existing `DeviceReading`, `Device`, `Asset`, `Estate` and membership data.
- No new reading model, provenance fields, backfill or migration is expected.
- Keep queries estate-scoped in SQL. Asset selection must not be authorized
  solely by the supplied asset ID or browser state.
- Reuse existing indexes initially. If measurements show an additional index is
  necessary, propose the exact Prisma/index migration before applying it. Do not
  introduce stored flags or redesign ingestion speculatively.
- No packages need to be installed. Benchmarks use disposable databases, not
  thousands of synthetic records in the shared Neon database.

## API

Proposed additions under the agreed Owner/Manager/Crew read-only role policy.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/readings` | `assetId?`, `metric?`, `from?`, `to?`, repeated `flag?`, `page?=0`, `size?=50` (1–200) | `EstateReadingPage` | Approved readings policy |
| GET | `/estates/{estateId}/readings/assets` | `search?` (name/reference), `page?=0`, `size?=50` (1–200) | `ReadingAssetOptionPage` | Same policy; minimum asset metadata only |
| GET | `/estates/{estateId}/assets/{assetId}/readings` | Existing metric/time/flag/page/size queries | Existing `AssetReadingPage` | Existing owner-only contract retained |

- `EstateReadingPage { items: EstateReadingResponse[], page: int32, size: int32, totalItems: int64 }`.
- `EstateReadingResponse`: existing reading fields (`id`, `measuredAt`, `metric`,
  `unit`, `value`, `deviceId`, `deviceIdentifier`, `flags`) plus `assetId: uuid`,
  `assetReference: string`, `assetName: string`. Time, decimals and flag DTOs
  retain their existing meanings. Do not return costs or device credentials.
- `ReadingAssetOptionPage { items: ReadingAssetOption[], page: int32, size: int32, totalItems: int64 }`.
- `ReadingAssetOption { id: uuid, reference: string, name: string, retired: boolean }`.
- 200 for valid lists, including empty lists; 400 for malformed filters or
  pagination; 401/403/404 as described above. A selected unknown/foreign asset
  returns 404; a valid same-estate asset with no readings returns an empty page.
- New endpoints return real Java DTOs and enter `SecurityConfig` explicitly.
  Regenerate OpenAPI and TypeScript; do not hand-write frontend API types.

## Frontend

- New folder route: `apps/web/src/routes/_auth/estates/$estateId/readings/index.tsx`.
  Route-only components live in its `-components/` directory.
- Breadcrumbs: Estates / estate name / Readings. Add a capability-gated estate
  Readings entry and preserve that feature when switching to another permitted
  estate. Keep the established Resident fallback to estate-filtered My reports.
- Keep the existing per-asset route. Reuse reading display/filter logic where
  appropriate without a broad component refactor.
- Extend `apps/web/src/lib/readings.ts` with generated-contract queries. Query
  keys include user, estate, selected asset and all active filters/page. Gate
  requests on session/access readiness and avoid unauthorized asset-detail calls.

## Edge cases

- Equal measured times across assets/devices: deterministic ID tie-breaker.
- Invalid dates, equal/reversed bounds, timezone offsets and malformed URLs.
- Asset moved/retired or device reassigned: reading stays against its recorded
  asset, and the device's current asset must not rewrite history.
- Historical predecessor outside the selected month still determines a gap.
- Duplicate timestamps on different assets must not become duplicate flags.
- A requested page beyond the last page shows recovery to page one, not the
  misleading claim that the estate has never recorded readings.
- Permission revoked or account/estate switched with cached/in-flight requests:
  old scoped rows are not shown under the new context.
- Retired assets, identical asset names, very long names and no matching options.
- New live readings may shift offset pages; no snapshot guarantee is claimed.

## Implementation and TDD plan

1. Agree the remaining draft and performance target; the read-only role policy
   is already agreed. Base synchronization and dedicated branch creation are
   complete as recorded above. Recheck the branch/working tree before coding.
2. Audit/run existing reading and flag tests as a baseline. Run the disposable
   month-sized benchmark and retain actual results before query changes.
3. Add and run failing server tests for cross-asset listing, combined filters,
   totals/ties, asset-options search, estate isolation and the agreed role matrix.
   Implement each missing behaviour only after observing its failure. Reuse
   existing passing tests; do not duplicate them to inflate coverage.
4. Preserve/retest ID-67 flag semantics across multiple assets and month
   boundaries. If performance misses the agreed target, capture that failure,
   make the smallest justified optimization and remeasure.
5. Regenerate the API contract. Write/run failing web tests for asset selection,
   filter/page URL behaviour, validation, loading/error/retry states, capability
   navigation, switching contexts and preselected entry from an asset.
   Implement using existing shadcn components.
6. Update `.docs/api/readings.md`, `.docs/frontend/readings.md`, relevant access/
   shell documentation and their indexes. Record performance evidence and manual
   checks; mark this spec built only when acceptance criteria actually pass.
7. Run focused tests, `pnpm check-types`, `pnpm fix`, the normal full `pnpm test`
   and an appropriate web build through Nx. Inspect compiled/reported tests if
   stale Maven/Nx output recurs; do not weaken test expectations.
8. Browser QA: combine asset/metric/time filters, next/previous/back/reload,
   empty/error states, multiple roles/estates, 320/375 px mobile layouts and
   keyboard navigation. Do not seed the shared database without authorization.

## Out of scope

- Manual readings (ID-63), provenance (ID-64), CSV export/import (ID-61/62).
- Hourly aggregates, retention, anomaly changes and new flatline rules.
- Editing/deleting readings, live streaming, charts and additional sort controls.
- Device authentication, new custom permission creation, asset-register access
  redesign, contractor routing and document/OCR work.

## Agreed decision

The user selected Owner/Manager/Crew read-only readings access on 2026-10-27.
This includes the minimum asset labels required for filtering, without granting
asset-register or editing access. Broader Council/custom-role access is not
part of this approval.

The user authorized implementation of the remaining plan on 2026-10-27,
including the following decisions.

## Agreed implementation decisions

1. **Performance:** use the 43,200-row fixture and warm HTTP p95 target of
   2 seconds. This supplies the missing meaning of Jira's "acceptable time";
   it is a local acceptance target, not a deployment SLA.
2. **Asset filter:** estate-wide All assets plus one optional asset,
   consistent with ID-67 explicitly deferring cross-asset filtering to ID-60.
   Multi-select assets and additional reading sources are separate scope.


## Verification record (2026-10-28)

- Normal Nx `pnpm test`: 1,420 server and 818 web tests passed. Workspace types,
  lint/formatting and production web build passed. No database migration or
  dependency change was needed. All changes remain uncommitted.
- TDD evidence: existing 45 reading/flag tests passed; the new HTTP suite failed
  with 27 genuine missing-feature failures before implementation and later
  passed with the existing suites (74 focused tests). An initial timestamp
  fixture error was corrected separately without weakening assertions.
- New route, navigation, URL validation and reading-screen tests failed before
  implementation. Permission-revocation cache and overlapping URL-edit regressions
  were observed failing and then fixed. The browser reproduced the lost From
  filter before the URL merge fix and retained the combined range afterward.
- The original month-sized query exceeded a 20-second statement timeout.
  Indexed predecessor lookups preserve ID-67 flag semantics and meet the agreed
  target in both the opt-in benchmark and real browser HTTP checks. See
  `.docs/frontend/readings.md` for measurements and reproduction.
- Isolated browser QA passed Owner/Manager/Crew reads, Resident/Council denied
  URLs, scoped Resident history fallback, estate switching, legacy Owner links,
  retired asset selection, keyboard metric selection, combined time/suspect
  filters, invalid-range feedback, Back/reload and page recovery. Layout checks
  covered 320/375 px and a 320x568 asset dialog. These use disposable role
  fixtures with real feature authorization, not live membership provisioning.
- Browser geometry caught clipped flag labels and missing shared page insets.
  Auto-height badges and the shared `page-layout` corrected the observed
  failures. The latest user follow-up requested consistent flag styling in
  both legacy and estate views; both now use bounded wrapping, auto height and
  readable line spacing. The final browser regression also caught the legacy
  Flags column squeezing a label to 268 px high at a 320 px viewport. A failing
  browser assertion preceded the minimum-width fix. Both views now pass at
  1280/375/320 px: labels fit their borders, the mobile label is 37 px high,
  and the page has no horizontal overflow (tables scroll within their region).
- Numbered-pagination follow-up: six new screen tests failed before controls
  existed, then passed with page jumps preserving filters, bounded start/middle/end
  windows, one-page results and placeholder navigation disabled. A temporary
  preview rendered the real component with application CSS; actual browser clicks
  reached page 100 and page one while retaining the metric. At 1280/375/320 px,
  every button stayed within the viewport with a 44 px height. The preview used
  no database or authentication fixtures and was stopped after verification.
- `pnpm api:generate` was attempted offline; its declared springdoc Maven plugin
  1.5 is uncached. The actual Spring OpenAPI was exported using runtime classes
  plus disposable-database configuration, with R2 disabled, then TypeScript was
  generated through the existing Nx target. Existing JSON key order and canonical
  server metadata were retained. Semantic comparison confirms exactly two new
  GET paths, four DTO schemas and `canViewReadings`; existing endpoint contracts
  are unchanged and no test-only endpoint is included. Temporary launchers and
  browser helpers are outside the repository.
