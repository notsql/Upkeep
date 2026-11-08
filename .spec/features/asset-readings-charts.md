# Asset readings charts and overview formatting

**Status:** built and verified 2026-11-08
**Owner:** Ong Zheng Kai

Follow-up to [streaming-anomaly-detection.md](streaming-anomaly-detection.md),
whose "Out of scope" excluded charts of readings or scores.

## Problem

A pump fed at 1 Hz by the device simulator produces five readings a second,
and the asset overview (`assets/$assetId/_details/index.tsx` ->
`-components/asset-overview/`) cannot show what that data is doing:

- **No charts.** A person cannot see a trend, or where the model found an
  anomaly, without reading rows one by one. Model findings exist only as
  `ANOMALY` badges on individual rows.
- **The Readings card is a flat list.** "The latest 50 readings" is one row
  per metric per timestamp, so one second is spread over five rows and 50 rows
  cover about 10 seconds. The Asset column repeats the asset's own name on its
  own page, and the Device column repeats the same identifier.
- **Formatting is raw and inconsistent.** Values show whatever precision the
  decimal has (`0.33689 kW`, `-0.273216 bar`, `32 L/min`). Instants use
  `toLocaleString()` (`07/11/2026, 21:01:57`). Date-only values show as ISO
  (`assessed 2026-11-07`, `Installation date 2026-11-07`,
  `Expected end of life: 2041-11-07`). Model assessment notes embed raw ISO
  instants (`from 2026-11-07T12:59:15.862Z to 2026-11-07T12:59:25.862Z`).
- **The forecast badge is unclear.** "Flagged for a check: Condition" does not
  say which condition, or who recorded it. It means the current condition is
  Needs attention or Faulty (`FailureRiskService`, the `CONDITION` reason).

There is no endpoint that can feed a chart: the reading endpoints are
paginated tables, capped at 200 rows a page, and a day at 1 Hz is 86,400
readings per metric.

## Behaviour

### Shared formatting (`apps/web/src/lib/format.ts`)

One module, built only on `Intl.DateTimeFormat`, `Intl.NumberFormat` and
`Intl.RelativeTimeFormat`. Locale and time zone are the browser's (`undefined`
locale, resolved time zone); tests pass an explicit locale and `timeZone` so
they are deterministic. Formatter instances are cached per locale/options.

- `formatDate("2026-11-07")` formats a date-only `YYYY-MM-DD` as a medium date
  (en-SG: "7 Nov 2026"). It is parsed as a calendar date and formatted with
  `timeZone: "UTC"`, so it shows the same day in every time zone, including
  UTC-10 and UTC+14.
- `formatDate` given anything other than a valid `YYYY-MM-DD` returns the input
  unchanged (never "Invalid Date").
- `formatDateTime(instant)` formats an ISO instant as a medium date plus a
  time with seconds, in the user's time zone (en-SG, Asia/Singapore:
  "7 Nov 2026, 9:01:57 pm").
- `formatTime(instant)` is the time-only form with seconds, used inside a
  grouped readings table and on the chart axis when the range is under 24 h.
- `formatRelative(instant, now)` gives `Intl.RelativeTimeFormat` text with
  `numeric: "auto"`, choosing seconds, minutes, hours or days ("2 min ago",
  "yesterday"). It is used only alongside an absolute time (the absolute time
  is always in the `<time>`'s `title` or visible text), never alone.
- `formatMetricValue(metric, value)` formats a reading value with the metric's
  precision and unit:

  | Metric | Precision | Unit |
  | --- | --- | --- |
  | TEMPERATURE | 1 fraction digit | `style: "unit", unit: "celsius"` ("68.4°C") |
  | PRESSURE | 2 fraction digits | "bar" (fallback) |
  | FLOW_RATE | 1 fraction digit | "L/min" (fallback) |
  | VIBRATION_ACCELERATION | 3 significant digits | "g" (fallback) |
  | VIBRATION | 2 fraction digits | "mm/s" (fallback) |
  | POWER | 2 fraction digits | "kW" (fallback; kilowatt is not a sanctioned unit) |
  | ENERGY | 1 fraction digit | "kWh" (fallback) |
  | HUMIDITY | 0 fraction digits | `unit: "percent"` ("55%") |

  Fraction-digit metrics use `minimumFractionDigits = maximumFractionDigits`,
  so a column lines up (`32.0 L/min`, never `32 L/min`). Units not in the
  ECMA-402 sanctioned list use `Intl.NumberFormat` for the number and append
  the catalogue unit from `deviceMetrics` after a space. A negative value keeps
  its sign (`-0.27 bar`).
- `formatMetricValue` shows the value the server returned for display:
  `valueText` when present (manual exact decimals) is parsed as a number for
  formatting; the full stored value stays available in the cell's `title`
  and in CSV export.
- `formatScore(score)` gives 2 fraction digits ("0.87"). `flagLabel`'s
  "Anomaly 0.87" and out-of-range limits use `format.ts` instead of
  `toFixed`/`toLocaleString`.
- Every date, instant and number on the asset overview goes through
  `format.ts`. No `toLocaleString`, `toLocaleDateString` or `toFixed` remains
  in the files under `assets/$assetId/-components/asset-overview/`,
  `components/readings/` or `lib/readings.ts`. Other screens are not changed
  (see Out of scope).

### Model assessment notes

Decision: **format on the client, keep the stored text unchanged.**

- Assessments are append-only (decision 0017); old model notes already hold
  ISO text and cannot be rewritten. A server-side change would only help new
  rows and would need a schema change for structured fields. Parsing the one
  fixed template the server writes fixes old and new rows with no server,
  schema or contract change.
- `formatAssessmentNotes(assessment)` applies only when `recordedByUserId` is
  `system:anomaly-model`. It replaces each ISO-8601 instant in the notes
  (`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z`) with `formatDateTime`, and
  when both instants fall on the same local day, the second with `formatTime`.
  Example: "11 consecutive abnormal samples in device readings from
  7 Nov 2026, 8:59:15 pm to 8:59:25 pm. Median score 0.82, maximum 0.88."
- Notes recorded by a person are shown exactly as typed.
- Notes with no matching instant are shown unchanged.
- The server's note template (`AnomalyScoringService.assess`) is not changed.
  A server test pins its format so the client parser cannot silently drift.

### Condition card

- The current condition and each history entry show "Assessed 7 Nov 2026"
  (`formatDate`), not ISO.
- "Recorded by Anomaly detection · 7 Nov 2026, 8:59:26 pm (2 min ago)": the
  recorder, `formatDateTime(recordedAt)` and, when under 7 days old,
  `formatRelative` in muted text. The `<time>` carries the ISO `dateTime`.
- A model-recorded entry shows a `Badge variant="outline"` "Anomaly detection"
  next to its condition, so the source is visible without reading the footer.
- Model notes go through `formatAssessmentNotes`.

### Breakdown forecast card

- The `CONDITION` reason reads "Condition: Needs attention" or
  "Condition: Faulty", using the current assessment's condition label from
  `useAssessments` (already cached by the Condition card), followed by
  "· Anomaly detection" or "· <recorder name>" when known.
- If the assessments query is still loading or failed, the badge reads
  "Condition needs a check" rather than a bare "Condition".
- The lead-in reads "Flagged for a check because:" instead of
  "Flagged for a check:". `FAILURE_RISK` and `END_OF_LIFE` keep their labels.
- "Expected end of life" shows `formatDate`, or "Not recorded".
- Probabilities use `Intl.NumberFormat` `style: "percent"`, 0 fraction digits
  (unchanged output, "12%").

### Details card

- "Installation date" shows `formatDate(installedOn)` or "Not recorded".

### Readings chart (new card on the overview)

- A "Trends" card appears above the Readings card for viewers who can view
  readings (`permission.canViewReadings`), on any asset with at least one
  device.
- Range is a shadcn `Tabs` list with exactly **1 min**, **15 min**, **1 h**,
  **24 h**; default **1 min**. The range ends at
  "now" when the query runs. The chosen range is component state, not URL
  state.
- **One small chart per metric**, stacked (a grid of two columns at `md` and
  wider, one column on mobile), showing only the metrics the series response
  contains, in catalogue order. No metric selector: five pump metrics fit on
  one screen, and seeing them together is how a person relates an anomaly to
  the metric that moved.
- Each chart is a shadcn `ChartContainer` (recharts `AreaChart`/`LineChart`):
  an `avg` line, and a light band from `min` to `max` per bucket.
- Each chart's title is the metric name and unit ("Temperature (°C)"), and
  shows the latest bucket's `avg` via `formatMetricValue`.
- At 1 min every bucket is 1 s, so each point is one raw sample
  (`min = max = avg`, `count = 1`) and no min-max band is drawn.
- The x-axis uses `formatTime` for ranges under 24 h and a short
  `Intl.DateTimeFormat` day + hour for 24 h. The y-axis uses
  `Intl.NumberFormat` with the metric's precision. Both axes are labelled
  (y-axis by the unit).
- The tooltip shows the bucket's start time (`formatDateTime`), avg, min and
  max (`formatMetricValue`), the sample count, and "Anomaly score 0.87" when
  the bucket has one.
- **Anomalies:** every bucket whose `maxAnomalyScore` is at least 0.51
  (`AnomalyModel.DECISION_THRESHOLD`, returned by the API as
  `anomalyThreshold`, never hard-coded in the web app) is shaded as a
  destructive-coloured `ReferenceArea` spanning that bucket on every metric's
  chart. Adjacent abnormal buckets merge into one band. Buckets below the
  threshold or with no score are not shaded.
- Shading is never the only signal: a legend item "Anomaly (score ≥ 0.51)"
  names it, and the accessible summary below lists the periods.
- Buckets with no readings are gaps in the line (`connectNulls={false}`), so a
  device outage is visible rather than interpolated.
- **Accessibility:**
  - Each chart is a `figure` with a `figcaption` (metric name and range), and
    the SVG is `aria-hidden`.
  - Each figure has a visually hidden (`sr-only`) summary: latest value,
    min and max over the range, and the anomaly periods
    ("Anomaly from 8:59:15 pm to 8:59:25 pm, maximum score 0.88").
  - A "Show as table" `Button` under the card toggles a shadcn `Table` of the
    buckets (time, then avg/min/max per metric, then max anomaly score). The
    table is what screen-reader and keyboard users can explore.
  - Colours come from the shadcn chart CSS variables (`--chart-1`... and
    `--destructive`), so they follow light and dark themes.
- **Background refresh:** on every range, the series query and the grouped
  readings query refetch every 60 s (`refetchInterval: 60_000`). Refetching
  keeps the previous chart and rows (`placeholderData`) and moves the window
  to the new "now".
- **Live:** a "Live" shadcn `Switch` with a visible `Label` sits beside the
  range tabs.
  - It is enabled only on **1 min** and **15 min**. On **1 h** and **24 h** it
    is `disabled` with the description "Live is available for 1 min and
    15 min".
  - While on, the series query and the grouped readings query refetch every
    1 s (`refetchInterval: 1_000`).
  - Changing the range to 1 h or 24 h switches Live off; switching back does
    not turn it on again. Live starts off on every page load (component
    state).
  - Polling of any kind stops while the tab is hidden
    (`refetchIntervalInBackground: false`, React Query's default) and resumes
    when it is visible again.
  - A request in flight is not duplicated: React Query does not start another
    refetch for the same key until the previous one settles.
- **Live accessibility:** the Switch renders `role="switch"` with
  `aria-checked`, its accessible name is "Live", and it is keyboard-operable
  (Space). Refetches never announce: the charts and table have no
  `aria-live` region, and only the Switch's own state change is announced. A
  muted "Updated 9:01:57 pm" (`formatTime`) text next to the switch, outside
  any live region, shows the last refresh.
- **Server load of Live.** One viewer with Live on makes two requests a
  second. At 1 min the series query reads at most 300 device rows (5 metrics x
  60 s) and 60 scores; at 15 min, 4,500 rows and 900 scores, both as index
  range scans. The grouped query reads at most 100 rows plus 20 scores. This
  is acceptable because Live is limited to these two short windows, stops in
  hidden tabs, is opt-in per viewer, and the POC has a handful of viewers.
  Long ranges, where each query aggregates up to 432,000 rows, poll only every
  60 s.
- **States:** loading shows `Skeleton` blocks the size of the charts; an error
  shows `ErrorState` with "Retry trends"; a range with no readings shows
  `EmptyState` "No readings in the last 1 hour" with the range named. The
  range tabs stay usable in every state.

### Readings card (grouped)

- Title "Latest readings". Description "Grouped by time, newest first.".
- The card calls the new `getAssetReadingGroups` endpoint (see API) with the
  default `limit` of 20 and no `before`. Grouping is done on the server, so a
  group is never cut off by a page boundary.
- One row per group. A group is a `(measuredAt, source, device)`: one row per
  device per timestamp, and one row per manual timestamp and recorder. Device
  and manual readings at the same instant are separate rows, so provenance
  never mixes.
- The card shows no pagination. `nextBefore` is not used by this screen.
- Columns: **Time** (`formatTime`, with the date as a separate group heading
  row whenever the local day changes, and `formatDateTime` in the cell's
  `title`), then one column per metric present in the fetched readings, in
  catalogue order, headed "Temperature (°C)", then **Source**, then **Flags**.
  The metric columns are the union of `metrics` across the returned groups.
- No Asset column. No Device column when every reading in the page comes from
  the same device; otherwise the device identifier shows in the Source cell
  ("Device · Test" / "Manual · Alice Tan").
- A cell is the value via `formatMetricValue` with no repeated unit (the unit
  is in the header). A metric absent at that timestamp shows "—" with
  `aria-label="No reading"`.
- **Per-reading flags stay on their cell:** `OUT_OF_RANGE`, `GAP` and
  `DUPLICATE_TIMESTAMP` show as a small outline `Badge` under the value, with
  the existing `flagLabel` text in a `Tooltip` and in the badge's accessible
  name ("Out of range (valid 0 to 25 bar)").
- **Row-level flags go in Flags:** `ANOMALY` is per sample (all five readings
  carry the same score), so it shows once per row as the destructive
  "Anomaly 0.87" badge. A row with no flags shows nothing in Flags.
- Rows whose sample is anomalous are also marked with
  `aria-describedby` to the anomaly badge, not by background colour alone.
- Mobile (below `md`): the table scrolls in its own region (existing
  `Table` container), and the Time column is sticky.
- `ReadingTable` and `ReadingCards` on the estate readings page are
  **unchanged**; the grouped table is a new component used only by the
  overview.
- Actions stay: "Record manual reading" (with `canRecordReadings`) and
  "View all readings".
- States: `LoadingState` table, `ErrorState` "Retry readings", `EmptyState`
  "No readings yet" (unchanged wording).

### Overview layout

- Order: Details, Condition, Breakdown forecast (owners, pumps), Trends,
  Latest readings, Devices.
- Details becomes a two-column `dl` (one column on mobile) inside a `Card`
  with a title "Details", so it has the same heading hierarchy as the other
  cards (`h2` per card).
- Condition and Breakdown forecast sit side by side at `lg` and wider, stacked
  below.
- Only shadcn components from `packages/ui` (Card, Badge, Tabs, Table,
  Tooltip, Skeleton, Button, Empty, Alert, Chart, Switch, Label) plus Tailwind utilities on
  them. No new CSS classes in `apps/web`.
- Components added for this screen live in
  `assets/$assetId/-components/asset-overview/` (rule 8): `trends-card/`
  (card, per-metric chart, accessible table) and `grouped-readings/`.

## Data

No schema change and no migration.

Read, unchanged: `DeviceReading`, `ManualReading`, `AnomalyScore`, `Device`,
`Asset`.

Indexes checked against `packages/db/prisma/schema/schema.prisma`:

- `DeviceReading @@index([assetId, metric, measuredAt])` exists. The series
  query filters `assetId = ? AND metric = ANY(?) AND measuredAt >= ? AND
  measuredAt < ?`, which this index serves as one range scan per metric. No new
  `(assetId, measuredAt)` index is needed.
- `AnomalyScore @@unique([assetId, measuredAt])` serves the score side of
  both endpoints.
- `ManualReading @@index([assetId, metric, measuredAt])` serves the manual
  side of the grouped query the same way.

If the Phase 2 benchmark misses its target, the fallback is a rollup, which is
out of scope here and would need its own spec.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/assets/{assetId}/readings/series | query `from` (required), `to` (required), `metric` (optional, repeated) | 200 ReadingSeriesResponse; 400 / 401 / 403 / 404 EstateError | Owner, Manager, Crew (same as readings) |
| GET | /estates/{estateId}/assets/{assetId}/readings/grouped | query `limit` (optional, 1-100, default 20), `before` (optional instant) | 200 ReadingGroupPage; 400 / 401 / 403 / 404 EstateError | Owner, Manager, Crew (same as readings) |

### Series (`getAssetReadingSeries`)

Operation ID `getAssetReadingSeries`, on `AssetReadingController` (path under
its `@RequestMapping`), service `ReadingSeriesService` in
`com.proj.server.reading`, query in `AssetReadingRepository`.

Rules:

- `from` inclusive, `to` exclusive, ISO-8601 with offset. Missing, malformed,
  `from >= to`, or `to - from` over 24 hours returns 400.
- `metric` repeated values filter metrics; unknown metric returns 400. Omitted
  means every metric the asset has device readings for in the range.
- Authorization is `EstateReadingService.authorize` (Manager authority or
  CREW). Resident returns 403. Unknown estate or asset, or an asset in another
  estate, returns 404. A retired asset is readable.
- **Bucket size:** the smallest step in
  `[1s, 5s, 10s, 15s, 30s, 1m, 2m, 5m]` that is at least
  `(to - from) / 300`. A range never yields more than 300 buckets:

  | Range | Bucket | Buckets |
  | --- | --- | --- |
  | 1 min | 1 s | 60 (raw samples at 1 Hz) |
  | 15 min | 5 s | 180 |
  | 1 h | 15 s | 240 |
  | 24 h | 5 min | 288 |
- Buckets are aligned to the epoch (`date_bin(bucket, measuredAt,
  '1970-01-01Z')`), so the same instant falls in the same bucket on every
  refetch. A bucket's `start` may be before `from`; only readings in
  `[from, to)` are counted.
- Only device readings. Manual readings are not in the series.
- Per metric, a point per non-empty bucket: `start`, `min`, `max`, `avg`,
  `count`. Empty buckets are omitted; the client renders gaps.
- `anomalies`: per bucket that has at least one `AnomalyScore` in range,
  `start`, `maxScore`, `abnormalCount` (scores ≥ threshold).
- Metrics are returned in catalogue order (decision 0016); points and
  anomalies in ascending `start`.

DTOs (Java records):

- `ReadingSeriesResponse { from: OffsetDateTime, to: OffsetDateTime, bucketSeconds: int32, anomalyThreshold: double, metrics: MetricSeries[], anomalies: AnomalyBucket[] }`
- `MetricSeries { metric: DeviceMetric, unit: string, points: SeriesPoint[] }`
- `SeriesPoint { start: OffsetDateTime, min: double, max: double, avg: double, count: int32 }`
- `AnomalyBucket { start: OffsetDateTime, maxScore: double, abnormalCount: int32 }`

All fields required. `from`/`to` are echoed as received (normalised to UTC).

Example: `GET .../readings/series?from=2026-11-07T12:00:00Z&to=2026-11-07T13:00:00Z`
returns `bucketSeconds: 15`, five `metrics` each with up to 240 points, and
`anomalies` for the buckets around 12:59:15Z.

Web hook in `apps/web/src/lib/readings.ts`:
`useAssetReadingSeries(estateId, assetId, range)` with query key
`[userId, "reading-series", estateId, assetId, range]`. The key holds the
range name, not the instants, so a refetch replaces the cache entry;
`queryFn` computes `from`/`to` from `Date.now()`. No invalidations.

### Grouped readings (`getAssetReadingGroups`)

On `AssetReadingController`, service `ReadingGroupService` in
`com.proj.server.reading`, query in `AssetReadingRepository`.

Rules:

- Returns the latest `limit` groups with `measuredAt` strictly before
  `before` (or all, when `before` is omitted), newest first. A **group** is
  the readings sharing one `measuredAt` and one source: one device (device
  readings) or one recorder (manual readings).
- `limit` outside 1-100, or a malformed `before`, returns 400.
- Authorization, 403 and 404 rules are the same as the series endpoint. A
  retired asset is readable.
- Each group lists every metric reading it has, in catalogue order, each with
  that reading's flags exactly as the existing readings endpoints compute
  them (`GAP`, `DUPLICATE_TIMESTAMP`, `OUT_OF_RANGE`, `ANOMALY`, with the same
  fields).
- `anomalyScore` is the stored `AnomalyScore.score` for the asset at that
  `measuredAt`, on device groups only; absent when there is no score and on
  manual groups.
- `nextBefore` is the oldest returned group's `measuredAt` when more groups
  may exist (the query found `limit + 1` distinct timestamps), else absent.
  Groups sharing that oldest `measuredAt` are always returned together, so a
  `before` cursor never splits a timestamp. This makes `limit` a bound on
  timestamps; a page can hold more groups than `limit` when several sources
  share one timestamp.
- **Query approach** (keyset, no `OFFSET`):
  1. Pick the latest `limit + 1` distinct `measuredAt` values for the asset
     below `before`, from `DeviceReading` and `ManualReading` unioned. Each
     side is a per-metric descending walk of the
     `(assetId, metric, measuredAt)` index (`metric = ANY(catalogue)`), so it
     reads at most about `(limit + 1) x metrics` index entries per side.
  2. Fetch every reading on the asset at those timestamps (`measuredAt =
     ANY(?)`), again by the same index, with flags computed by the existing
     flag expressions in `AssetReadingRepository`.
  3. Left join `AnomalyScore` on `(assetId, measuredAt)` through its unique
     key.
- No migration is needed: every step is served by existing indexes.

DTOs (Java records):

- `ReadingGroupPage { groups: ReadingGroup[], nextBefore?: OffsetDateTime }`
- `ReadingGroup { measuredAt: OffsetDateTime, source: ReadingSource, deviceId?: uuid, deviceIdentifier?: string, recordedByName?: string, anomalyScore?: double, metrics: GroupedMetricReading[] }`
- `GroupedMetricReading { readingId: uuid, metric: DeviceMetric, value: double, valueText?: string, unit: string, flags: ReadingFlagResponse[] }`

`ReadingSource` and `ReadingFlagResponse` are the existing types.

Example: `GET .../readings/grouped` returns 20 groups for a 1 Hz pump, each
with five metrics, newest first, and `nextBefore` set to the 20th
`measuredAt`.

Web hook in `apps/web/src/lib/readings.ts`:
`useAssetReadingGroups(estateId, assetId, live)` with query key
`[userId, "reading-groups", estateId, assetId]`; `refetchInterval` is 1 s
while `live`, else 60 s. No invalidations.

## Edge cases

- **Asset with no devices or no readings in range.** `metrics: []`,
  `anomalies: []`, 200. The card shows the range-specific empty state.
- **Metric with readings but not a pump.** Charts show; there are no
  anomaly bands because nothing is scored.
- **Two devices on one asset with the same metric.** Their readings are
  aggregated into one series (min/max/avg over both). The grouped table shows
  them as separate rows only if their source differs; same-instant duplicates
  of a metric in one row show both values stacked in that cell.
- **Partial timestamps.** A device row missing a metric shows "—" in that
  cell. It is not an error and gets no new flag.
- **Manual readings.** Separate rows in the grouped table, labelled Manual
  with the recorder. Not in the charts.
- **Cursor boundary.** Groups sharing the oldest `measuredAt` come back
  together, so a timestamp is never split across pages.
- **Clock skew between browser and server.** The window is computed in the
  browser. Readings up to 5 minutes in the future are accepted by ingest; they
  only appear once the browser's "now" passes them. Acceptable for a chart.
- **Time zone and DST.** Buckets are UTC-aligned; the axis formats them in the
  user's time zone. A DST change in a 24-hour range shows the shifted hour
  labels correctly because formatting is per instant.
- **Date-only values near midnight.** `formatDate("2026-11-07")` is
  "7 Nov 2026" for users in UTC-10 and UTC+14.
- **Old model notes.** Notes written before this change share the template and
  are formatted the same way. A note that does not match is shown as-is.
- **Large range on a busy asset.** 24 h at 1 Hz is 432,000 device rows across
  five metrics. Phase 2 benchmarks it.
- **Live and a range change.** Turning to 1 h or 24 h switches Live off before
  the new query starts, so a long range is never polled at 1 s.
- **Permission revoked while open.** Same as readings: the access projection
  disables the query and hides the charts.
- **Background tab.** No polling while hidden, for both Live and the 60 s
  refresh.

## Out of scope

- Chart zoom, pan, brushing, custom date ranges, or ranges beyond 24 hours.
- Charts on the estate readings page, the per-asset readings page, the
  dashboard, or the device simulator.
- Comparing assets, overlaying metrics on one axis, or exporting a chart.
- Manual readings on charts.
- Rollup tables, materialised views, retention or downsampling of stored
  readings or scores.
- Server-side structured fields for assessment notes, or rewriting stored
  notes.
- Changing the anomaly threshold, model, or scoring.
- Live push (SSE/WebSocket). Polling only; Live only on 1 min and 15 min.
- Moving "View all readings" or the estate readings page onto the grouped
  endpoint. Its cursor allows it later.
- Applying `format.ts` to screens other than the asset overview. Other
  `toLocaleString` call sites (work orders, documents, devices pages) move
  when those screens are next touched (rule 10).
- Changing `ReadingTable`/`ReadingCards` on the estate readings page.

## Implementation phases

Test-first throughout (`.spec/testing.md`). Each phase ends green on
`pnpm check-types` and `pnpm test`.

- [x] 1. **Formatting module.** Tests first in `apps/web/tests/lib/format.test.ts`
      for every `format.ts` rule above: date-only values in UTC-10 and UTC+14,
      invalid input, instants in a fixed time zone, relative units, every
      metric's precision and unit (sanctioned units and fallbacks, negatives),
      score, and `formatAssessmentNotes` (model vs person, same-day, no match,
      an old note verbatim from Neon dev). Then implement `lib/format.ts` and
      move `flagLabel` onto it. Add `.docs/frontend/formatting.md`.
- [x] 2. **Series endpoint (server).** Pin the model note template with a test
      in `AnomalyScoringService`'s tests. Then tests first
      (`@SpringBootTest` + Testcontainers) for: the bucket per range (1 min
      -> 1 s raw samples, 15 min -> 5 s, 1 h -> 15 s, 24 h -> 5 min), the 300
      cap, epoch alignment, `[from, to)` edges, min/max/avg/count, empty
      buckets omitted, metric filter and order, manual readings excluded, two
      devices aggregated, anomaly buckets and `abnormalCount`, 400s (missing,
      malformed, reversed, over 24 hours, unknown metric), 401, Resident 403,
      cross-estate 404, retired asset readable. Implement
      `getAssetReadingSeries`. Add an opt-in `ReadingSeriesBenchmark` (like
      `ReadingBrowserBenchmark`) for 24 h at 1 Hz on one pump; target warm p95
      under 2 s; record the result in this spec. `pnpm api:generate`.
      Update `.docs/api/readings.md`.
      *Result (2026-11-07, Testcontainers Postgres on a dev Mac):* 24 h warm
      p95 171-336 ms across runs, 1 min p95 6 ms. Target met. Contract not yet
      regenerated (port 8080 was in use).
- [x] 3. **Grouped endpoint (server).** Tests first (`@SpringBootTest` +
      Testcontainers):
      - the default 20 and an explicit `limit`; 400 for `limit` 0, 101 and a
        malformed `before`;
      - newest first; `before` is exclusive; `nextBefore` present only when
        more exist, and following it returns the next timestamps with no
        repeats or gaps;
      - grouping per `(measuredAt, device)` and per `(measuredAt, recorder)`
        for manual readings; device and manual at one instant are separate
        groups; two devices at one instant are separate groups;
      - a partial timestamp (three of five metrics) returns three metrics;
      - groups sharing the oldest timestamp are never split by the cursor;
      - per-metric flags match the existing readings endpoint for the same
        readings (`GAP`, `DUPLICATE_TIMESTAMP`, `OUT_OF_RANGE`, `ANOMALY`);
      - `anomalyScore` present on scored device groups, absent with no
        score and on manual groups;
      - catalogue order of metrics; `valueText` on manual exact decimals;
      - 401, Resident 403, cross-estate and unknown-asset 404, retired asset
        readable.

      Implement `getAssetReadingGroups`. Extend the opt-in benchmark with the
      grouped query on the same 24 h fixture (target warm p95 under 200 ms,
      since Live polls it every second). `pnpm api:generate`. Update
      `.docs/api/readings.md`.
      *Result (2026-11-07, same fixture):* grouped default page warm p95
      12 ms, `limit=100` 17 ms, mid-day cursor 7 ms. Target met. Contract
      not yet regenerated (port 8080 was in use).
- [x] 4. **UI components (human installs).** The agent must not run any of
      this (AGENTS.md rule 1). The agent adds `recharts` to the `catalog:` in
      `pnpm-workspace.yaml` and `"recharts": "catalog:"` to
      `packages/ui/package.json`, then asks the human to run:
      - `pnpm dlx shadcn@latest add chart -c packages/ui`
      - `pnpm dlx shadcn@latest add switch -c packages/ui` (there is no
        Switch or Toggle in `packages/ui` today)
      - `pnpm install`

      Add decision record
      `.spec/decisions/0045-reading-charts-use-shadcn-chart.md` (shadcn
      Chart/recharts chosen over hand-drawn SVG and other chart libraries;
      server-side bucketing and grouping so the client never receives raw
      1 Hz data beyond the 1 min window; Live as 1 s polling limited to short
      windows rather than push). Update `.docs/frontend/design-system.md` to
      list Chart and Switch.
      *Result (2026-11-08):* the human ran both shadcn adds and
      `pnpm install`. Deviation: the shadcn CLI pinned `"recharts": "3.8.0"`
      directly in `packages/ui/package.json` rather than through the
      `catalog:`; it is left as is, because moving it needs another install
      (noted in decision 0045).
- [x] 5. **Trends card (web).** Tests first in
      `tests/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card.test.tsx`:
      exactly four range tabs with 1 min default, request params per range,
      one figure per metric in order with captions, latest value text,
      anomaly summary text from `anomalyThreshold`, "Show as table" contents,
      loading, error/Retry, range-specific empty state, 60 s refresh on every
      range, Live enabled only on 1 min and 15 min, Live off after switching
      to 1 h or 24 h, 1 s refetch while Live, the Switch's role, name and
      state, and no `aria-live` region. (recharts SVG is not asserted on in
      jsdom; the accessible summary and table are.) Then add
      `useAssetReadingSeries` and the card. Update `.docs/frontend/readings.md`
      and `.docs/frontend/assets.md`.
- [x] 6. **Grouped readings (web).** Tests first for the card: columns per
      metric present, no Asset column, Device shown only when several, "—"
      cells, cell flags vs the row ANOMALY badge, manual rows, day headings,
      states, and its refetch following Live (1 s) or 60 s. Then add
      `useAssetReadingGroups` and replace the overview's `ReadingTable` use
      with the grouped table. Update `.docs/frontend/readings.md`.
- [x] 7. **Overview cards.** Tests first for: Details installation date,
      Condition "Assessed" dates, recorder line with relative time, the
      "Anomaly detection" source badge, formatted model notes and verbatim
      person notes, forecast "Condition: Needs attention · Anomaly
      detection", the loading fallback "Condition needs a check", the
      "because" lead-in, formatted end of life. Then update the cards and the
      layout (rules 9-10). Update `.docs/frontend/assets.md` and
      `.docs/frontend/failure-risk.md`.
- [x] 8. **Check in the browser.** Backfill `other/3.csv` with the simulator,
      then run the simulator's Live mode with the page's Live on at 1 min.
      Confirm at 1280, 375 and 320 px, light and dark: bands line up with the
      grouped rows' Anomaly badges; Live updates every second and stops in a
      hidden tab; 24 h loads within the benchmark target. Record the result
      here. Update `.docs/README.md` (link `frontend/formatting.md`) and the
      `.spec/README.md` status table.

      **Result (2026-11-08, Safari, local dev):**
      - Backfilled `other/3.csv` three times and ran the simulator in Live.
      - Trends: 1 min/15 min/1 h/24 h all render; the 15 min chart shows
        the anomaly bands with accessible summaries ("Anomaly from ... to
        ..., maximum score ..."). The 24 h range loads promptly against a
        day of data (server benchmark: p95 171-336 ms).
      - Live at 1 min: with the tab visible, "Updated" advanced every
        second; with the tab hidden it stopped, and resumed when visible.
        Live is disabled with a hint on 1 h and 24 h.
      - 1024, 375 and 320 px, light and dark: no page-level horizontal
        overflow; the grouped table scrolls inside its own container.
      - Band/badge alignment is covered by tests (both come from the same
        stored scores and threshold); not compared visually row by row.
      - Follow-ups noticed: the vertical axis unit label overlaps tick
        labels on narrow-valued charts (e.g. "g" on vibration); the grouped
        table needs horizontal scroll below about 1100 px.

## Open questions

Resolved (2026-11-07):

1. **Default range:** 1 min. The tabs are exactly 1 min, 15 min, 1 h and
   24 h; 7 d is dropped and the maximum span is 24 hours.
2. **Grouped table:** a new server endpoint, `getAssetReadingGroups`, with a
   `before` keyset cursor. "View all readings" is not changed now.
3. **Assessment notes:** reformatted on the web from the fixed template;
   stored notes and the server template are unchanged.
4. **7-day range:** dropped (see 1).
5. **Locale:** the browser's locale and time zone; tests pin
   `en-SG`/`Asia/Singapore`.
6. **Refresh:** 60 s background refresh on every range; an opt-in Live switch
   polls every 1 s on 1 min and 15 min only, and stops in hidden tabs.

None open.
