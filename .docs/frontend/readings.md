# Readings (frontend)

Estate-wide and per-asset sensor readings with suspect-data flags. Paths are
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
| `reading-table.tsx` | Contained scrolling, time, asset labels, metric, value/unit, device and flag Badges |

Filters stack on mobile; long labels wrap without widening the page. Both estate-wide and legacy tables use auto-height, width-bounded flag badges with wrapping, left-aligned text and a readable line height; long flag labels stay inside their borders. Both Flags columns reserve a minimum width so labels remain readable on mobile; the table scrolls within its own region. Browser checks cover 1280, 375 and 320 px. Crew rows
do not link to owner-only asset pages. The screen adds no mutations.

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

The browser QA server uses a controlled JWT subject with real database-backed
role guards; frontend WorkOS sign-in is real. This checks role-specific feature
behaviour, not live WorkOS membership provisioning. It does not load the regular
Infisical WorkOS management API key, so Pending invitations can show WorkOS is
not configured in this isolated setup. R2 is disabled and Neon is untouched.

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
7. At 320/375 px check long labels, stacked filters, table-local scrolling,
   dialog options/paging, keyboard focus/selection and Escape.

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
| `ReadingsPage` (`readings-page.tsx`) | "Back to asset" link; `PageHeader` "Readings" with breadcrumbs Estates / estate name / Assets / asset name / Readings (from `useEstate`, `useAsset`) and description "Sensor readings for this asset, newest first. Suspect readings are flagged."; the filters; "Loading readings…" (`role="status"`) while pending; errors as a destructive alert. Table `aria-label="Readings"`, columns Measured (`toLocaleString`), Metric (catalogue name), Value (`{value} {unit}`), Device (`deviceIdentifier`), Flags (one outline badge per flag). Pagination `nav` "Pagination": "Page {n} of {pages} · {total} reading(s)", "Previous page" (disabled on the first page) and "Next page" (disabled on the last). | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `Badge`, `Button`, `Alert`, `AlertDescription`, `Empty`, `EmptyHeader`, `EmptyTitle` |
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
