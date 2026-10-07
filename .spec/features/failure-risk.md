# Failure risk

**Status:** draft
**Owner:** Zheng Kai
**Jira:** [ID-32](https://notjira.atlassian.net/browse/ID-32) (epic [ID-10](https://notjira.atlassian.net/browse/ID-10) Council Dashboard and Budgeting; method from [ID-7](https://notjira.atlassian.net/browse/ID-7))

## Problem

Equipment that fails silently, such as a standby or booster pump, is only
discovered when a resident complains. The council cannot see which pumps are
likely to fail in the coming weeks or months, which are nearing the end of
their life, or which are misbehaving right now. It therefore cannot schedule
checks or budget for replacements before they become emergency callouts.

Today an asset records when it was installed and how its condition was last
assessed, but nothing about when it broke down or was serviced, and nothing
reads its sensors.

This spec adds two AI components that answer different questions:

| Component | Question | How it learns |
| --- | --- | --- |
| **Breakdown forecast** (Bayesian survival model) | How likely is this pump to break down in the next 30/60/90 days, and when does it reach end of life? | Online, per pump: every "Repaired" click updates that pump's estimate. |
| **Anomaly detection** (trained classifier, ONNX in `apps/ml`) | Do this pump's sensor readings look abnormal right now? | Trained offline on the SKAB pump dataset. |

Research behind the choices:

- **Notebook 01** (`ml-research/notebooks/01-skab-pump-anomaly.ipynb`): a classifier detects pump faults from sensor windows. On held-out lab experiments it scored F1 0.73 and caught about 60% of faulty readings.
- **Notebook 02** (`ml-research/notebooks/02-pump-rul.ipynb`): on a real pump dataset, sensor readings did not predict time to failure. That is why the forecast is a **weeks-to-months** Bayesian model learning from repair history, not a sensor-based model.

**Pumps only for now**, because that is the equipment the research covered.

## Behaviour

### Maintenance events

- An estate owner can record a maintenance event on an active asset in an active estate.
- An event has a type, the date it happened, and notes. All three are required.
- Types are `BREAKDOWN_REPAIR` (the asset failed and was repaired: the "Repaired" button) and `PREVENTIVE` (serviced while still working).
- The event date cannot be in the future, and cannot be before the asset's `installedOn` when that is set.
- Each event stores a snapshot of the asset's `manufacturer` and `model` at the moment it is recorded.
- Events are never edited or deleted. The asset's event list shows every one, newest first (by `occurredOn`, then `createdAt`).
- Each event records who recorded it (WorkOS user ID and a name snapshot) and when, as assessments do (decision 0017).
- A deactivated asset keeps its events visible and rejects new ones with 409.

### Which events count

A forecast only learns from the unit currently installed. When a pump is
replaced with a different brand or model, its old breakdowns stop counting.

- An event **counts** toward the forecast only if:
  - its `occurredOn` is on or after the asset's current `installedOn` (when set), and
  - its manufacturer and model snapshot match the asset's current `manufacturer` and `model`. Values are trimmed and compared case-insensitively, and null matches only null.
- Events that don't count stay in the event list. They are marked `countsTowardForecast: false`.

### Breakdown forecast

The forecast is computed on read from the asset's counting events. Nothing
about it is stored, so recording or back-dating an event changes the next read.

- Only `PUMP` assets get a forecast. Any other category has basis `NOT_SUPPORTED`, and its probabilities are null.
- Time is measured in days.
- The pump starting estimate (the **prior**):
  - mean time between breakdowns `m = 1095` days (3 years)
  - wear-out shape `k = 1.2`
  - weight `a₀ = 0.5`: the starting estimate counts as half a breakdown's worth of evidence
  - prior scale `θ₀ = (m / Γ(1 + 1/k))^k`, and `b₀ = a₀ · θ₀`
- The counting history is split into intervals. The first starts at `installedOn`, and each counting event ends one interval and starts the next. An interval ending in `BREAKDOWN_REPAIR` is a **failure**. One ending in `PREVENTIVE` is **censored**: it survived that long.
- The updated estimate (the **posterior**) is `a = a₀ + failures` and `b = b₀ + Σ tᵢ^k` over all closed intervals, failed and censored.
- `u` is the number of days since the last counting event, or since `installedOn` when there are none, up to today.
- The probability of failure within `h` days is `1 − ((b + u^k) / (b + (u + h)^k))^a`, reported for `h` = 30, 60 and 90.
- With these constants (each value is P30 / P90):

  | Scenario | P30 / P90 |
  | --- | --- |
  | A new pump | ≈ 0.01 / 0.04 |
  | 3 years in service, no breakdowns | ≈ 0.01 / 0.03 |
  | Broke down twice, 180 days apart, last 90 days ago | ≈ 0.06 / 0.17 |
  | Broke down 4 times, 90 days apart, last 60 days ago | ≈ 0.11 / 0.29 |

  These values become unit-test fixtures.
- `basis` is `ASSET_HISTORY` when at least one counting `BREAKDOWN_REPAIR` exists, otherwise `SERVICE_INTERVAL`. The response also reports `failuresObserved` (counting failures only).
- A pump with no `installedOn` and no counting events has basis `INSUFFICIENT_DATA`. Its probabilities are null.
- The **risk threshold is 0.15**, about four times a typical pump's 90-day risk.
- The recommended timeframe is the first of 30, 60 or 90 days whose probability reaches the threshold. Otherwise it is `BEYOND_90_DAYS`, or null when the probabilities are null.

### End of life

- A pump's expected lifespan is 15 years from `installedOn`.
- `expectedEndOfLife` is `installedOn` + 15 years, or null when `installedOn` is null.
- A pump is **nearing end of life** once its age reaches 80% of the lifespan (12 years).

### Anomaly detection

A pump is monitored by a device mounted on it that reports vibration,
pressure, temperature, flow rate and power, about once a second.

- **Metric catalogue:**
  - The catalogue gains `VIBRATION_ACCELERATION` in **g (RMS)**, the unit accelerometers report and the model was trained on.
  - The existing `VIBRATION` (mm/s) is unchanged (decision 0016).
- **Model inputs:**
  - The model uses five metrics: `VIBRATION_ACCELERATION`, `PRESSURE`, `TEMPERATURE`, `FLOW_RATE` and `POWER`.
  - Its feature order, decision threshold and condition thresholds come from the model's `metrics.json`. The server holds them as constants copied from that file.
- **Submitting readings:**
  - An estate owner can submit a batch of readings for an active `PUMP` asset in an active estate.
  - A reading has a timestamp and a value for each of the five metrics. All are required.
  - A batch holds 10 to 3,600 readings.
  - Readings are sorted by timestamp, and must be strictly increasing with gaps of at most 2 seconds. Otherwise the batch is rejected with 400.
- **Scoring:**
  - The server computes the model's features for every reading, using the same rolling windows as the training notebook, and sends them to `apps/ml` `POST /predict` in one call.
  - Each reading gets an anomaly score, the model's anomaly probability.
  - A reading is **abnormal** when its score reaches the model's decision threshold.
- **Recording a condition:**
  - When at least 10 consecutive readings in the batch are abnormal, the server records a condition assessment (decision 0017).
  - The condition is `FAULTY` if the median score of the longest abnormal run reaches the model's Faulty threshold, and `NEEDS_ATTENTION` otherwise.
  - The assessment is dated the day of the run's last reading.
  - Its notes state the run's length, its median and maximum scores, and its start and end times.
  - It is recorded as the system identity `system:anomaly-model`, with the name "Anomaly detection".
- **No duplicates:** no assessment is recorded when the asset's current condition already equals the condition that would be recorded.
- **Not stored:** readings themselves are not stored. Storing readings is ID-43.
- **Response:** the number of readings scored, the number abnormal, the longest abnormal run, the maximum score, and the condition recorded (or null).
- **Effect on flags:** an assessment recorded this way makes the pump flagged with reason `CONDITION`, like any other assessment.

### Flags

- An asset is **flagged for a check** when any of these apply, and every reason that applies is reported:
  - `CONDITION`: its current condition (decision 0017) is `NEEDS_ATTENTION` or `FAULTY`, whether recorded by a person or by anomaly detection.
  - `FAILURE_RISK`: its 90-day probability reaches the risk threshold.
  - `END_OF_LIFE`: it is nearing end of life.
- The silent-failure categories are a fixed server-side set, currently only `PUMP`.
- The estate's failure-risk list contains the active assets in silent-failure categories. Flagged assets come first, then the rest by 90-day probability, highest first. Assets with null probabilities come last.
- Only the estate owner can read forecasts or events, or submit readings. Anyone else gets 404, the same as for an unknown ID.

## Data

New Prisma model `AssetMaintenanceEvent`, append-only like `AssetAssessment`:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | |
| `estateId` | UUID | FK → Estate |
| `assetId` | UUID | Composite FK `(assetId, estateId)` → Asset |
| `type` | varchar(30) | `BREAKDOWN_REPAIR` or `PREVENTIVE` |
| `occurredOn` | date | |
| `notes` | varchar(2000) | |
| `assetManufacturer` | varchar(200)? | Snapshot of `Asset.manufacturer` when recorded |
| `assetModel` | varchar(200)? | Snapshot of `Asset.model` when recorded |
| `recordedByUserId` | varchar(255) | |
| `recordedByName` | varchar(200)? | WorkOS snapshot, null if the lookup failed |
| `createdAt` | timestamptz | No `updatedAt`: rows never change |

Indexes are `@@index([estateId])` and `@@index([assetId, occurredOn, createdAt])`.
Add the back-relations on `Estate` and `Asset`.

Other changes involve no new tables:
- `AssetAssessment` rows written by anomaly detection use `recordedByUserId = "system:anomaly-model"`. No schema change is needed.
- `VIBRATION_ACCELERATION` is a new value in the `DeviceMetric` enum. Device metrics are stored as strings, so no migration is needed.
- The pump prior, the lifespan, the risk threshold, the silent-failure set and the model's thresholds are server-side constants, not tables, like the metric catalogue (decision 0016).
- No forecast state and no readings are stored.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/assets/{assetId}/maintenance-events | - | MaintenanceEventResponse[] (newest first) | Owner |
| POST | /estates/{estateId}/assets/{assetId}/maintenance-events | CreateMaintenanceEventRequest | 201 MaintenanceEventResponse | Owner |
| GET | /estates/{estateId}/assets/{assetId}/failure-risk | - | FailureRiskResponse | Owner |
| GET | /estates/{estateId}/failure-risk | - | FailureRiskResponse[] (silent-failure categories, ordered as above) | Owner |
| POST | /estates/{estateId}/assets/{assetId}/readings/anomaly-check | AnomalyCheckRequest | AnomalyCheckResponse | Owner |

**Request and response fields**

`CreateMaintenanceEventRequest`:
- `type`
- `occurredOn`
- `notes`

`MaintenanceEventResponse`:
- Event: `id`, `assetId`, `type`, `occurredOn`, `notes`
- Unit snapshot: `assetManufacturer`, `assetModel`
- `countsTowardForecast`
- Recorder: `recordedByUserId`, `recordedByName`, `createdAt`

`FailureRiskResponse`:
- Asset: `assetId`, `assetReference`, `assetName`, `category`
- Forecast: `basis` (`SERVICE_INTERVAL`, `ASSET_HISTORY`, `INSUFFICIENT_DATA` or `NOT_SUPPORTED`), `failuresObserved`, `daysSinceLastEvent`
- Probabilities: `probability30Days`, `probability60Days`, `probability90Days` (number or null)
- `recommendedTimeframe`: `WITHIN_30_DAYS`, `WITHIN_60_DAYS`, `WITHIN_90_DAYS`, `BEYOND_90_DAYS` or null
- `expectedEndOfLife`: date or null
- Flags: `flagged` and `flagReasons` (`CONDITION`, `FAILURE_RISK`, `END_OF_LIFE`)

`AnomalyCheckRequest`:
- `readings[]`, each with:
  - `timestamp`
  - `vibrationAcceleration` (g)
  - `pressure` (bar)
  - `temperature` (°C)
  - `flowRate` (L/min)
  - `power` (kW)

`AnomalyCheckResponse`:
- `readingsScored`, `abnormalReadings`, `longestAbnormalRun`, `maxScore`
- `conditionRecorded`: `NEEDS_ATTENTION`, `FAULTY` or null

## Edge cases

- **Failures:**
  - Validation failures return 400: a future date, a date before `installedOn`, blank notes, or an unknown type.
  - An unknown asset or estate, or one the caller doesn't own, returns 404.
  - A new event on a deactivated asset or in an inactive estate returns 409.
- **Replacing a unit:**
  - When a pump is replaced, the owner edits its `manufacturer`, `model` and `installedOn`. Earlier events then stop counting, and the forecast restarts from the prior.
  - If only `installedOn` is moved later, events before it stop counting. If only `manufacturer` or `model` changes, events with the old snapshot stop counting, and `u` runs from `installedOn`.
  - A pump with no `manufacturer` or `model` recorded still learns. Its null snapshots match while both values stay null.
- **Event dates:**
  - Two counting events on the same date form a zero-length interval. A failure there adds to `a` but nothing to `b`. This is allowed.
  - A back-dated event changes the next forecast read, because the forecast is derived on read.
- **Forecast inputs:**
  - A non-pump asset's per-asset forecast returns basis `NOT_SUPPORTED` with null probabilities, never 404. Its `CONDITION` flag still applies.
  - A deactivated asset's per-asset forecast is readable. It is excluded from the estate list.
  - The condition reason uses the current assessment only. An asset never assessed has no condition reason.
- **Anomaly check:**
  - **Bad input returns 400:** fewer than 10 or more than 3,600 readings, a missing or non-finite value, duplicate or out-of-order timestamps after sorting, or a gap over 2 seconds.
  - **Wrong asset:** a non-pump asset returns 409. So does a deactivated asset or an inactive estate.
  - **ML service failing:** `apps/ml` unreachable, over a 5-second timeout, or with no model loaded returns 503 with a clear message. Nothing is recorded, and the caller can resend the batch.
  - **Batch boundaries:** the rolling windows start fresh in each batch, so an abnormal run is never split across two batches. Devices should send batches of at least a minute.
  - **Only one assessment per batch**, for its longest abnormal run.
  - **Concurrent batches:** two batches for the same pump at the same moment can both record an assessment. This is acceptable: assessments are append-only history.
- **Precision:** probabilities are returned as doubles in [0, 1]. The UI rounds them to whole percentages.
- **Shared code:** the recorder-name lookup reuses the assessment code path. If WorkOS is down, the event is still saved and `recordedByName` is null.
- **Web:** query keys include the signed-in user ID. The record-event form keeps its input on a server error and blocks double submits.

## Out of scope

- **Categories other than `PUMP`.** Each needs its own prior, lifespan and anomaly model.
- **Device authentication and storing readings** (ID-42, ID-43). In this spec the owner's token submits a batch, and the batch is scored, not stored. Real devices posting with their own credentials comes later.
- **Readings not tied to a registered device.** The check is per asset. Matching each reading to a `Device` is ID-43.
- **Replacement cost estimates.** Cost data comes from the invoice system and is handled separately.
- **Learning across pumps:** sharing history between identical pumps, or updating the pump prior from the estate's history. Each pump learns only from its own events.
- **Feeding anomaly scores into the forecast.** For example, raising breakdown risk for a pump that is often abnormal. This needs real readings and repair history to validate first.
- **Event changes:** editing or deleting maintenance events, costs on events, and work orders (ID-2, ID-49, ID-50).
- **Access for estate users.** Access stays owner-only, like assets. A council only sees its own estate, so the per-estate page is the dashboard.
- **Notifications or emails** when an asset becomes flagged.

## Dependencies

- [building-assets](building-assets.md), [asset-condition](asset-condition.md) and [device-registration](device-registration.md) are built.
- `apps/ml` serves one ONNX model through the generic `/predict` endpoint (decision 0007). Phase 0b supplies that model.
- ID-49 (maintenance records) overlaps with `AssetMaintenanceEvent`. See Open questions.

## Implementation phases

Test-first: every test is seen failing before the phase that makes it pass
([testing.md](../testing.md)).

### 0. Research (`ml-research/`, run in fresh sessions)

Each task is self-contained. Read this spec and the named notebook first. Do
not touch `apps/`, install nothing, and commit nothing.

#### 0a. Compare the Bayesian forecast in notebook 02
- [ ] **Goal:** add the Bayesian survival method to `notebooks/02-pump-rul.ipynb` as a baseline, evaluated the same way as the existing candidates, so the report can compare it directly with the trained models.
- [ ] **Method:**
  - For each failure cycle, start from a weak prior and update it **only with earlier cycles**, as the app does after each "Repaired" click.
  - Use the notebook's own time scale (hours): the 3-year pump constants above don't apply to this dataset.
  - Fit or justify the prior's `m` and `k` from the training cycles only, and state the weight `a₀` used.
- [ ] **Report:**
  - MAE on the capped hours-to-failure target, using the posterior median.
  - The 24 h / 48 h early-warning table, using P(fail within h) ≥ threshold.
  - Interval coverage, using posterior quantiles.
  - All alongside the existing rows: sensors, sensors + age, age only, mean, service-interval rule.
- [ ] **Conclusions:** with only 7 failures, the differences are noisy. Say so plainly, and don't pick a winner on noise.
- [ ] **Output:** update the notebook's conclusions and `artifacts/pump-rul/metrics.json`, then clear the outputs as before.

#### 0b. Retrain the anomaly model on platform metrics
- [ ] **New notebook:** `notebooks/03-pump-anomaly-platform-metrics.ipynb`. Keep 01 as the research record and reuse its split, cross-validation and held-out protocol.
- [ ] **Inputs:** five inputs mapped from SKAB:
  - `Accelerometer1RMS` → vibration acceleration (g RMS)
  - `Pressure` → pressure (bar)
  - `Temperature` → temperature (°C)
  - `Volume Flow RateRMS` → flow rate (L/min; confirm SKAB's unit)
  - `Current × Voltage / 1000` → power (kW). State that this ignores power factor.
  - Drop `Accelerometer2RMS` and `Thermocouple`.
- [ ] **Compare:** set it against notebook 01's 8-sensor result (F1 0.73). Report what was lost and whether the 5-input model is still useful.
- [ ] **Features:** keep them computable in Spring from the readings alone: raw values and rolling mean and std over the last 10 readings. Export about 50 rows of input readings with their expected features and scores as a parity fixture for the Spring test.
- [ ] **Export:**
  - ONNX with an sklearn parity assert.
  - `metrics.json` with the feature order, decision threshold and Faulty threshold.
  - Artifacts in `artifacts/pump-anomaly-platform/`.
- [ ] **Simulation dataset:** save the held-out test experiments as `artifacts/pump-anomaly-platform/test-readings.csv`, for driving simulated pumps against the anomaly-check endpoint.
  - **Columns:** `experiment`, `timestamp`, `vibrationAcceleration`, `pressure`, `temperature`, `flowRate`, `power`, `anomaly`.
  - **Raw readings:** these are readings in platform units, not engineered features. The reading columns use the `AnomalyCheckRequest` field names, so rows can be posted as-is. `anomaly` is the ground truth, for checking what the endpoint flags.
  - **Rows:** ordered by experiment, then timestamp. List the experiments in the README.
- [ ] **Licence:** record that SKAB is GPL-3.0 and that the model is used for education only.
- [ ] **Hand-off:** copy `model.onnx` to `apps/ml/models/model.onnx`. It is committed with the Spring constants it matches; see Resolved.

### 1. Decision
- [ ] Add `.spec/decisions/0020-failure-risk-is-a-bayesian-weibull-on-repair-history.md`. It records:
  - why the forecast is closed-form arithmetic in Spring rather than a model in `apps/ml`
  - why it is derived on read rather than stored
  - why history resets on a unit replacement
  - that the sensor-based remaining-life model was rejected (notebook 02)
- [ ] Add `.spec/decisions/0021-anomaly-detection-records-system-assessments.md`. It records:
  - that model-generated conditions are ordinary assessments under the `system:anomaly-model` identity, rather than a separate table
  - that `VIBRATION_ACCELERATION` (g) is added rather than converting to mm/s
  - that readings are scored, not stored, until ID-43

### 2. Data (`add-model` skill)
- [ ] Add `AssetMaintenanceEvent` and its back-relations to `schema.prisma`.
- [ ] Run `pnpm db:migrate`, `pnpm db:generate`, then `./mvnw -pl com.proj:server compile`.

### 3. Server tests (red)
- [ ] `FailureRiskCalculatorTests` (plain unit tests):
  - [ ] The four scenarios in the Breakdown forecast table match to two decimal places.
  - [ ] A `BREAKDOWN_REPAIR` raises `a`. A `PREVENTIVE` interval raises only `b`.
  - [ ] Events before `installedOn`, or with a different manufacturer or model snapshot, are ignored.
  - [ ] The basis rules hold, including `NOT_SUPPORTED` for non-pumps.
  - [ ] The timeframe uses the 0.15 threshold.
  - [ ] The end-of-life date and the 12-year flag.
- [ ] `MaintenanceEventControllerTests`:
  - [ ] Create and list ordering.
  - [ ] The manufacturer and model snapshot, and `countsTowardForecast`.
  - [ ] 400s, 404s and 409s.
  - [ ] The recorder snapshot.
  - [ ] A missing JWT subject is rejected.
- [ ] `FailureRiskControllerTests`:
  - [ ] The per-asset response.
  - [ ] The estate list holds pumps only, in the right order.
  - [ ] All three flag reasons, including a `CONDITION` flag from a system assessment.
  - [ ] Deactivated assets are excluded from the list.
  - [ ] Another owner gets 404.
- [ ] `AnomalyFeatureTests` (unit): features match the 0b parity fixture.
- [ ] `AnomalyCheckControllerTests`, with `apps/ml` replaced by a stub server returning fixed scores:
  - [ ] 10 abnormal readings in a row record `NEEDS_ATTENTION` or `FAULTY`, per the median rule.
  - [ ] 9 in a row record nothing.
  - [ ] No duplicate when the condition is unchanged.
  - [ ] The system identity, date and notes are correct.
  - [ ] The 400s, 404s and 409s from Edge cases.
  - [ ] The stub timing out, or returning 503, gives 503 and records nothing.
- [ ] `DeviceMetric` includes `VIBRATION_ACCELERATION` with unit `g`.
- [ ] Run the tests and confirm they fail.

### 4. API (green, `add-endpoint` skill)
- [ ] Package `com.proj.server.maintenance` for events.
- [ ] Package `com.proj.server.risk` for the calculator, the pump constants, the silent-failure set and the controller.
- [ ] Package `com.proj.server.anomaly`:
  - the feature builder and the model constants
  - an `MlClient` for `POST /predict` that reads `ML_API_URL`, with a 5-second timeout
  - the controller
- [ ] Add `VIBRATION_ACCELERATION("g")` to `DeviceMetric`.
- [ ] Make the tests pass, then run `pnpm api:generate` and `pnpm check-types`.
- [ ] Update `architecture.md`: `ML_API_URL` is now read by the server.

### 5. Web tests (red)
- [ ] `tests/lib/maintenance-events.test.ts` and `tests/lib/failure-risk.test.ts`:
  - [ ] Query keys include the user and estate IDs.
  - [ ] Failed requests throw.
  - [ ] Recording an event invalidates the asset's events and its forecasts.
- [ ] A test for the record-event dialog:
  - [ ] Labelled type, date and notes fields.
  - [ ] Required errors show.
  - [ ] Submit posts the payload.
  - [ ] Input is kept on a server error.
  - [ ] No double submit.
- [ ] A test for the failure-risk page:
  - [ ] Rows show the percentages, timeframe, end-of-life date and flag reasons.
  - [ ] The empty state shows.
  - [ ] `INSUFFICIENT_DATA` rows say "Not enough data".
- [ ] The device form offers "Vibration acceleration (g)".
- [ ] Run `pnpm nx test web` and confirm the tests fail.

### 6. Web (green)
- [ ] `src/lib/maintenance-events.ts` and `src/lib/failure-risk.ts`.
- [ ] Asset detail page:
  - [ ] A "Maintenance" section listing events, with the ones that don't count marked "Previous unit".
  - [ ] A "Record repair" button opening the record-event dialog, with the type defaulting to `BREAKDOWN_REPAIR`.
  - [ ] A forecast card, shown for pumps.
  - [ ] System assessments in the condition history are labelled "Anomaly detection".
- [ ] Route `_auth/estates/$estateId/failure-risk/index.tsx`, with its components in `-components/`, linked from the estate details page.
- [ ] Use shadcn components throughout.
- [ ] No upload screen for readings: devices and scripts call the endpoint directly.

### 7. Finish
- [ ] Docs:
  - New: `.docs/api/maintenance-events.md`, `.docs/api/failure-risk.md`, `.docs/api/anomaly-check.md`, `.docs/frontend/failure-risk.md`.
  - Update: `.docs/frontend/assets.md`, `.docs/frontend/devices.md` and `.docs/README.md`.
- [ ] Run `pnpm fix`, `pnpm check-types` and `pnpm test`.
- [ ] Commit the migration, jOOQ sources, `openapi.json` and `schema.ts` with the code.
- [ ] Set this spec's status to built.

## Estimates and why

These are agreed starting estimates, not measured values. Revisit them once
estates have a year or more of repair history.

| Constant | Value | Reasoning |
| --- | --- | --- |
| Mean time between breakdowns | 3 years | Condo booster and transfer pumps typically need a breakdown repair (seal, bearing, motor) every 2–5 years. 3 years is the cautious middle. |
| Wear-out shape `k` | 1.2 | Mild wear-out. Seals and bearings make an older unit somewhat more likely to fail, but pumps also fail at random (debris, dry running). |
| Prior weight `a₀` | 0.5 | The starting estimate counts as half a breakdown, so a pump's own history dominates from its first breakdown. Higher weights barely moved the forecast for a pump breaking down every 90 days (P90 only 0.14–0.21). |
| Risk threshold | 0.15 | A typical pump's 90-day risk is about 0.03–0.04. 0.15 flags pumps with a record of repeat breakdowns (both history scenarios above) and leaves normal ones alone. |
| Lifespan | 15 years | Published service lives for building pumps run about 10–20 years. |
| End-of-life flag | 80% (12 years) | Gives the council roughly 3 years of budgeting lead time. |
| Abnormal run | 10 consecutive readings | About 10 s at 1 Hz, the same as the model's window. One noisy reading never records a condition. |
| Reading gap | 2 seconds | The model was trained on readings about once a second. Wider gaps break its rolling windows. |

## Open questions

1. **ID-49 overlap.** Should `AssetMaintenanceEvent` become ID-49's maintenance record, which ID-49 later extends with costs and work-order links, or should ID-49's spec define it first?

Resolved:
- **Licence:** GPL-3.0 is acceptable. The project is for education only.
- **Served model:** commit `apps/ml/models/model.onnx` (about 4 MB) in the same commit as the Spring constants copied from its `metrics.json` (feature order and thresholds), so the two cannot drift. The Docker image copies `apps/ml/models`, so the model must be in the repo for the build to serve it.
- **Model accuracy:** a weaker 5-input model is acceptable. The anomaly check is exercised with simulated readings from the held-out test set.
- **Estimates:** use the estimates above.
- **Scope:** pumps only for now.
- **Brand and model:** history resets when a different brand or model is installed.
- **End of life:** an end-of-life flag is included.
- **Vibration:** measured by a device mounted on the pump, reporting acceleration in g.
- **Cost:** replacement cost is out of scope. Cost data comes from the invoice system.
- **Dashboard:** the per-estate page is the dashboard.
