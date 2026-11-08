# Formatting (`apps/web/src/lib/format.ts`)

Shared display formatting for dates, instants, relative times, reading values
and scores. Built only on `Intl.DateTimeFormat`, `Intl.NumberFormat` and
`Intl.RelativeTimeFormat`; formatter instances are cached per locale/options.
No route, screen or endpoint of its own. Spec:
`.spec/features/asset-readings-charts.md`.

Every function takes an optional last argument `{ locale?, timeZone? }`.
Omitted means the browser's locale and time zone. Tests pin
`{ locale: "en-SG", timeZone: "Asia/Singapore" }`.

| Function | Input | Output (en-SG, Asia/Singapore) |
| --- | --- | --- |
| `formatDate(value)` | `YYYY-MM-DD` calendar date | `7 Nov 2026`, formatted in UTC so the day never shifts (UTC-10 to UTC+14). Anything else, including impossible dates such as `2026-02-30`, is returned unchanged. |
| `formatDateTime(instant)` | ISO instant | `7 Nov 2026, 9:01:57 pm` |
| `formatTime(instant)` | ISO instant | `9:01:57 pm` |
| `formatClock(instant)` | ISO instant | `9:01 pm` (hour and minute; Trends x ticks on 1 min, 15 min and 1 h) |
| `formatDayHour(instant)` | ISO instant | `Sat, 9 pm` (short weekday and hour; the 24 h chart axis) |
| `formatDuration(seconds)` | seconds | `1 sec`, `5 mins`, `2.3 hrs` (largest whole unit up to hours; the Trends coverage note) |
| `localSecondOfDay(t)` | epoch ms | seconds since local midnight, used by `timeTicks` to align ticks to round wall times |
| `formatRelative(instant, now)` | ISO instant, `Date` | Short style, `numeric: "auto"`: `30 sec ago`, `2 min ago`, `3 hr ago`, `yesterday`, `3 days ago`, `in 2 min`. Show it only next to an absolute time. |
| `formatMetricValue(metric, value)` | `DeviceMetric`, number or decimal string (`valueText`) | Per-metric precision and unit, below |
| `formatScore(score)` | number | 2 fraction digits: `0.87` |
| `formatNumber(value)` | number | Default `Intl.NumberFormat`: `1,234.568` |
| `formatAssessmentNotes(assessment)` | `{ notes?, recordedByUserId? }` | See below |

## Metric values

| Metric | Precision | Unit | Example |
| --- | --- | --- | --- |
| TEMPERATURE | 1 fraction digit | Intl `celsius` | `68.4°C` |
| HUMIDITY | 0 fraction digits | Intl `percent` | `55%` |
| PRESSURE | 2 fraction digits | `bar` | `-0.27 bar` |
| FLOW_RATE | 1 fraction digit | `L/min` | `32.0 L/min` |
| VIBRATION | 2 fraction digits | `mm/s` | `4.10 mm/s` |
| VIBRATION_ACCELERATION | 3 significant digits | `g` | `0.0123 g` |
| POWER | 2 fraction digits | `kW` | `0.34 kW` |
| ENERGY | 1 fraction digit | `kWh` | `1,234.6 kWh` |

Fraction digits are fixed (min = max), so columns line up. Units that are not
ECMA-402 sanctioned are appended after a space from `deviceMetrics` in
`lib/devices.ts`.

## Assessment notes

Only when `recordedByUserId === "system:anomaly-model"`: each ISO instant
(`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z`) becomes `formatDateTime`, or
`formatTime` when it falls on the same local day as the previous instant.
`…from 2026-11-07T12:59:15.862Z to 2026-11-07T12:59:25.862Z…` becomes
`…from 7 Nov 2026, 8:59:15 pm to 8:59:25 pm…`. A person's notes, and notes with
no instant, are returned as written. Missing notes give `""`. Stored notes are
not changed.

## Current users

- `flagLabel` in `lib/readings.ts`: `Anomaly <formatScore>` and the
  out-of-range limits via `formatNumber`.
- Asset overview: the inline asset summary (`formatDate`), Condition section
  (`formatDate`, `formatAssessmentNotes`), Breakdown forecast (`formatDate`)
  and Trends (`formatTime`,
  `formatDayHour`, `formatDateTime`, `formatMetricValue`, `formatMetricNumber`,
  `formatScore`).

Screens are moved onto this module in later phases of the spec.
