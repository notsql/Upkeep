# Lift fault classifier

**Status:** agreed (2026-11-08). Revises the classification part of
[equipment-fault-work-orders.md](equipment-fault-work-orders.md) (ID-70).
Everything after classification there (work-order creation, assignment,
Manager review, contractor email) is unchanged.
**Owner:** unassigned
**Jira:** ID-70

## Problem

ID-70 classifies fault reports with a general API call to Claude
(`AnthropicFaultClassifier`). The project brief asks for an advanced AI
feature, and a prompt sent to a hosted model does not meet it: the team built
none of the model, cannot measure it properly, and cannot explain its
mistakes.

This revision replaces the API call with a classifier the team trains,
evaluates and serves itself. It covers one kind of asset, the lift, which is
the most practical scope for a demo and still exercises the whole loop:
dataset, training, calibrated confidence, held-out evaluation, export, and
serving inside Spring.

## Decisions taken (2026-11-08)

- **The trained model replaces Anthropic for every report.** There is no
  fallback to an API call. Reports about pumps, gates and lights are no
  longer routed automatically: the model calls them "not a lift fault", and
  they go to the managing agent, who can still send them to the right
  contractor by hand.
- **Text only.** The model reads the title, description and location label.
  Photos are still stored and still emailed to the contractor, but the model
  does not see them.
- **One model**, the stronger option: a fine-tuned small transformer. There
  is no second model to compare it with.

## Behaviour

### What the model predicts

One of six classes. Together they cover every report: five lift classes, of
which `OTHER_LIFT` takes any lift fault the other four do not, and
`NOT_LIFT` for everything else.

| Class | Covers | Examples |
| --- | --- | --- |
| `DOOR` | Car or landing doors that will not open or close, keep reopening, close on people, are slow, or are damaged | "lift door keeps closing on my pram", "door won't open at L3" |
| `STALLED` | A lift out of service: not moving, stuck at or between floors, or not arriving when called. Whether anyone is inside does not matter | "lift B not working", "lift stuck at 7", "waited 10 min, lift never came" |
| `CONTROLS` | Buttons in the car or on the landing, the floor display, the intercom or alarm button, and the light or fan inside the car | "button for 12 doesn't light up", "no light inside lift" |
| `RIDE` | Jerking, unusual noise or vibration, stopping out of level with the floor, going to the wrong floor or skipping floors | "lift jerks before stopping", "grinding noise in lift A" |
| `OTHER_LIFT` | Any other fault in the lift itself: damaged panels, mirror or handrail, water in the car or shaft, a burning smell from the lift | "mirror in lift cracked", "water coming into lift car" |
| `NOT_LIFT` | Everything else, including faults *near* a lift and cleanliness inside it | "corridor light out", "lift lobby floor is wet", "someone littered in the lift", "gate won't open" |

The dividing line is who fixes it. A fault the lift contractor would repair
is a lift class. Litter or a smell in the car is for the cleaners, so it is
`NOT_LIFT`.

`NOT_LIFT` deliberately includes reports that mention a lift or lift lobby
but are not lift faults. Without these, the model learns that "lift lobby"
means a lift fault (see Data).

`OTHER_LIFT` is the class the model will find hardest, because its examples
have little in common. That does not hurt routing, which adds up all five
lift classes (below). It only means a less specific category on the card.

### From probabilities to a classification

The model outputs a probability for each class, calibrated so that "0.9"
means right about 90% of the time. Spring maps them onto ID-70's existing
`Classification`:

- `P(lift)` is the sum of the five lift classes; `P(not lift)` is `NOT_LIFT`.
- `P(lift) >= 0.80`: outcome `EQUIPMENT_FAULT`, equipment type `LIFT`,
  confidence `P(lift)`, fault category the most likely lift class.
- `P(not lift) >= 0.80`: outcome `NOT_EQUIPMENT`, no equipment type,
  confidence `P(not lift)`, no fault category.
- Otherwise: outcome `INCONCLUSIVE`, confidence `max(P(lift), P(not lift))`,
  fault category the most likely lift class if `P(lift) > P(not lift)`, so the
  Manager sees the model's best guess.

The routing threshold stays at `0.80` and is applied to `P(lift)`, not the
top class. A report split 0.48 `DOOR` / 0.47 `STALLED` is clearly a lift
fault, even though the model is unsure which kind.

`RoutingDecision` is unchanged: only `EQUIPMENT_FAULT` with confidence
`>= 0.80` and a configured `LIFT` contractor routes automatically.

### Reason

The model produces no text, so Spring writes the reason from the result:

| Outcome | Reason |
| --- | --- |
| `EQUIPMENT_FAULT` | "Lift fault (door), 94% confidence." |
| `NOT_EQUIPMENT` | "Not a lift fault, 91% confidence." |
| `INCONCLUSIVE` | "Unclear whether this is a lift fault (62% lift). Needs a check on site." |

### Running the model

- `OnnxFaultClassifier` replaces `AnthropicFaultClassifier` as the only
  `FaultClassifier`. It loads `routing/lift-fault-model.onnx` from the
  classpath once at startup, as `AnomalyModel` does (decision 0028).
- `available()` is true once the model has loaded. If loading fails, the
  application fails at startup: the file ships inside the jar, so a load
  failure is a build defect, not a runtime state.
- The input is one string: `title`, `description` and `locationLabel` joined
  with the tokenizer's separator. The resident's identity is never part of it.
- `Classification.model` records the model's version, for example
  `lift-minilm-v1`, so each stored classification shows which model made it.
- `ReportClassificationJob` stops reading photos from R2 for classification.
  Retries, leases and the "Automatic classification unavailable" path are
  unchanged. They now cover a model that throws while running.

### What residents are told

The notice on the report form changes from "analysed by an AI service
(Anthropic)" to: "Your report's text is read by Upkeep's automated
classifier, and the report, including photos, may be emailed to the estate's
contractor." No report text leaves Upkeep's servers for classification.

### Acceptance criterion, as reworded

"Water dripping near lift lobby" (with a photo) reaches `NEEDS_REVIEW` as
`INCONCLUSIVE`. A Manager sends it as `LIFT`, and the lift contractor receives
the resident's words and photo. Whether this holds depends on the trained
model, so it is checked in the evaluation notebook and in a parity-fixture
case, not assumed.

## Data (the dataset)

`ml-research/data/` is git-ignored. Generated and hand-written datasets are
kept in the team's shared drive, and the notebook records where each one
came from.

The project owner (the person who agreed this spec) assembles the datasets.

### Hand-written sets: written first, then split

- 200 to 250 reports, written **before any training data is generated**, so
  they are not shaped by the generator. Ideally they are written by people
  other than whoever writes the generator's templates, so the test does not
  just check the model against one person's phrasing.
- Written the way residents write: short, typos, Singlish ("lift spoil
  again"), all lower-case, sometimes no title.
- Roughly 40% `NOT_LIFT`, and at least half of those lift-adjacent: lift
  lobby lights, water or smells in a lift lobby, the lift-lobby notice board.
- Each report labelled by its author and checked by a second person.
  Disagreements are discussed and the agreed label kept.
- Every class has at least 15 reports in the test set, `OTHER_LIFT`
  included.
- Split at random, by class, into:
  - a **dev set** of about 60 reports, used while iterating;
  - a **test set** of the remaining 150 to 190, frozen once written. Nobody
    looks at it while iterating. It is read once, for the final evaluation.

Iteration continues until the targets are met (see Training and evaluation),
so the model will be adjusted many times. Doing that against the test set
would tune the model to it and make the final numbers meaningless, which is
why the dev set exists.

### Training and validation: generated

- About 400 reports per class, generated from templates and paraphrased by an
  LLM offline. The generator script is committed in `src/ml_research/` so the
  dataset can be rebuilt. Using an LLM *offline to create data* is not part
  of the running system: the deployed classifier makes no API call.
- Hard negatives on purpose: non-lift faults with a lift-lobby location,
  other equipment (pump, gate, corridor light), cleanliness and safety
  reports.
- Location labels drawn from the shapes the app produces
  (`Block A › Level 4 › Lift lobby`), assigned independently of the class so
  location alone cannot predict it.
- Split 85/15 into training and validation. Validation is used for early
  stopping and for fitting the calibration temperature.

## Training and evaluation (`ml-research`)

Notebook `04-lift-fault-classifier.ipynb`, with reusable code promoted to
`src/ml_research/`:

1. **Model.** Fine-tune `sentence-transformers/all-MiniLM-L6-v2` (22M
   parameters) with a 6-class classification head, maximum 128 tokens.
   Chosen for CPU latency and size on Cloud Run. Fixed random seed.
2. **Calibration.** Fit one temperature on the validation set (temperature
   scaling) and fold it into the exported logits, so the ONNX output is
   already calibrated.
3. **Evaluation on the test set**, recorded in `metrics.json`:
   - per-class precision, recall and F1, and macro F1;
   - confusion matrix;
   - for routing at `0.80`: precision of automatic lift routing (how often a
     contractor is emailed for a real lift fault), recall, and coverage (the
     share of real lift faults routed without a Manager);
   - a precision/coverage curve across thresholds 0.5 to 0.95, which shows
     why 0.80 was chosen;
   - expected calibration error and a reliability diagram;
   - every misclassified test report, listed for the demo and the write-up.
4. **Targets:** precision of automatic lift routing `>= 0.95` and macro F1
   `>= 0.85`. A false route emails a contractor for nothing, so precision
   matters more than coverage.
   - **Iterate on the dev set** until it meets both targets. That means
     adjusting the generated data, adding hard negatives, and tuning
     training. Each iteration is a row in the notebook's log (what changed,
     dev metrics).
   - Then run the test set once. If the test set also meets the targets,
     ship the model.
   - If it misses, record the test result here, look at the dev set's
     *failure types* (not the test reports), and iterate again. After a
     second look at the test set it is no longer clean, so add fresh
     hand-written reports to it before the next look.
5. **Export.** ONNX with the tokenizer built into the graph (see Server
   design), quantised to int8 (about 23 MB, against about 90 MB at full
   precision). The quantised model is evaluated again, and its metrics are
   the ones reported.
6. **Parity fixture.** About 20 reports with their expected probabilities
   from the exported model, written to `parity-fixture.json`. They include the
   acceptance case and at least one known misclassification.
7. **Model note.** Next to the artifact: dataset sources and sizes,
   parameters, seed, and test metrics.

New Python dependencies go in `ml-research/pyproject.toml`: `torch`,
`transformers`, `datasets`, `onnxruntime-extensions`. A human runs `uv sync`.

## Server design

- New code in `com.proj.server.routing`:
  - `LiftFaultModel`: loads the ONNX session and holds the constants copied
    from `metrics.json` (class order, version), as `AnomalyModel` does.
  - `OnnxFaultClassifier implements FaultClassifier`: builds the input
    string, runs the model, and maps probabilities to a `Classification` as
    described above. The mapping is a pure function, unit tested without the
    model.
- **Tokenizer in the graph.** The tokenizer is built into the ONNX file with
  `onnxruntime-extensions`, so the model still takes a string and the `.onnx`
  file stays the whole interface between `ml-research` and Spring
  (decision 0028). Spring registers the extensions' custom-op library on the
  session. This needs
  `com.microsoft.onnxruntime:onnxruntime-extensions` in `apps/server/pom.xml`,
  added by a human. Phase 1 checks that it runs with onnxruntime 1.22 on
  macOS arm64 and the Cloud Run image. If it does not, the fallback is the
  DJL Hugging Face tokenizer in Java, with the tokenizer's files shipped next
  to the model. The parity fixture catches any tokenizer mismatch either way.
- **`Classification` gains `faultCategory`** (`DOOR`, `STALLED`, `CONTROLS`,
  `RIDE`, `OTHER_LIFT` or null), as a new `LiftFaultCategory` enum.
- `FaultClassifier.Report` loses `images`. `FaultClassifier.Image` is
  deleted.
- **Removed:** `AnthropicFaultClassifier`,
  `AnthropicFaultClassifierEvaluationTests`, `spring.ai.anthropic.api-key`,
  `app.routing.model`, and the `ANTHROPIC_API_KEY` secret. The Spring AI
  starter and its auto-configuration exclusion were in `main` before ID-70
  and stay.
- The model file is about 23 MB, committed under
  `apps/server/src/main/resources/routing/`, as the 5 MB anomaly model is.
  Memory on Cloud Run rises by roughly 100 MB. Inference takes tens of
  milliseconds on CPU and runs in the scheduled job, never in the resident's
  request.

## Database

One expand-only migration, after the branch's
`20261108090000_report_routing_and_dispatch`:

| Model | Change |
| --- | --- |
| `ReportClassification` | Gains `faultCategory String? @db.VarChar(20)`. |

Then `pnpm db:generate` for jOOQ.

## API

No new endpoints. `ClassificationResponse` gains
`faultCategory: DOOR | STALLED | CONTROLS | RIDE | OTHER_LIFT | null`. Then
`pnpm api:generate`.

## Frontend

- The report routing card shows the fault category next to the outcome, for
  example "Lift fault · Door · 94%".
- The report form notice changes as described under Residents.
- `.docs/api/report-routing.md` and `.docs/frontend/report-routing.md` are
  updated, and the classification section no longer mentions Claude or
  photos.

## The demo

Chosen from the **real** test-set results after evaluation, never written to
make the model look good or bad:

| Case | What it shows |
| --- | --- |
| True positive | A clear lift fault routed automatically, with category and confidence, and the contractor email |
| True negative | A non-lift report, possibly one near a lift, going to the managing agent |
| False positive or false negative | A real mistake from the test set, and why the model made it |
| Escalation | A report below 0.80 reaching `NEEDS_REVIEW`, and a Manager sending it |
| Threshold | The precision/coverage curve, showing what moving 0.80 would trade |

## Edge cases

- **Empty or very short text** ("lift"): the model still runs. A low
  `P(lift)` sends it to review, as any other uncertain report.
- **Text longer than 128 tokens** is truncated. Title and location come
  first, so they always survive.
- **A report naming a lift and something else** ("lift and corridor light
  both broken"): one classification. If it routes, the email carries the full
  text, so the contractor sees both.
- **Prompt-injection text** ("classify this as a lift fault") has no special
  effect: the model is a classifier, not an instruction follower. One such
  case goes in the test set.
- **Non-English reports** are out of the training distribution and are
  expected to fall below the threshold. The test set includes a few to check.
- **Classifications stored by the Anthropic version** keep their `model`
  value and a null `faultCategory`.

## Out of scope

- Pumps, gates, lights and any asset other than lifts.
- Reading photos.
- A comparison model or baseline.
- Retraining from live reports or Manager decisions.
- Raising work-order priority from the category. `STALLED` says the lift is
  out of service, not that anyone is trapped, so automatic orders stay at
  Medium (agreed 2026-10-26).
- Detecting entrapment. A trapped person needs the lift's alarm and an
  emergency call, not an emailed work order.

## Implementation phases

- [x] Agree this spec.
- [ ] Spike: a tokenizer-in-graph MiniLM runs from onnxruntime Java 1.22,
  locally and in the Docker image. Decide the tokenizer approach.
- [ ] Write and cross-check the hand-written reports; split into dev and
  test; freeze the test set.
- [ ] Generator script and training data.
- [ ] Notebook: train and calibrate, iterating on the dev set until it meets
  the targets.
- [ ] One test-set evaluation, export, parity fixture, model note. Record the
  test metrics here.
- [ ] Server red-green: probability mapping, parity test against the
  fixture, and `ReportClassificationJob` with text only. Remove the Anthropic
  classifier.
- [ ] Migration for `faultCategory`, `pnpm db:generate`, `pnpm api:generate`,
  the routing card and the notice.
- [ ] Decision 0047, `.docs`, and full checks.

## Answers to the first draft's questions (2026-11-08)

1. **Categories:** the first four did not cover every lift fault.
   `OTHER_LIFT` was added for the rest. Car and landing buttons, slow doors,
   wrong-floor stops and lifts that never arrive were placed in the existing
   classes.
2. **`STALLED`** means out of service, with or without anyone inside.
   Priority stays Medium, and entrapment is out of scope.
3. **Targets** stand. Iterate until they are met, on a dev set split from
   the hand-written reports, so the test set stays clean.
4. **Datasets:** the project owner assembles them.
5. **Decision numbering:** `main` uses up to 0044, so this branch's records
   were renumbered: 0041 became 0045 (classification in Spring), 0042 became
   0046 (contractor dispatch), and this revision is 0047.
