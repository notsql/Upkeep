# Asset readings charts refresh and grouped "View all readings"

**Status:** agreed 2026-11-08
**Owner:** Ong Zheng Kai

Follow-up to [asset-readings-charts.md](asset-readings-charts.md) (built
2026-11-08), whose phase 8 browser check noted the overlapping unit label and
the wide grouped table, and whose Out of scope deferred moving "View all
readings" onto the grouped endpoint. Related:
[browse-raw-sensor-readings.md](browse-raw-sensor-readings.md),
[suspect-readings.md](suspect-readings.md),
[export-filtered-readings-csv.md](export-filtered-readings-csv.md).

## Problem

**Trends is hard to read.** The overview's Trends card
(`assets/$assetId/-components/asset-overview/trends-card/`) draws five equal
small charts in a two-column grid. Each has a "Time" axis title and a rotated
unit label that collides with the tick labels (the "g" on vibration). The
header packs range tabs, a Live switch, a hint, an "Updated" time and a legend
line into one wrapping row. On 24 h, an asset that only reported for a few
minutes has one or two 5-minute buckets. `chartRows` only builds rows from the
first point to the last, so those buckets render as a single vertical sliver.
Nothing gives a headline number per metric, so a reader has to look at five
charts to answer "what is this pump doing now?".

**"View all readings" is not grouped.** The overview shows one row per
timestamp (`getAssetReadingGroups`). The asset's full readings page
(`assets/$assetId/readings/`) still shows the flat `ReadingTable`, one row per
metric per timestamp. At 1 Hz, five rows cover one second, and the page reads
very differently from the card that links to it. The grouped endpoint has only
`limit` and `before`, so it cannot serve the page's metric, date and flag
filters.

## Behaviour

### Part 1: Trends card redesign

Design method: the `dataviz` skill. Each metric has a different unit, so the
metrics never share an axis (no dual axis). They become one headline tile each
plus a single large chart for the selected metric. Each chart has one series,
so there is no categorical palette to validate. The avg line uses `--chart-2`
and the band uses `--chart-2` at low opacity, as today. Anomaly shading uses
`--destructive`. All of these are shadcn theme tokens that already have light
and dark values.

#### Layout

- The card keeps `SectionCard` "Trends" with the description "Device
  readings over time, with anomalies the model found."
- **Header controls, top right of the card** (in `SectionCard`'s action slot,
  or a right-aligned flex row when it has none):
  - The range is a shadcn `Select` labelled "Range" (visually hidden label).
    Its options are "Last 1 minute", "Last 15 minutes", "Last hour" and "Last
    24 hours", and the default is "Last 1 minute". It replaces the `Tabs`
    list. The ranges, the 1 min default and the component state are unchanged
    from the shipped spec.
  - A compact **Live** toggle: the existing `Switch` plus `Label` "Live", at
    `size="sm"` if the component has that size. The rules are unchanged: it is
    enabled only on 1 min and 15 min, it switches off on 1 h and 24 h, and it
    polls every 1 s.
  - A **Refresh** icon `Button` (`variant="ghost"`, `size="icon"`,
    `RefreshCw` icon, `aria-label="Refresh trends"`). It calls `refetch()` on
    the series query, and the icon spins (`animate-spin`) while
    `isFetching`. It is disabled while a fetch is in flight.
  - The "Live is available for 1 min and 15 min" hint is no longer a visible
    paragraph. It becomes the Switch's `aria-describedby` target, rendered as
    `sr-only` text, and a `Tooltip` on the disabled control's wrapper.
  - The "Updated 9:01:57 pm" text moves under the controls as muted `text-xs`
    text. It is still outside any live region.
- **Stat tiles row** below the header. It is a shadcn `ToggleGroup`
  (`type="single"`, `aria-label="Metric"`) with one item per metric in the
  response, in catalogue order. Each item is a tile:
  - a small muted label, the metric name ("Vibration");
  - a large value, the latest bucket's `avg` through `formatMetricValue`
    (`text-2xl`, `tabular-nums`);
  - the **change**: `(last.avg - first.avg) / |first.avg|` over the range's
    points, shown as a signed percent with `Intl.NumberFormat`,
    `style: "percent"`, `signDisplay: "exceptZero"` and 1 fraction digit
    ("+3.2%"), plus an arrow icon (`ArrowUp`/`ArrowDown`/`Minus`). The change
    is **muted text, not green or red**: for a sensor, up is not good or bad,
    and status colours are reserved (dataviz non-negotiable). Its accessible
    text is "Up 3.2% since 9:00:57 pm". When `|first.avg|` is under 1e-9, or
    the series has fewer than 2 points, the change is "—" with
    `aria-label="No change available"`;
  - a **sparkline**: a recharts `LineChart`, 32 px tall, with no axes, grid,
    tooltip or dots, `aria-hidden`, and the same rows as the large chart;
  - an **anomaly badge** when the range has at least one anomaly period: a
    destructive `Badge` with the period count ("2 anomalies"). Anomalies are
    per sample, not per metric (the shipped spec), so **every tile shows the
    same count**. Open question 1 asks whether to show it once instead.
- **Tile selection.** The first metric in the response is selected by default.
  Clicking a tile, or pressing Enter or Space on it (Radix `ToggleGroup`
  gives roving focus with arrow keys and `aria-pressed`), selects it. The
  group never deselects: choosing the selected tile again keeps it
  (`onValueChange` ignores the empty value). The selection is component
  state. If a refetch drops the selected metric, the first metric is selected
  again.
- **Selected-metric chart** below the tiles, at full card width.
  - Chart header: the metric name and unit once ("Vibration · g"), and an
    inline legend in muted `text-xs`:
    "● Average  ▬ Min–max  ▮ Anomaly · 2 periods, max 0.88". The anomaly item
    only shows when there are periods. It replaces the card-level "Anomaly
    (score ≥ 0.51)" line, and the threshold moves into the anomaly item's
    `Tooltip` and the hidden summary ("score ≥ 0.51").
  - Height: `h-64` at `md` and up, `h-48` below.
  - The marks are the same as today: a 2 px `avg` line, a `min`–`max` band at
    0.2 opacity (not drawn at 1 s buckets), `connectNulls={false}`, and
    anomaly `ReferenceArea`s at `fillOpacity` 0.12 with no stroke.
  - The `MetricTooltip` crosshair tooltip is unchanged.
- **Axes:**
  - There are **no axis titles**. The x "Time" label and the rotated y unit
    label are removed, which fixes the overlap at its root.
  - Grid: horizontal lines only, dashed (`strokeDasharray="3 3"`), using
    `--border` at reduced opacity. There are about 4 y ticks
    (`tickCount={4}`).
  - Ticks: `text-xs`, `--muted-foreground`, `tickLine={false}`,
    `axisLine={false}`. The y-axis width is computed from the longest
    formatted tick (its character count × 7 px + 8, clamped to 32–64) rather
    than a fixed 56.
  - X ticks are explicit, from a pure `timeTicks(from, to, range)` helper on
    round local boundaries: 1 min every 15 s; 15 min every 5 min; 1 h every
    15 min; 24 h every 6 h. They are formatted with `formatTime` without
    seconds (`formatClock`, a new `format.ts` function using
    `Intl.DateTimeFormat` `hour`/`minute`) on the three short ranges. On 24 h
    they use `formatDayHour`, which shows the day only at the first tick and
    at midnight. Below `sm`, every other tick is dropped.
- **Sparse data (decision: keep the full range on the x-axis).**
  - The x-domain is always `[from, to]` of the requested range. The rows run
    from the first bucket at or after `from` to the last before `to`, so empty
    buckets are explicit `null` gaps across the whole range. This replaces
    `chartRows`' "first point to last point".
  - A bucket with data but no neighbours (both adjacent buckets empty) gets a
    visible dot (`r=3`), so one bucket is a dot, not an invisible line or
    sliver.
  - When the points cover less than 10% of the range's buckets, a muted note
    under the chart reads "Readings cover 3 min of the last 24 hours". The
    covered time is `count of non-empty buckets × bucketSeconds`, formatted
    with `Intl.NumberFormat` unit "minute"/"hour".
  - Why not "zoom to data": the range select is the zoom. A zoomed axis would
    no longer match "Last 24 hours", would hide an outage (exactly what gaps
    are for), and would make tiles and chart disagree about the period the %
    change covers. Picking a shorter range is one click.
- **Accessibility:**
  - Each tile's accessible name is "Vibration, 0.312 g, up 3.2%, 2
    anomalies". It is pressed when selected.
  - The large chart stays a `figure` with `figcaption` ("Vibration (g), last
    24 hours"), an `aria-hidden` SVG, and the `sr-only` `metricSummary`.
  - The non-selected metrics' summaries stay available: each tile's
    `aria-describedby` points at an `sr-only` summary for that metric. No
    information is lost by showing one chart.
  - "Show as table" / "Hide table" and `TrendsTable` are unchanged. The table
    still has every metric.
  - There is still no `aria-live` region.
- **Responsive:**
  - At `lg` and up the tiles are 5 across (`grid-cols-5`). At `sm`–`md` they
    are 3 across. Below `sm` (375 and 320 px) they are 2 across with the
    label above the value. The sparkline keeps full tile width, and the change
    wraps under the value.
  - Header controls wrap below the title under `sm`: Select, then Live, then
    Refresh, in one row. The Select is `w-full` at 320 px and the toggle and
    refresh sit on the next row.
  - No page-level horizontal overflow at 1280, 375 or 320 px.
- **Themes:** everything is drawn with theme tokens (`--chart-2`,
  `--destructive`, `--border`, `--muted-foreground`, `--card`). There are no
  hard-coded colours and no dark-only styling. Tiles use `Card`-like
  `border`/`bg-card`. The selected tile uses `ring-2 ring-ring`, plus the
  `aria-pressed` styling from `ToggleGroup`. It is verified in light and
  dark.
- **States:** loading shows a `Skeleton` row of tiles and one chart-sized
  `Skeleton`. Error and empty are unchanged ("Retry trends", "No readings in
  the last 1 hour"). The header controls stay usable in every state.

#### Data for Part 1

`getAssetReadingSeries` is enough, so there is **no server change**. Tiles
read `points[0].avg` and `points.at(-1).avg` for the change, and
`points.at(-1).avg` for the latest value. Sparklines reuse the same points,
and anomaly counts come from `anomalyPeriods(series)`. One query feeds the
tiles, the chart and the table.

The % change is "first bucket of the range vs latest". That is the start of
the window, not a previous equal-length period as in the reference. A previous
period would need a second series request and an API change for 48 h spans, so
it is left out (YAGNI, open question 2).

### Part 2: Grouped "View all readings"

Route: `routes/_auth/estates/$estateId/assets/$assetId/readings/index.tsx`
(the overview's "View all readings" link). Its
`-components/asset-readings-page.tsx` swaps `ReadingResults` (flat
`ReadingTable`/`ReadingCards`) for the grouped table.

- The page uses the **same `GroupedReadingsTable`** as the overview. It moves
  from `asset-overview/grouped-readings/` to
  `assets/$assetId/-components/grouped-readings/`, its nearest shared
  ancestor (rule 8), and the overview import is updated. Its props and output
  are unchanged except for the optional `metrics` column restriction below.
- The page calls `getAssetReadingGroups` with the current URL filters through
  a new `useAssetReadingGroupPages(estateId, assetId, filters)`
  (`useInfiniteQuery`, `limit` 50). The query key is
  `[userId, "reading-groups", estateId, assetId, "pages", filters]`, so it
  never shares a cache entry with the overview's key.
- **Filters** (the existing `ReadingFilterControls`, unchanged): metric, from,
  to, "Suspect only" (`GAP`, `DUPLICATE_TIMESTAMP`, `OUT_OF_RANGE`) and
  "Anomalous only" (`ANOMALY`), sent as repeated `flag` with match-any, as on
  the flat endpoint.
- **A group matches the flag filter if any reading in it (after the metric
  filter) carries any selected flag.** The whole group is shown, with every
  reading's flags.
- **Metric filter:**
  - Only groups with a reading of the selected metric are returned.
  - Each returned group contains only that metric's readings.
  - The table shows only that metric column.
  - Flags are computed over all readings, as the flat endpoint does today (a
    metric filter never changes a flag).
- **Date range:** `from` inclusive, `to` exclusive, on the group's
  `measuredAt`.
- **Pagination:** a "Load older" outline `Button` below the table appends the
  next page through `nextBefore`. It is shown only while `hasNextPage`, and
  it reads "Loading…" and is disabled while fetching. Changing any filter
  resets to the first page, because the key changes. The URL's `page` param
  is ignored on this route and dropped on the next filter edit.
- The header shows a count line, "Showing 120 timestamps". There is no total,
  because the keyset endpoint does not count.
- **The CSV export (`ReadingExport`) is unchanged.** It is still per reading,
  with the same filters.
- **States:**
  - Loading shows `LoadingState` "Loading readings…".
  - An error shows `ErrorState` "Retry readings".
  - A filter validation error shows the existing `readingFilterError` message,
    and no request is made.
  - No groups with filters shows `EmptyState` "No readings match these
    filters" with "Clear filters". No groups and no filters shows "No readings
    yet".
- Mobile: the same table, scrolling in its own region, with the Time column
  sticky (as on the overview). `ReadingCards` is not used on this route.
- No Live or background refresh on this page (unchanged).
- Only shadcn components (Button, Table, Badge, Tooltip, Empty, Alert), so
  rules 9–10 are met.

## Data

There is no schema change and no migration.

Read, unchanged: `DeviceReading`, `ManualReading`, `AnomalyScore`, `Device`,
`Asset`.

Indexes: `DeviceReading` and `ManualReading` `@@index([assetId, metric,
measuredAt])` and `AnomalyScore @@unique([assetId, measuredAt])` are enough.
See the query approach below.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/assets/{assetId}/readings/grouped | query `limit` (1–100, default 20), `before` (instant), **new optional** `from` (instant, inclusive), `to` (instant, exclusive), `metric` (repeated `DeviceMetric`), `flag` (repeated `ReadingFlagType`, match-any) | 200 ReadingGroupPage; 400 / 401 / 403 / 404 EstateError | Owner, Manager, Crew (unchanged) |

`getAssetReadingSeries` is unchanged.

- The operation ID stays **`getAssetReadingGroups`**. The new params are
  optional, so the overview call and its output are unchanged.
- The DTOs are unchanged: `ReadingGroupPage { groups, nextBefore? }`,
  `ReadingGroup`, `GroupedMetricReading`, `ReadingFlagResponse`.
- Rules added:
  - `from >= to` returns 400. A malformed instant, an unknown `metric` or an
    unknown `flag` returns 400 (enum binding, handled by the existing
    exception handler).
  - When a `before` is outside `[from, to)`, the effective upper bound is
    `min(before, to)`.
  - `nextBefore` is as before: present when there may be more timestamps
    matching the filters.
  - With `metric`, each group's `metrics` holds only the listed metrics. A
    group's `anomalyScore` is unchanged.
- Auth, 401, Resident 403, cross-estate and unknown-asset 404, and retired
  asset readable are all unchanged.
- **Query approach** (keyset, no `OFFSET`), in `AssetReadingRepository`:
  - **No `flag`:**
    - `groupInstants` keeps its per-metric descending index walk.
    - It walks only the requested metrics (or the whole catalogue), adds
      `measuredAt >= from` and `< min(before, to)` to each walk, and stays one
      range scan per metric per side.
    - `groupsAt` adds `METRIC.in(requested)`.
  - **With `flag`:** flags need the `flagged()` derived table (predecessor
    lookup and score join), so the instants come from
    `select distinct measuredAt from flagged(assetId, null) where
    metric in (…) and matching(from, upper, flags) order by measuredAt desc
    limit n+1`. `groupsAt` then fetches those instants as now.
  - Cost: the flagged scan over an unbounded window on a 1 Hz asset is the
    risk, so the phase 2 benchmark measures it. Target: warm p95 under 500 ms
    for "Anomalous only" with no dates over the 24 h fixture, and under
    200 ms with no flag. If the target is missed, the fallback is to drive
    `ANOMALY`-only filters from `AnomalyScore` (`score >= threshold`,
    descending on its unique index) and keep `flagged()` for suspect flags.
    That still needs no migration.
- Example:
  `GET .../readings/grouped?limit=50&flag=ANOMALY&from=2026-11-07T00:00:00Z`
  returns the latest 50 anomalous timestamps since midnight UTC, each group
  with all five metrics, and `nextBefore` set to the 50th.

## Edge cases

**Trends**

- **One metric.** One tile, auto-selected. The toggle group still renders, so
  the layout is stable.
- **First bucket avg is 0, or only one point.** The change is "—".
- **Range with one non-empty bucket.** A dot at its time, the coverage note,
  and a tile change of "—".
- **Selected metric disappears on refetch.** The first metric is selected
  again, with no error.
- **Live on while switching tiles.** Polling continues, and selection is not
  reset by refetches.
- **Huge or negative values.** The width-from-ticks rule keeps labels clear.
  Negative values keep their sign (`format.ts`).
- **Themes.** A forced-colors or high-contrast mode keeps the line visible,
  because recharts' stroke uses `currentColor`-compatible tokens. Anomaly
  bands also appear in the summary and table, so colour is never the only
  signal.

**Grouped page**

- **Flag filter where only one metric of a timestamp is flagged.** The group
  is shown with all its metrics, and the flag badge is on that metric's cell.
- **Metric filter plus flag filter.** A group matches only if a reading *of
  that metric* carries the flag.
- **Two sources at one timestamp, one matching.** Only the matching source's
  group is returned. Grouping is per `(measuredAt, source)`, so filters apply
  per group.
- **Cursor boundary.** Groups sharing the oldest timestamp are never split
  (unchanged).
- **Filters edited while "Load older" is in flight.** The key changes, the old
  pages are discarded, and the stale response is ignored by React Query.
- **Manual readings.** They are included and filterable. A manual reading
  never carries `GAP` or `ANOMALY`, which is unchanged.
- **Old bookmarked `?page=3`.** It is ignored, and the first page is shown.

## Out of scope

- **The estate-wide readings page** (`/estates/$estateId/readings`) and the
  estate's per-asset route (`/estates/$estateId/readings/$assetId`) stay
  flat. They span many assets with different metric sets, so a grouped table
  has no stable columns. `ReadingTable`/`ReadingCards` are unchanged.
- A **source** filter (device vs manual). The asset readings page has no
  source control today. See open question 3.
- A previous-period comparison, zoom/pan/brush, custom ranges, ranges over
  24 h, and overlaying metrics.
- Any change to `getAssetReadingSeries`, rollups or retention.
- Changing the CSV export, or making it grouped.
- Next/Previous page buttons or a total count on the grouped page.
- Moving the catalogue-pinned `recharts` version (decision 0045 note).

## Implementation phases

Test-first throughout (`.spec/testing.md`). Each phase ends green on
`pnpm check-types` and `pnpm test`. Nothing is installed: `Select`,
`ToggleGroup`, `Tooltip`, `Badge` and `Chart` must already be in
`packages/ui`. If `toggle-group` is missing, the human runs
`pnpm dlx shadcn@latest add toggle-group -c packages/ui` before phase 2, and
the agent stops and asks.

- [x] 1. **Trends helpers.** Tests first in
      `tests/routes/.../trends-card/trends-data.test.ts`:
      - `chartRows` spans `[from, to)` with nulls, and marks isolated points;
      - `percentChange` covers up, down, zero and near-zero first values, and
        single points;
      - `timeTicks` per range, including local-midnight alignment in
        Asia/Singapore and a DST zone;
      - the coverage note threshold;
      - `formatClock` in `tests/lib/format.test.ts`.

      Then implement the helpers.
- [x] 2. **Trends card UI.** Update the tests in `trends-card.test.tsx`:
      - Range `Select` options and the default;
      - Live rules unchanged through the Select;
      - Refresh button name, refetch and disabled while fetching;
      - one tile per metric in order, with name, value, change text and
        anomaly badge;
      - toggle group role, `aria-pressed`, keyboard selection and no
        deselect;
      - one `figure` whose caption follows the selection;
      - per-tile `sr-only` summaries;
      - "Show as table" unchanged, no `aria-live`, and the states.

      See them fail. Then rebuild `trends-card.tsx` and `metric-chart.tsx`,
      and add `metric-tile.tsx` and `sparkline.tsx` in `trends-card/`.
      Update `.docs/frontend/readings.md` (Trends section) and
      `.docs/frontend/formatting.md`.
- [x] 3. **Grouped endpoint filters (server).** Tests first
      (`@SpringBootTest` + Testcontainers), extending the grouped endpoint
      tests:
      - `from`/`to` edges and `from >= to` 400;
      - `before` combined with `to`;
      - a single and a repeated `metric` restricts groups and their metrics;
      - unknown metric or flag 400;
      - `flag` match-any at group level (one flagged metric includes the whole
        group);
      - `metric` + `flag` together;
      - per-source matching at a shared instant;
      - `nextBefore` across filtered pages with no repeats or gaps;
      - no-param responses identical to today.

      Implement. Extend `ReadingSeriesBenchmark`'s grouped section with
      `flag=ANOMALY` and `metric=TEMPERATURE` cases, and record the results
      here. `pnpm api:generate`. Update `.docs/api/readings.md` (grouped
      section).

      Done 2026-11-08. Warm p95 over the 24 h fixture (one sample in 600
      anomalous): unfiltered 15 ms, `limit=100` 26 ms, `metric=TEMPERATURE`
      11 ms, `from`/`to` 17 ms. `flag=ANOMALY` through `flagged()` was
      2,665 ms, which missed the target, so the fallback was taken:
      ANOMALY-only filters walk `AnomalyScore`, and now run in 19 ms.
      Suspect flags still use `flagged()`: about 1.5 s median and 3 s p95 with
      no dates when nothing matches. They have no target, so this is
      recorded here only.
- [x] 4. **Grouped "View all readings" (web).** Move `GroupedReadingsTable`
      to `assets/$assetId/-components/grouped-readings/` and move its test to
      match. Tests first in
      `tests/routes/_auth/estates/$estateId/assets/$assetId/readings/asset-readings-page.test.tsx`:
      - the request params per filter combination;
      - one row per group, and only the filtered metric column;
      - "Load older" appends and hides when there is no `nextBefore`;
      - a filter change resets pages;
      - the empty states (with and without filters);
      - error and Retry;
      - validation error makes no request;
      - CSV export still sends the per-reading filters.

      Then add `useAssetReadingGroupPages` in `lib/readings.ts` and swap the
      page. Update `.docs/frontend/readings.md` ("View all readings") and
      `.docs/frontend/assets.md`.

      Done 2026-11-08. Web tests 1276/1276 and `pnpm check-types` green.
      Empty states reuse the estate `emptyMessage` ("No anomalous readings
      match these filters", "No matching suspect readings", "No matching
      readings", "No readings yet"). `GroupedReadingsTable` also gained an
      optional `label` (default "Latest readings"; the page uses "Readings").
      For the slow suspect-flag case the hook never refetches on its own
      (`staleTime: Infinity`, no focus refetch, no retry).
- [ ] 5. **Browser check.** With the simulator backfill and Live, at 1280, 375
      and 320 px in light and dark, confirm:
      - tiles and the large chart line up;
      - no tick overlap on vibration;
      - 24 h with a short burst shows dots, gaps and the coverage note, not a
        vertical line;
      - the grouped page filters, "Load older" and CSV export work.

      Record the result here. Update `.docs/README.md` if a file was added,
      and the `.spec/README.md` status row.

## Open questions

1. **Anomaly badge on every tile or once?** Anomalies are per sample, so all
   tiles would show the same count. *Recommendation:* show it once, as a
   destructive badge in the chart legend and beside the tiles row ("2
   anomalies in range"), not on each tile. Repeating identical badges is
   noise. If agreed, the tile's accessible name drops the anomaly part.
2. **% change baseline.** Start of range vs latest (no API change), or the
   previous equal period (needs 48 h series spans)? *Recommendation:* start of
   range, with a "since 9:00 pm" label so it is honest.
3. **Source filter.** The brief lists `source`, but the asset readings page
   has no source control and the flat endpoint has no `source` param.
   *Recommendation:* leave it out of both the grouped endpoint and the UI
   until someone asks for it (YAGNI). If wanted, it is a single
   `source=SENSOR|MANUAL` param applied to the walk's side selection, plus a
   `Select`.
4. **"Load older" vs Next/Previous.** A `before`-only keyset cannot jump back
   without a client cursor stack. *Recommendation:* "Load older" (append), as
   specified.
5. **Multi-metric filter in the UI.** The server accepts repeated `metric`,
   but `ReadingFilterControls` is single-select. *Recommendation:* keep the UI
   single-select now. The repeated param costs nothing and matches the series
   endpoint.
6. **`toggle-group` is not in `packages/ui`** (checked 2026-11-08), so a human
   install is needed (phase 2 note). *Recommendation:* add it via the shadcn
   CLI rather than build a radio group by hand.
