# Streaming anomaly detection

**Status:** built and verified 2026-11-08
**Owner:** Ong Zheng Kai

## Problem

The anomaly model (decision 0028) only runs when an estate owner uploads a
batch by hand to `POST .../readings/anomaly-check`, and those readings are
scored and thrown away (decision 0021). Readings that devices actually send to
`/device-api/readings` are stored but never scored, so a pump can fail in front
of the system without the model ever seeing it.

Devices can also only send one metric per request. The model needs all five
pump metrics at about 1 Hz, so a pump would need 5 requests a second, and
nothing ties a pump's five metrics to the same moment.

Nothing can produce realistic pump data either, so the full path - device,
ingestion, model, assessment - cannot be demonstrated.

This is a proof of concept: the goal is to show that path working end to end
on held-out SKAB data, not to build production-grade IoT ingestion.

## Behaviour

### Batch telemetry endpoint

- `POST /device-api/telemetry` accepts `{ "readings": [...] }`, where each item
  has exactly the shape and rules of a single `/device-api/readings` body
  (`metric`, `value`, `unit`, `measuredAt`; decisions 0016, 0025, 0028).
- It authenticates with the device key exactly as `/device-api/readings` does.
  A missing, malformed, unknown or replaced key returns 401 and stores nothing.
- A body that is not a JSON object with exactly one field `readings`, whose
  value is an array of 1 to 500 items, returns 400 and stores nothing.
- An inactive estate returns 409 for the whole batch and stores nothing.
- Otherwise the response is 200 with one result per item, in request order.
  Each result has the item's `index` and a `status`:
  - `CREATED` - stored, with the stored `reading`.
  - `ALREADY_STORED` - an identical reading was already stored, with that
    `reading`.
  - `INVALID` - the item failed one of the single-reading validation rules
    1-10 in `device-readings.md`, with that rule's `message`.
  - `CONFLICT` - a different value is already stored for this device, metric
    and `measuredAt`, with the same message the single endpoint gives.
- Each item is decided on its own. An `INVALID` or `CONFLICT` item does not stop
  the other items from being stored.
- Two items in one batch with the same metric and `measuredAt` are handled in
  order: the first is `CREATED` (or `ALREADY_STORED`), and the second is
  `ALREADY_STORED` if its value is identical, or `CONFLICT` if it differs.
- If at least one item is `CREATED` or `ALREADY_STORED`, the device's last-seen
  time is set to the receipt time once, under the existing rule that it never
  moves backwards. If none is, last-seen does not change.
- Stored rows are ordinary `DeviceReading` rows. Readings, flags, CSV export,
  flatline detection and device status treat them the same as readings from
  `/device-api/readings`.
- `/device-api/readings` keeps its current behaviour.

### Scoring stored readings

- After a request to `/device-api/telemetry` or `/device-api/readings` stores
  at least one new reading, scoring for that reading's asset starts
  asynchronously. The device's response does not wait for it, and a scoring
  failure never changes the device's response.
- Only an active pump (category `PUMP`, not retired, in an active estate) is
  scored. Readings on other assets are stored and never scored.
- A **sample** is a `measuredAt` at which the asset has exactly one
  `DeviceReading` for each of `VIBRATION_ACCELERATION`, `PRESSURE`,
  `TEMPERATURE`, `FLOW_RATE` and `POWER`. A timestamp missing any of the five
  is not a sample. A timestamp where some metric has more than one value (two
  devices on one asset) is not a sample. Manual readings are never used.
- Samples are ordered by `measuredAt`. A **segment** is a run of samples each
  at most 2 seconds (`AnomalyModel.MAX_GAP`) after the one before. A longer
  gap starts a new segment.
- Each sample is scored once. Its features are those `AnomalyFeatureBuilder`
  gives it when its segment, up to and including that sample, is built as one
  batch. The rolling window therefore uses at most the 9 samples before it
  within the same segment, and restarts at each segment.
- The stored score for a sample equals the score `AnomalyScorer` returns for
  that sample when the whole segment is scored as one batch through the
  existing anomaly-check path, to within 1e-6.
- A sample that already has a stored score is never scored again, even if a
  later reading would have changed its window.
- One scoring pass scores at most 3,600 (`AnomalyModel.MAX_READINGS`)
  unscored samples, oldest first. If more remain, another pass starts after it
  finishes, until none remain.
- Scoring passes for one asset never run concurrently. Passes for different
  assets may.
- If the model fails (`MlUnavailableException`), that pass stores no scores and
  records nothing. Its samples stay unscored and are picked up by the next
  pass.

### Turning scores into assessments

- A sample is abnormal when its score is at least 0.51
  (`AnomalyModel.DECISION_THRESHOLD`).
- An **abnormal run** is a run of consecutive abnormal samples within one
  segment. Runs are worked out from stored scores, so a run can span device
  batches and scoring passes.
- A person's assessment resets the model. Only samples with `measuredAt` after
  the `createdAt` of the asset's latest assessment by a person count towards a
  run. A person is any `recordedByUserId` without the `system:` prefix. A run
  that began before that assessment is treated as starting at its first
  abnormal sample after it.
- After a pass stores scores, the longest abnormal run that contains at least
  one sample scored in that pass is considered. If several are equally long,
  the latest one is used.
- If that run has at least 10 samples (`AnomalyModel.MIN_ABNORMAL_RUN`), its
  condition is `FAULTY` when the median score of the run is at least 0.98
  (`AnomalyModel.FAULTY_THRESHOLD`), and `NEEDS_ATTENTION` otherwise.
- That condition is recorded as an `AssetAssessment` by
  `system:anomaly-model` / "Anomaly detection" (decision 0021), dated the
  run's last sample, only if the asset's current condition differs from it.
- The assessment's notes give the run's length, first and last sample times,
  median and maximum score, and say it came from device readings.
- A pass never records `GOOD`, and never records more than one assessment.
- `POST .../readings/anomaly-check` keeps its current behaviour. It does not
  store scores, and stored scores do not affect it.

### Anomaly flag on readings

The web app has no reading charts today; readings are shown as tables with
flag badges (`suspect-readings.md`). Model findings appear there as a new
flag, so no separate score view is added.

- `ReadingFlagType` gains `ANOMALY`. A device reading carries an `ANOMALY` flag
  when its asset has a stored score for its `measuredAt` that is at least
  0.51 (`AnomalyModel.DECISION_THRESHOLD`). All five readings of an abnormal
  sample are flagged.
- An `ANOMALY` flag carries `anomalyScore` (double, the stored score). Other
  flag types do not.
- Readings with a score below 0.51, readings with no score, and manual
  readings never carry `ANOMALY`.
- `ANOMALY` is not a suspect-data flag. The "Suspect only" filter keeps
  matching only `GAP`, `DUPLICATE_TIMESTAMP` and `OUT_OF_RANGE`.
- Every readings endpoint that accepts the repeated `flag` query parameter
  today accepts `ANOMALY`, combined with the other flags as "match any".
- The readings filters gain an "Anomalous only" checkbox, which sends
  `flag=ANOMALY`. It can be combined with "Suspect only", which matches either
  kind of flag.
- With "Anomalous only" set and nothing matching, the results say
  "No anomalous readings match these filters".
- In the readings tables, an `ANOMALY` flag renders as a destructive-variant
  Badge reading "Anomaly 0.87": the score, shown to 2 decimal places.
- The CSV export (`export-filtered-readings-csv.md`) uses the same flag logic,
  so `ANOMALY` appears wherever it lists flags, and `flag=ANOMALY` filters it
  the same way.
- Access is unchanged: whoever can read readings sees the flag (Owner,
  Manager, Crew).

### Feedback for retraining

These two rules need no new table or endpoint.

- Every stored score is kept with its sample time, and every person's
  assessment is kept with its time. Together they record whether a person
  agreed with each model finding. A person's `GOOD` recorded after an
  "Anomaly detection" assessment marks that run's samples as a likely false
  positive.
- The reset rule above is what makes that label usable: after a person's
  verdict, the model does not overwrite it straight away.

### Fetching the test dataset

- `ml-research/scripts/fetch_test_readings.py` is run with
  `uv run python scripts/fetch_test_readings.py` from `ml-research/`.
- It downloads the 8 held-out SKAB experiments (the `test_files` in
  `artifacts/pump-anomaly-platform/metrics.json`: `other/2`, `other/3`,
  `other/8`, `valve1/1`, `valve1/7`, `valve1/9`, `valve1/10` and `valve2/2`)
  from `https://raw.githubusercontent.com/waico/SKAB/master/data` into
  `data/skab/`, the same source and layout notebook 01 uses.
- It writes `artifacts/pump-anomaly-platform/test-readings.csv` using
  notebook 03's mapping:
  - `vibrationAcceleration` = Accelerometer1RMS;
  - `pressure` = Pressure;
  - `temperature` = Temperature;
  - `flowRate` = Volume Flow RateRMS;
  - `power` = Current × Voltage / 1000;
  - the `anomaly` label as an integer;
  - timestamps written as `YYYY-MM-DDTHH:MM:SSZ`;
  - rows sorted by experiment, then timestamp.
- The output is byte-identical to the notebook's file, which has SHA-256
  `1b67335257dc1e3e546bc71dd7f3685da53b875cde40b8c812ddda3c07fc6170` and
  8,726 data rows. The script prints the hash it produced, and exits non-zero
  if the hash differs.
- A file already in `data/skab/` is not downloaded again. A failed download
  exits non-zero, names the file, and writes no CSV.
- The test files are listed in the script itself. It does not read
  `metrics.json` (git-ignored) or import anything from `apps/`.

### Device simulator (`apps/device-simulator`)

- A separate TanStack Start app, run locally only, on port 3002, with one page
  at `/`. It has no sign-in.
- The page has these fields:
  - **API URL**, defaulting to `http://localhost:8080`;
  - **Device key**, a password input that is never stored, logged or shown;
  - **CSV file**, an upload;
  - **Experiment**, a select;
  - **Mode**, either "Backfill" or "Live".
- The CSV is parsed in the browser and is never uploaded anywhere. Its header
  must be exactly
  `experiment,timestamp,vibrationAcceleration,pressure,temperature,flowRate,power,anomaly`,
  the format of `ml-research/artifacts/pump-anomaly-platform/test-readings.csv`.
- A wrong header, a timestamp that is not ISO-8601 with an offset, a
  non-finite value, or an `anomaly` other than `0` or `1` rejects the file. The
  error names the first bad line number and field, and nothing is sent.
- After a valid file loads, the Experiment select lists each distinct
  `experiment` with its row count. For the selected experiment the page shows
  the labelled anomaly windows (rows with `anomaly = 1` that are consecutive in
  file order) as a table of start offset, end offset and length. This is the
  ground truth to compare with the asset page.
- Each CSV row becomes 5 readings sharing one `measuredAt`:

  | CSV column | Metric | Unit |
  | --- | --- | --- |
  | vibrationAcceleration | VIBRATION_ACCELERATION | g |
  | pressure | PRESSURE | bar |
  | temperature | TEMPERATURE | °C |
  | flowRate | FLOW_RATE | L/min |
  | power | POWER | kW |

- Timestamps are shifted by one offset, so the spacing between rows, including
  gaps, is preserved exactly:
  - **Backfill** shifts the experiment so its last row is at the moment Start
    is pressed, and sends every reading at once in batches of up to 500.
  - **Live** shifts the experiment so its first row is at the moment Start is
    pressed. Every 5 seconds it sends the readings whose shifted time has
    passed and which have not yet been sent.
- Each batch is sent by a TanStack Start server function. That function calls
  `POST /device-api/telemetry` through `createApiClient` from `@proj/api`, with
  the device key supplied through `getToken`. The browser never calls Spring
  directly, so Spring's device API needs no CORS.
- If a batch fails with a network error or a 5xx, it is retried up to 3 times,
  2 seconds apart. If it still fails, the run stops and shows the error. Item
  results of `INVALID` or `CONFLICT` are reported, not retried.
- A 401 or 409 stops the run and shows the server's message.
- While running, the page shows a progress count of rows sent out of total
  rows, and running counts of `CREATED`, `ALREADY_STORED`, `INVALID` and
  `CONFLICT`. It also shows the first 10 distinct `INVALID`/`CONFLICT`
  messages.
- A Stop button ends a run after its current batch. Readings already sent stay
  stored.
- Starting the same experiment again shifts the timestamps from the new start
  time, so it stores new readings rather than duplicates.

## Data

New Prisma model `AnomalyScore`, append-only, with no `updatedAt`:

- `id String @id @default(uuid()) @db.Uuid`
- `estateId`, `assetId` (`@db.Uuid`)
- `measuredAt DateTime @db.Timestamptz(6)` - the sample's time
- `score Float` (`double precision`) - `probabilities[:, 1]` from the model
- `scoredAt DateTime @db.Timestamptz(6)`
- `asset Asset @relation(fields: [assetId, estateId], references: [id, estateId], onDelete: Restrict, onUpdate: Restrict)`,
  plus the back-relation `anomalyScores AnomalyScore[]` on `Asset`
- `@@unique([assetId, measuredAt])` - so a sample is scored once, even if two
  passes race
- `@@index([assetId, measuredAt])` is covered by the unique index

Read, unchanged: `DeviceReading`, `Device`, `Asset`, `Estate`. Written,
unchanged: `DeviceReading`, `Device.lastSeenAt`, and `AssetAssessment`.

Expand-only migration, safe against the running code (decision 0029).
`pnpm db:generate` regenerates jOOQ.

Each pump at 1 Hz adds about 86k scores and 432k readings a day. There is no
retention for either in this POC (see Out of scope).

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | /device-api/telemetry | TelemetryBatchRequest | 200 TelemetryBatchResponse; 400 / 401 / 409 EstateError | Device key |

DTOs (Java records; operation ID `submitTelemetry`):

- `TelemetryBatchRequest { readings: CreateReadingRequest[] }` - 1 to 500
  items, no other fields. Taken as raw bytes and validated strictly, like
  `DeviceReadingController`.
- `TelemetryBatchResponse { results: TelemetryItemResult[] }`
- `TelemetryItemResult { index: int32, status: TelemetryItemStatus, reading?: ReadingResponse, message?: string }`.
  `reading` is present for `CREATED` and `ALREADY_STORED`, and `message` for
  `INVALID` and `CONFLICT`.
- `TelemetryItemStatus`: `CREATED | ALREADY_STORED | INVALID | CONFLICT`

Changed DTOs (existing reading endpoints; no new paths):

- `ReadingFlagType` gains `ANOMALY`.
- `ReadingFlagResponse` gains `anomalyScore?: double`, present only on
  `ANOMALY`.

`/device-api/telemetry` sits under the existing `/device-api/**` chain
(`DeviceApiSecurityConfig`). No `SecurityConfig` change is needed.

## Edge cases

- **Missing metric.** If a row is missing one metric (`INVALID` because it is
  not registered, or never sent), that timestamp is not a sample. If the gap
  that leaves is over 2 s, it splits the segment. The other metrics are still
  stored.
- **Device without all five metrics.** Its readings are stored and produce no
  samples, so a pump with only a temperature sensor is never scored.
- **Late readings.** A reading arriving after its neighbours were scored can
  complete a sample. That sample is scored with the window as it stands then,
  and already-scored neighbours are not rescored.
- **Retries of a whole batch.** Every item is `ALREADY_STORED`, nothing new is
  stored, and no scoring pass starts.
- **Concurrent passes for one asset.** These come from back-to-back backfill
  batches. They are serialised, and the unique index is the backstop, so no
  sample gets two scores and no run records two assessments.
- **A person records `GOOD` during an abnormal run.** The run's earlier
  samples stop counting. The model records again only once 10 or more
  consecutive abnormal samples are measured after that assessment's
  `createdAt`. Their `ANOMALY` flags still show, because flags come from
  scores, not from assessments.
- **A person's assessment dated in the past.** The reset uses `createdAt` (when
  it was recorded), not `assessedOn`, so backdating an assessment does not
  re-open old runs.
- **Retired asset or inactive estate.**
  - Readings on a retired pump are still stored, as today, but not scored.
  - An inactive estate rejects the batch (409), so nothing is scored.
  - Scores stored before retirement stay readable.
- **Device moved to another asset (ID-45).** Readings and scores stay with the
  asset recorded on each reading.
- **Clock.**
  - Simulator timestamps are at most "now" when sent, so the existing 5-minute
    future check never trips.
  - A backfill's readings are all in the past, which is accepted (decision
    0028).
- **Large backfill.** The largest test experiment (`valve1/9.csv`, 1,148 rows)
  is 5,740 readings in 12 batches. It is fully scored within one or two passes.
- **CSV gap.** `other/2.csv` and `valve1/7.csv` each have one gap over 2 s.
  Each produces two segments, and the rolling window restarts after the gap,
  as it did in training.
- **Simulator file.** A file with a UTF-8 BOM or Windows line endings parses.
  An empty file, or one with only a header, is rejected as having no rows.
- **Wrong key or wrong device.** A key for a device missing some of the five
  metrics yields `INVALID` items naming the unregistered metric. The simulator
  shows them, and the run continues.

## Out of scope

- MQTT, a broker, gateways as a model, store-and-forward buffering, and
  commands sent to devices.
- Deploying the simulator. It has no `wrangler.jsonc` and no CI deploy.
- Committing SKAB data. The CSV is fetched by the script and uploaded
  locally.
- Rescoring stored samples, for example after a model swap or after late
  readings.
- Retention, downsampling or rollups for readings or scores.
- Scoring for anything other than pumps, or with any model other than the one
  in `apps/server/src/main/resources/anomaly/model.onnx`.
- Alerts, notifications or automatic work orders from model assessments.
- Recording `GOOD` from the model, or the model closing a condition it opened.
- Synthetic fault generation in the simulator. It only replays uploaded CSVs.
- Charts of readings or scores, in the web app or the simulator. Findings show
  as reading flags, and the simulator shows ground-truth windows as a table.
- Exporting model feedback or retraining from it. The data is kept so that a
  later feature can (see "Feedback for retraining").
- Changes to `POST .../readings/anomaly-check`.

## Implementation phases

Test-first throughout (`.spec/testing.md`). Each phase ends green on
`pnpm check-types` and `pnpm test`.

- [x] 1. **Batch telemetry.** Server tests for each Behaviour rule, then
      `POST /device-api/telemetry` reusing `ReadingValidator` and
      `ReadingService`'s per-item logic. `pnpm api:generate`. Add
      `.docs/api/device-telemetry.md`.
- [x] 2. **Schema.** Add `AnomalyScore` to `schema.prisma`, run
      `pnpm db:migrate` and `pnpm db:generate`, and commit the migration and
      jOOQ.
- [x] 3. **Scoring.** Tests first:
      - a parity test that scores a stored segment and compares it with the
        anomaly-check path on `parity-fixture.json`;
      - segments, late readings, the 3,600 cap, model failure, serialisation;
      - run detection across passes, and assessment recording.

      Then implement it with an after-commit, asynchronous trigger from both
      ingest paths. Add a decision record: "Anomaly scoring runs on ingested
      readings" (extends 0021, whose "scored, not stored" still describes
      anomaly-check).
- [x] 4. **Anomaly flag (server).** Tests first:
      - the flag on all five readings of an abnormal sample;
      - no flag below 0.51, with no score, or on manual readings;
      - `flag=ANOMALY` filtering, alone and combined with other flags;
      - CSV export.

      Then extend the reading queries. `pnpm api:generate`. Update
      `.docs/api/readings.md`.
- [x] 5. **Anomaly flag (web).** Tests first for the badge text, the
      "Anomalous only" filter and its empty state, and "Suspect only" still
      excluding `ANOMALY`. Then update the readings filters and tables
      (shadcn Badge and Checkbox, already in `packages/ui`). Update
      `.docs/frontend/readings.md`.
- [x] 6a. **Dataset script.** Write `ml-research/scripts/fetch_test_readings.py`.
      Verify it by deleting the local CSV, running the script, and checking
      that it reports the expected hash.
- [x] 6. **Simulator app.**
      - Scaffold `apps/device-simulator` (TanStack Start, port 3002, Vitest,
        shadcn from `packages/ui`) as an Nx project.
      - Write tests first for CSV parsing and validation, timestamp shifting,
        row-to-reading mapping, batch splitting, the live-mode send schedule,
        and retry/stop.
      - Then build the page and the server function.
      - Add `apps/device-simulator/README.md` (how to run it, where to get the
        CSV with the dataset script, the SKAB GPL-3.0 note) and
        `.docs/frontend/device-simulator.md`.
- [x] 7. **End-to-end check.**
      1. Register a pump device with the five metrics and a 1 s reporting
         interval.
      2. Backfill `other/3.csv`.
      3. Confirm that `ANOMALY` flags appear on the asset's readings, that an
         "Anomaly detection" assessment appears, and that its run overlaps a
         ground-truth window.
      4. Record a person's `GOOD`, backfill again, and confirm the model does
         not re-flag until a new run of 10 or more abnormal samples after it.
      5. Record the result in this spec. Update `.docs/README.md` and the
         status table in `.spec/README.md`.

      **Result (2026-11-08, local dev against Neon branch `ep-proud-hat`):**
      - Pump "Water Pump" (3456-A0001), device "Test" with all five metrics.
      - Backfill of `other/3.csv`: 5,685 readings `CREATED`, 0 invalid or
        conflict. Scores were stored and the 15 min chart showed anomaly
        periods 10:08:40-10:13:30, overlapping the ground-truth window
        (rows 568-965, about 10:08:54-10:15:31). One short false positive
        (10:05:20-10:05:50) preceded it. No new assessment was recorded
        because the condition was already Needs attention (from an earlier
        run on 2026-11-07), as specified.
      - A person recorded `GOOD` at 10:19:46. Two further backfills whose
        abnormal samples fell before that `createdAt` recorded nothing.
      - A backfill at 10:33 put the ground-truth window after the reset. The
        model recorded Needs attention: "14 consecutive abnormal samples
        ... from 10:23:30 to 10:23:44, median 0.69, maximum 0.76", inside
        that backfill's ground-truth window (about 10:23:3x-10:30:1x).
      - Finding: the simulator's Live mode stalls while its browser tab is
        hidden (browser timer throttling) and catches up when the tab is
        visible again. Backfill is unaffected.

## Open questions

Resolved:
- **Getting the CSV:** the dataset script.
- **Port:** 3002.
- **Overriding a person's assessment:** it resets the model (see "Turning
  scores into assessments").
- **Where findings show:** an `ANOMALY` flag on the existing readings, not a
  chart. No chart dependency is added.
- **Access:** the same as readings (Owner, Manager, Crew).

None open.
