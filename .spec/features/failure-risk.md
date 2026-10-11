# Failure risk

**Status:** agreed
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

### Asset categories

Asset categories move from the server's `AssetCategory` enum to an
`AssetCategory` table. Assets and catalogue models both reference it, so a
category is defined once, with its label, and Postgres enforces it.

- **Fields:** a category has a stable `code`, which is what assets store, and a display `label`.
- **Seeded by migration:** rows are added only by migrations. No screen manages them in this spec.
- **Categories:** the existing 8 codes keep their values, so existing assets need no rewrite. Five are new.

  | Code | Label | Examples |
  | --- | --- | --- |
  | `LIFT` | Lift & escalator | Passenger and service lifts, escalators |
  | `PUMP` | Pump | Booster, transfer, sump, sewage ejector, pool and fire pumps |
  | `GENERATOR` | Generator | Standby generator, automatic transfer switch |
  | `ELECTRICAL` | Electrical | Switchboards, transformers, lightning protection, EV chargers |
  | `LIGHTING` | Lighting | Common-area, car park and emergency lighting |
  | `FIRE_SAFETY` | Fire safety | Alarm panels, sprinklers, hose reels, extinguishers, detectors |
  | `HVAC` | Air-con & ventilation | AHUs, fans, chillers, split units, car park ventilation |
  | `PLUMBING` | Plumbing & water | Water tanks, water heaters, valves, piping |
  | `SECURITY` | Security & access | CCTV, access control, intercom, gantries, vehicle barriers, gates |
  | `WASTE` | Waste handling | Refuse chutes, compactors, pneumatic waste systems |
  | `FACADE_ACCESS` | Facade access | Gondola or BMU, anchor points |
  | `RECREATION` | Recreation | Pool filtration, gym and playground equipment |
  | `OTHER` | Other | |

- **Classify by what the equipment is, not where it is:** a pool pump or a fire pump is a `PUMP`.
- **Asset requests still send the code as text.** An unknown code returns 400.
- **Labels come from the server:** the web app reads them from the categories endpoint, and drops its hard-coded label map.
- **Behaviour stays in code:**
  - The forecast prior, the lifespan, the anomaly model and the silent-failure set stay server-side constants, keyed by category code.
  - A category with no constants simply gets no forecast.
  - The server keeps one constant per code it branches on (for example `PUMP`), not an enum of every category.
- **Event categories are separate:** `AssetEventCategory` (`MAINTENANCE`) classifies events, not assets, and stays an enum (see Asset events).

### Manufacturer and model catalogue

Manufacturers and models are shared by all estates, so the same pump model is
one record everywhere, not free text that varies by spelling.

- **Manufacturer:**
  - A manufacturer has a name, unique across all estates.
  - Names are **stored normalised**: trimmed, inner whitespace collapsed to one space, uppercased. "Grundfos", " grundfos " and "GRUNDFOS" are all stored and shown as `GRUNDFOS`.
- **Model:**
  - A model belongs to one manufacturer and one asset category, from the same `AssetCategory` table assets use.
  - Its name is normalised the same way, and unique per manufacturer and category. A mis-categorised entry therefore never blocks the correct one.
  - Manufacturers have no category: one manufacturer can make pumps and fans.
  - An asset's model must have the asset's category.
  - A model cannot be recorded without a manufacturer.
- **Adding on the fly:**
  - The asset create and edit requests still take `manufacturer` and `model` as text, so those fields keep their shape.
  - The server normalises the text, then finds the manufacturer by that name or creates it. It then does the same for the model under that manufacturer and the asset's category.
  - Whoever can save the asset can add to the catalogue. There is no separate "add manufacturer" step.
  - Asset responses still return `manufacturer` and `model` as text, using the catalogue's normalised names.
- **Suggestions:**
  - The asset form suggests existing manufacturers as the user types, then that manufacturer's models in the asset's chosen category.
  - Typing a name that isn't listed is allowed. It is added when the asset is saved.
  - Any signed-in user can read the catalogue. It holds no estate data.
- **No edits:** catalogue entries are never renamed, merged or deleted in this spec. An entry no asset uses stays in the catalogue.

### Asset events

An asset event records something that happened to an asset on a date. It is
the asset's general history, so later features add new event types rather than
new tables.

- An estate owner can record an event on an active asset in an active estate.
- An event has a type, the date it happened, and notes. All three are required.
- Every type belongs to one category. The category is derived from the type, never sent or stored separately.
- Event categories and types are fixed server-side enums, like the metric catalogue (decision 0016). They are not asset categories. This spec adds one category with two types:

  | Category | Type | Meaning |
  | --- | --- | --- |
  | `MAINTENANCE` | `BREAKDOWN_REPAIR` | The asset failed and was repaired: the "Repaired" button. |
  | `MAINTENANCE` | `PREVENTIVE` | Serviced while still working. |

- **Adding a type:** a new kind of record becomes a new type when it fits an event's columns (date, notes, recorder, unit snapshot) and is append-only. A record that needs its own columns or its own lifecycle, such as a work order, gets its own table instead.
- The event date cannot be in the future, and cannot be before the asset's `installedOn` when that is set.
- Each event stores a snapshot of the asset's catalogue manufacturer and model (their IDs) at the moment it is recorded.
- Events are never edited or deleted. The asset's event list shows every one, newest first (by `occurredOn`, then `createdAt`).
- Each event records who recorded it (WorkOS user ID and a name snapshot) and when, as assessments do (decision 0017).
- A deactivated asset keeps its events visible and rejects new ones with 409.

### Which events count

A forecast only learns from the unit currently installed. When a pump is
replaced with a different brand or model, its old breakdowns stop counting.

- An event **counts** toward the forecast only if:
  - its type is `BREAKDOWN_REPAIR` or `PREVENTIVE` (types added later do not count unless their spec says so), and
  - its `occurredOn` is on or after the asset's current `installedOn` (when set), and
  - its manufacturer and model snapshot IDs equal the asset's current ones. Null matches only null.
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

New Prisma model `AssetCategory`, shared by all estates:

| Field | Type | Notes |
| --- | --- | --- |
| `code` | varchar(30) | Primary key. Stable: never renamed. |
| `label` | varchar(100) | |

- The migration seeds the 13 rows in Asset categories.
- `Asset.category` becomes a FK → `AssetCategory.code`. Its column and values are unchanged.
- Rows are never deleted while referenced (`onDelete: Restrict`).

New Prisma model `Manufacturer`, shared by all estates (no `estateId`):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | |
| `name` | varchar(200) | `@unique`. Stored normalised (uppercase). |
| `createdAt` | timestamptz | No `updatedAt`: rows never change |

New Prisma model `AssetModel` (not `Model`, which reads ambiguously in Prisma):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | |
| `manufacturerId` | UUID | FK → Manufacturer |
| `category` | varchar(30) | FK → `AssetCategory.code` |
| `name` | varchar(200) | Stored normalised (uppercase). `@@unique([manufacturerId, category, name])` |
| `createdAt` | timestamptz | |

`AssetModel` also has `@@unique([id, manufacturerId])` and
`@@unique([id, manufacturerId, category])`, as the targets of the composite
foreign keys below.

Changes to `Asset`:
- Drop `manufacturer` and `model`.
- Add `manufacturerId` UUID? → Manufacturer, and `modelId` UUID?.
- Composite FK `(modelId, manufacturerId, category)` → `AssetModel(id, manufacturerId, category)`, so Postgres rejects a model from a different manufacturer or category.
- Index `@@index([modelId])`.
- **Data migration**, in the same Prisma migration:
  - Insert the distinct normalised manufacturer names from existing assets, then the models per manufacturer and the asset's category.
  - Point each asset at its rows, then drop the text columns.
  - An asset with a model but no manufacturer gets the manufacturer `UNKNOWN`, created by the migration only if needed.

New Prisma model `AssetEvent`, append-only like `AssetAssessment`:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | UUID | |
| `estateId` | UUID | FK → Estate |
| `assetId` | UUID | Composite FK `(assetId, estateId)` → Asset |
| `type` | varchar(30) | An `AssetEventType` value. The category is not stored: it is derived from the type. |
| `occurredOn` | date | |
| `notes` | varchar(2000) | |
| `manufacturerId` | UUID? | FK → Manufacturer. Snapshot of `Asset.manufacturerId` when recorded. |
| `modelId` | UUID? | Composite FK `(modelId, manufacturerId)` → AssetModel. Snapshot of `Asset.modelId`. |
| `recordedByUserId` | varchar(255) | |
| `recordedByName` | varchar(200)? | WorkOS snapshot, null if the lookup failed |
| `createdAt` | timestamptz | No `updatedAt`: rows never change |

Indexes are `@@index([estateId])` and `@@index([assetId, occurredOn, createdAt])`.
Add the back-relations on `Estate`, `Asset`, `Manufacturer` and `AssetModel`.

Other changes involve no new tables:
- `AssetAssessment` rows written by anomaly detection use `recordedByUserId = "system:anomaly-model"`. No schema change is needed.
- `VIBRATION_ACCELERATION` is a new value in the `DeviceMetric` enum. Device metrics are stored as strings, so no migration is needed.
- The pump prior, the lifespan, the risk threshold, the silent-failure set and the model's thresholds are server-side constants, not tables, like the metric catalogue (decision 0016).
- No forecast state and no readings are stored.
- Event categories and types are server-side enums, not lookup tables. Adding a type is a code change and a contract regeneration (decision 0016). Since `type` stores a stable code, moving to lookup tables later is a data migration only.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /asset-categories | - | AssetCategoryResponse[] (by label) | Signed in |
| GET | /manufacturers?query= | - | ManufacturerResponse[] | Signed in |
| GET | /manufacturers/{manufacturerId}/models?category=&query= | - | AssetModelResponse[] | Signed in |
| GET | /estates/{estateId}/assets/{assetId}/events | - | AssetEventResponse[] (newest first) | Owner |
| POST | /estates/{estateId}/assets/{assetId}/events | CreateAssetEventRequest | 201 AssetEventResponse | Owner |
| GET | /estates/{estateId}/assets/{assetId}/failure-risk | - | FailureRiskResponse | Owner |
| GET | /estates/{estateId}/failure-risk | - | FailureRiskResponse[] (silent-failure categories, ordered as above) | Owner |
| POST | /estates/{estateId}/assets/{assetId}/readings/anomaly-check | AnomalyCheckRequest | AnomalyCheckResponse | Owner |

The asset create, edit and read endpoints keep their fields (see Manufacturer
and model catalogue). One contract change: `category` on asset requests and
responses becomes a plain string code instead of an enum, because the valid
values now live in the database.

`AssetCategoryResponse`: `code`, `label`

**Request and response fields**

Catalogue lookups:
- `query` is optional. The query is normalised the same way, and matches are names containing it, ordered by name, at most 20.
- An unknown `manufacturerId` returns 404.
- The models lookup requires `category`. An unknown category returns 400.

`ManufacturerResponse`: `id`, `name`

`AssetModelResponse`: `id`, `manufacturerId`, `category`, `name`

`CreateAssetEventRequest`:
- `type`
- `occurredOn`
- `notes`

`AssetEventResponse`:
- Event: `id`, `assetId`, `category`, `type`, `occurredOn`, `notes`
- Unit snapshot: `assetManufacturer`, `assetModel` (catalogue names, or null)
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
  - Re-typing the same name with different case or spacing resolves to the same catalogue row, so it does not reset history.
  - Changing an asset's category resolves its model under the new category, which is a different row, so earlier events stop counting.
- **Categories:**
  - An unknown category code returns 400 on asset create or edit, and on the models lookup.
  - Every server constant keyed by a code (such as `PUMP`) must have a seeded row. A server test checks this.
- **Catalogue:**
  - A `model` without a `manufacturer` returns 400 on asset create or edit.
  - Two saves adding the same new name at once both resolve to one row: insert on conflict of the unique name, then read it back.
  - A typo creates a new entry. Cleaning those up is out of scope.
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

- **Managing asset categories in the app.** Rows come from migrations only. An admin screen is a later spec.
- **Managing the catalogue:** renaming, merging or deleting manufacturers and models, or an admin screen for them.
- **Device models.** `Device.model` stays free text: sensor hardware is a different catalogue.
- **Categories other than `PUMP`.** Each needs its own prior, lifespan and anomaly model.
- **Device authentication and storing readings** (ID-42, ID-43). In this spec the owner's token submits a batch, and the batch is scored, not stored. Real devices posting with their own credentials comes later.
- **Readings not tied to a registered device.** The check is per asset. Matching each reading to a `Device` is ID-43.
- **Replacement cost estimates.** Cost data comes from the invoice system and is handled separately.
- **Learning across pumps:** sharing history between identical pumps, or updating the pump prior from the estate's history. Each pump learns only from its own events.
- **Feeding anomaly scores into the forecast.** For example, raising breakdown risk for a pump that is often abnormal. This needs real readings and repair history to validate first.
- **Event changes:** editing or deleting events, costs on events, and work orders (ID-2, ID-49, ID-50).
- **Other event types and categories.** This spec adds only the two maintenance types. Event types and categories managed by staff in the app (lookup tables) are a separate spec if needed.
- **A combined history view.** Merging events and assessments into one timeline on the asset page can be built on read later. Neither is stored for it.
- **Access for estate users.** Access stays owner-only, like assets. A council only sees its own estate, so the per-estate page is the dashboard.
- **Notifications or emails** when an asset becomes flagged.

## Dependencies

- [building-assets](building-assets.md), [asset-condition](asset-condition.md) and [device-registration](device-registration.md) are built.
- `apps/ml` serves one ONNX model through the generic `/predict` endpoint (decision 0007). Phase 0b supplies that model.
- ID-49 (maintenance records) builds on `AssetEvent`. See Resolved.

## Implementation phases

Test-first: every test is seen failing before the phase that makes it pass
([testing.md](../testing.md)).

### 0. Research (`ml-research/`, run in fresh sessions)

Each task is self-contained. Read this spec and the named notebook first. Do
not touch `apps/`, install nothing, and commit nothing.

#### 0a. Compare the Bayesian forecast in notebook 02
- [x] **Goal:** add the Bayesian survival method to `notebooks/02-pump-rul.ipynb` as a baseline, evaluated the same way as the existing candidates, so the report can compare it directly with the trained models.
- [x] **Method:**
  - For each failure cycle, start from a weak prior and update it **only with earlier cycles**, as the app does after each "Repaired" click.
  - Use the notebook's own time scale (hours): the 3-year pump constants above don't apply to this dataset.
  - Fit or justify the prior's `m` and `k` from the training cycles only, and state the weight `a₀` used.
- [x] **Report:**
  - MAE on the capped hours-to-failure target, using the posterior median.
  - The 24 h / 48 h early-warning table, using P(fail within h) ≥ threshold.
  - Interval coverage, using posterior quantiles.
  - All alongside the existing rows: sensors, sensors + age, age only, mean, service-interval rule.
- [x] **Conclusions:** with only 7 failures, the differences are noisy. Say so plainly, and don't pick a winner on noise.
- [x] **Output:** update the notebook's conclusions and `artifacts/pump-rul/metrics.json`, then clear the outputs as before.

#### 0b. Retrain the anomaly model on platform metrics
- [x] **New notebook:** `notebooks/03-pump-anomaly-platform-metrics.ipynb`. Keep 01 as the research record and reuse its split, cross-validation and held-out protocol.
- [x] **Inputs:** five inputs mapped from SKAB:
  - `Accelerometer1RMS` → vibration acceleration (g RMS)
  - `Pressure` → pressure (bar)
  - `Temperature` → temperature (°C)
  - `Volume Flow RateRMS` → flow rate (L/min; confirm SKAB's unit)
  - `Current × Voltage / 1000` → power (kW). State that this ignores power factor.
  - Drop `Accelerometer2RMS` and `Thermocouple`.
- [x] **Compare:** set it against notebook 01's 8-sensor result (F1 0.73). Report what was lost and whether the 5-input model is still useful.
- [x] **Features:** keep them computable in Spring from the readings alone: raw values and rolling mean and std over the last 10 readings. Export about 50 rows of input readings with their expected features and scores as a parity fixture for the Spring test.
- [x] **Export:**
  - ONNX with an sklearn parity assert.
  - `metrics.json` with the feature order, decision threshold and Faulty threshold.
  - Artifacts in `artifacts/pump-anomaly-platform/`.
- [x] **Simulation dataset:** save the held-out test experiments as `artifacts/pump-anomaly-platform/test-readings.csv`, for driving simulated pumps against the anomaly-check endpoint.
  - **Columns:** `experiment`, `timestamp`, `vibrationAcceleration`, `pressure`, `temperature`, `flowRate`, `power`, `anomaly`.
  - **Raw readings:** these are readings in platform units, not engineered features. The reading columns use the `AnomalyCheckRequest` field names, so rows can be posted as-is. `anomaly` is the ground truth, for checking what the endpoint flags.
  - **Rows:** ordered by experiment, then timestamp. List the experiments in the README.
- [x] **Licence:** record that SKAB is GPL-3.0 and that the model is used for education only.
- [x] **Hand-off:** copy `model.onnx` to `apps/ml/models/model.onnx`. It is committed with the Spring constants it matches; see Resolved.

### 1. Decision
- [x] Add `.spec/decisions/0020-failure-risk-is-a-bayesian-weibull-on-repair-history.md`. It records:
  - why the forecast is closed-form arithmetic in Spring rather than a model in `apps/ml`
  - why it is derived on read rather than stored
  - why history resets on a unit replacement
  - that the sensor-based remaining-life model was rejected (notebook 02)
- [x] Add `.spec/decisions/0021-anomaly-detection-records-system-assessments.md`. It records:
  - that model-generated conditions are ordinary assessments under the `system:anomaly-model` identity, rather than a separate table
  - that `VIBRATION_ACCELERATION` (g) is added rather than converting to mm/s
  - that readings are scored, not stored, until ID-43
- [x] Add `.spec/decisions/0026-asset-categories-and-models-are-shared-tables.md`. It records:
  - why asset categories became a table: assets and models both reference them
  - why manufacturers and models are a shared catalogue, created on the fly and stored uppercase
  - that behaviour stays in code, keyed by category code
  - that the forecast's unit snapshot is catalogue IDs

### 2. Data (`add-model` skill)
- [x] Add `AssetCategory`, `Manufacturer`, `AssetModel` and `AssetEvent`, and change `Asset`, in `schema.prisma`.
- [x] Create the migration without applying it (`prisma migrate dev --create-only`, via `pnpm db:migrate -- --create-only`), then add SQL to it that:
  - seeds the 13 categories before the `Asset.category` foreign key is added
  - fills the catalogue from the existing text columns and points each asset at it, before the text columns are dropped
- [x] Apply it with `pnpm db:migrate`.
- [x] Run `pnpm db:generate`, then `./mvnw -pl com.proj:server compile`, and fix `AssetRepository` and `AssetService`.

### 3. Server tests (red)
- [x] `AssetCategoryControllerTests`:
  - [x] The endpoint lists the 13 seeded categories with their labels.
  - [x] Creating an asset with an unknown code returns 400.
  - [x] Every code the server keys constants on has a seeded row.
- [x] `CatalogueControllerTests`:
  - [x] Saving an asset with a new manufacturer and model creates both. Saving another with the same names, in different case and spacing, reuses them.
  - [x] Names are stored and returned trimmed, single-spaced and uppercase.
  - [x] A model without a manufacturer returns 400.
  - [x] The same model name under one manufacturer in two categories creates two rows. The models lookup filters by category.
  - [x] The lookups filter by query, cap at 20, and return 404 for an unknown manufacturer.
  - [x] The existing asset controller tests still pass. The only change to them is replacing `AssetCategory` enum values with code strings, since the contract changes (a test change of its own, made before the implementation).
- [x] `FailureRiskCalculatorTests` (plain unit tests):
  - [x] The four scenarios in the Breakdown forecast table match to two decimal places.
  - [x] A `BREAKDOWN_REPAIR` raises `a`. A `PREVENTIVE` interval raises only `b`.
  - [x] Events before `installedOn`, or with a different manufacturer or model snapshot, are ignored.
  - [x] The basis rules hold, including `NOT_SUPPORTED` for non-pumps.
  - [x] The timeframe uses the 0.15 threshold.
  - [x] The end-of-life date and the 12-year flag.
- [x] `AssetEventControllerTests`:
  - [x] Each type returns its category (`MAINTENANCE` for both).
  - [x] Create and list ordering.
  - [x] The manufacturer and model snapshot, and `countsTowardForecast`.
  - [x] 400s, 404s and 409s.
  - [x] The recorder snapshot.
  - [x] A missing JWT subject is rejected.
- [x] `FailureRiskControllerTests`:
  - [x] The per-asset response.
  - [x] The estate list holds pumps only, in the right order.
  - [x] All three flag reasons, including a `CONDITION` flag from a system assessment.
  - [x] Deactivated assets are excluded from the list.
  - [x] Another owner gets 404.
- [x] `AnomalyFeatureTests` (unit): features match the 0b parity fixture.
- [x] `AnomalyCheckControllerTests`, with `apps/ml` replaced by a stub server returning fixed scores:
  - [x] 10 abnormal readings in a row record `NEEDS_ATTENTION` or `FAULTY`, per the median rule.
  - [x] 9 in a row record nothing.
  - [x] No duplicate when the condition is unchanged.
  - [x] The system identity, date and notes are correct.
  - [x] The 400s, 404s and 409s from Edge cases.
  - [x] The stub timing out, or returning 503, gives 503 and records nothing.
- [x] `DeviceMetric` includes `VIBRATION_ACCELERATION` with unit `g`.
- [x] Run the tests and confirm they fail.

### 4. API (green, `add-endpoint` skill)
- [x] Package `com.proj.server.catalogue` for the categories endpoint, the find-or-create service and the lookup controller. `AssetService` calls it on create and edit.
- [x] Remove the `AssetCategory` enum. Asset DTOs take and return the code as a `String`, validated against the table.
- [x] Package `com.proj.server.event` for events, with the `AssetEventCategory` and `AssetEventType` enums.
- [x] Package `com.proj.server.risk` for the calculator, the pump constants, the silent-failure set and the controller.
- [x] Package `com.proj.server.anomaly`:
  - the feature builder and the model constants
  - an `MlClient` for `POST /predict` that reads `ML_API_URL`, with a 5-second timeout
  - the controller
- [x] Add `VIBRATION_ACCELERATION("g")` to `DeviceMetric`.
- [ ] Make the tests pass, then run `pnpm api:generate` and `pnpm check-types`.
- [x] Update `architecture.md`: `ML_API_URL` is now read by the server.

### 5. Web tests (red)
- [x] `tests/lib/asset-events.test.ts` and `tests/lib/failure-risk.test.ts`:
  - [x] Query keys include the user and estate IDs.
  - [x] Failed requests throw.
  - [x] Recording an event invalidates the asset's events and its forecasts.
- [x] A test for the record-event dialog:
  - [x] Labelled type, date and notes fields.
  - [x] Required errors show.
  - [x] Submit posts the payload.
  - [x] Input is kept on a server error.
  - [x] No double submit.
- [x] A test for the failure-risk page:
  - [x] Rows show the percentages, timeframe, end-of-life date and flag reasons.
  - [x] The empty state shows.
  - [x] `INSUFFICIENT_DATA` rows say "Not enough data".
- [x] The device form offers "Vibration acceleration (g)".
- [x] The asset form's category select lists the categories from the endpoint, and the details page shows the label.
- [x] The asset form's manufacturer and model fields:
  - [x] Suggest catalogue entries as the user types, and suggest models only for the chosen manufacturer and category.
  - [x] Accept a name that isn't listed and send it as text.
- [x] Run `pnpm nx test web` and confirm the tests fail.

### 6. Web (green)
- [ ] `src/lib/asset-events.ts`, `src/lib/failure-risk.ts` and `src/lib/catalogue.ts` (categories, manufacturers, models).
- [ ] Replace `assetCategoryLabel` in `src/lib/assets.ts` with the categories query. The asset form, list and details page read labels from it.
- [ ] Asset form: manufacturer and model become comboboxes that allow free text. Add shadcn `combobox` with the CLI (§4) if it is missing.
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
  - New: `.docs/api/catalogue.md` (categories, manufacturers, models), `.docs/api/asset-events.md`, `.docs/api/failure-risk.md`, `.docs/api/anomaly-check.md`, `.docs/frontend/failure-risk.md`.
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

None.

Resolved:
- **Existing assets with a model but no manufacturer:** the migration puts their models under a manufacturer named `UNKNOWN`, so no model text is lost.
- **Manufacturer and model:** a catalogue shared by all estates, with models under manufacturers. Anyone saving an asset adds new names on the fly. The server finds or creates them, and the asset contract keeps text fields.
- **Asset categories:** a lookup table, not an enum, because assets and catalogue models both reference it. Codes are seeded by migration, and behaviour stays in code keyed by code.
- **Asset scope:** assets still belong to their estate and building. Only the manufacturer and model columns move to the catalogue.
- **ID-49 overlap:** `AssetEvent` is the asset's general event history. ID-49 builds on it, adding cost columns when it needs them. Work orders (ID-50) have their own lifecycle, so they get their own table that links to events.
- **Naming:** "event", not "log". It is one dated occurrence, matching `occurredOn`, and "log" clashes with application logging.
- **Event type and subtype:** a fixed event category → type hierarchy in server-side enums, not lookup tables, because nothing yet needs staff to manage event types. Asset categories are a table (above).
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
