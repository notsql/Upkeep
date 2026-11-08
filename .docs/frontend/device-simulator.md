# Device simulator (frontend)

Paths are relative to `apps/device-simulator/src/`. A separate TanStack Start
app on port 3002, local only (no `wrangler.jsonc`, no deploy), no sign-in.
Spec: `.spec/features/streaming-anomaly-detection.md` ("Device simulator").

## Routes

| File | URL | Guard |
| --- | --- | --- |
| `routes/index.tsx` | `/` | none |

The screen is `routes/-components/simulator-page.tsx` (`SimulatorPage`).

## Screen

Built from `packages/ui`: Card, Field/FieldLabel, Input, Select, Tabs
(Backfill / Live mode), Button, Table and Alert.

- **API URL** (`Input`, default `http://localhost:8080`).
- **Device key** (`Input type="password"`). Held in component state only;
  never stored, logged or rendered.
- **CSV file** (`Input type="file"`). Parsed in the browser by
  `lib/csv.ts` `parseReadingsCsv`. The header must be exactly
  `experiment,timestamp,vibrationAcceleration,pressure,temperature,flowRate,power,anomaly`;
  a UTF-8 BOM, CRLF and trailing newlines are accepted. The first bad line
  rejects the file with `Line <n>: ...` (wrong header, wrong field count,
  timestamp not ISO-8601 with an offset, non-finite value, anomaly not 0/1),
  or `The file has no rows.` for an empty or header-only file. Shown in a
  destructive Alert.
- **Experiment** (`Select`): each distinct experiment with its row count
  (`experiments`).
- **Labelled anomaly windows** (`Table`): runs of consecutive `anomaly = 1`
  rows within the selected experiment, as 0-based start offset, end offset
  and length (`anomalyWindows`).
- **Start / Stop** (`Button`). While running: rows sent of total, counts of
  `CREATED`, `ALREADY_STORED`, `INVALID`, `CONFLICT` (`Table`), the first 10
  distinct `INVALID`/`CONFLICT` messages, and any stopping error (Alert).

## Run logic (`lib/`)

- `readings.ts`: `toReadings` maps one row to 5 readings sharing one
  `measuredAt` (UTC ISO): vibrationAcceleration → `VIBRATION_ACCELERATION`
  `g`, pressure → `PRESSURE` `bar`, temperature → `TEMPERATURE` `°C`,
  flowRate → `FLOW_RATE` `L/min`, power → `POWER` `kW`. `shiftRows` applies
  one offset (backfill: last row = Start time; live: first row = Start
  time), preserving gaps. `splitBatches` with `MAX_BATCH = 500`.
- `run.ts`: `runSimulation({ rows, mode, send, onUpdate, sleep? })` returns
  `{ stop, done }`. Each pass sends every not-yet-sent row whose shifted time
  has passed, in batches; backfill finishes in one pass, live repeats every
  5 s. A `retryable` outcome is retried up to 3 times, 2 s apart, then the run
  fails with that message; a `fatal` outcome fails at once. Item `INVALID` /
  `CONFLICT` results are counted, never retried. `stop()` ends the run after
  the current batch (status `stopped`). `sleep` (default: a page
  `setTimeout`) drives the live tick and retry waits; due rows are always
  chosen from `Date.now()`, so a late tick catches up.
- `worker-timer.ts`: `createWorkerSleep(createWorker?)` returns
  `{ sleep, dispose }` backed by a dedicated Web Worker (inline Blob URL)
  whose timers are not throttled in hidden tabs; falls back to a page timer
  when `Worker` is unavailable. The page creates one per run and disposes it
  when the run ends.
- `telemetry-outcome.ts`: `classifyResponse(status, body)`: 200 → `ok` with
  item results; 5xx → `retryable` (`Server error <n>.`); anything else
  (401, 409, 400) → `fatal` with the server's `message`.
- `send-telemetry.ts`: `sendTelemetry`, a POST `createServerFn`. It calls
  `POST /device-api/telemetry` (operation `submitTelemetry`, see
  `.docs/api/device-telemetry.md`) through `createApiClient` from
  `@proj/api`, with the device key supplied via `getToken`. A thrown fetch
  (network error) becomes `retryable` (`Could not reach <url>.`). The browser
  never calls Spring directly.

No React Query: there is no cached server state, only one-shot sends.

## Tests

`apps/device-simulator/tests/lib/`: `csv.test.ts`, `readings.test.ts`,
`run.test.ts` (fake timers, injected sleep), `telemetry-outcome.test.ts`,
`worker-timer.test.ts` (fake worker and timers).
