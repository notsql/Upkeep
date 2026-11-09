# Water leak classifier

**Status:** agreed (2026-11-09). Revises the classification part of
[equipment-fault-work-orders.md](equipment-fault-work-orders.md) (ID-70) and
replaces the lift classifier spec agreed on 2026-11-08 (in git history as
`lift-fault-classifier.md`). Everything after classification (work-order
creation, assignment, Manager review, contractor email) is unchanged.
**Owner:** unassigned
**Jira:** ID-70

## Problem

ID-70 classifies fault reports with a general API call to Claude
(`AnthropicFaultClassifier`). The project brief asks for an advanced AI
feature, and a prompt sent to a hosted model does not meet it: the team built
none of the model, cannot measure it properly, and cannot explain its
mistakes.

This revision replaces the API call with a classifier the team trains,
evaluates and serves itself, for one kind of fault: water leaks.

## Why water leaks and not lifts

Five public sources were checked for lift fault reports. None has text that
residents wrote. Lift data that is public is operational: counts, codes and
outage times.

The [Civic and Municipality Complaint System dataset][kaggle] does have
labelled leak reports, and it has lookalikes such as flooded storm drains and
cars parked at hydrants. It is MIT licensed.

[kaggle]: https://www.kaggle.com/datasets/wajahattaj/civic-and-municipality-complaint-system-dataset

## Decisions taken (2026-11-09)

- **The trained model replaces Anthropic for every report.** There is no
  fallback to an API call. Reports about pumps, lifts, gates and lights are no
  longer routed automatically. They go to the managing agent, who can still
  send them to the right contractor by hand.
- **Two classes:** `WATER_LEAK` and `NOT_LEAK`. The data does not support
  finer types.
- **Text only.** The model reads the title and description. Photos are still
  stored and still emailed to the contractor, but the model does not see them.
- **One shipped model:** a fine-tuned small transformer.
- **Two checks:** sentence-split cross-validation on the dataset while
  iterating, then one final run on hand-written estate-style reports.

## Behaviour

### What counts as a leak

`WATER_LEAK` means water is escaping from a pipe, tap, tank or plumbing
fitting. `NOT_LEAK` is everything else, including:

- water that did not come from plumbing: rain through a window, a corridor
  wet after cleaning, a choked drain;
- faults near water fittings: a car parked at a hydrant;
- everything unrelated: lifts, lights, noise, litter.

### From probabilities to a classification

The model outputs a calibrated probability for each class, so that "0.9" means
right about 90% of the time. Spring maps them onto ID-70's existing
`Classification`:

| Condition | Outcome | Equipment type | Confidence |
| --- | --- | --- | --- |
| `P(leak) >= 0.80` | `EQUIPMENT_FAULT` | `PLUMBING` | `P(leak)` |
| `P(not leak) >= 0.80` | `NOT_EQUIPMENT` | none | `P(not leak)` |
| Otherwise, `P(leak) > P(not leak)` | `INCONCLUSIVE` | `PLUMBING` | `P(leak)` |
| Otherwise | `INCONCLUSIVE` | none | `P(not leak)` |

The threshold stays at `0.80`. `RoutingDecision` is unchanged: only
`EQUIPMENT_FAULT` with confidence `>= 0.80` and a configured contractor routes
automatically.

### Reason

The model produces no text, so Spring writes the reason from the result:

| Outcome | Reason |
| --- | --- |
| `EQUIPMENT_FAULT` | "Water leak, 94% confidence." |
| `NOT_EQUIPMENT` | "Not a water leak, 91% confidence." |
| `INCONCLUSIVE` | "Unclear whether this is a water leak (62% leak). Needs a check on site." |

### Plumbing contractors

`EquipmentType` gains `PLUMBING` ("Plumbing"). The Contractors page and the
send-to-contractor dialog then list it with the other types. The column holds
a string validated by Spring, so this needs no migration.

### Running the model

- `OnnxFaultClassifier` replaces `AnthropicFaultClassifier` as the only
  `FaultClassifier`. It loads `routing/water-leak-model.onnx` and
  `routing/water-leak-tokenizer.json` from the classpath once at startup, as
  `AnomalyModel` does (decision 0028).
- `available()` is true once the model has loaded. If loading fails, the
  application fails at startup: the files ship inside the jar, so a load
  failure is a build defect, not a runtime state.
- The input is `title`, then `description`, joined as plain text. The dataset
  has no location, so the location label is not used. The resident's identity
  is never part of the input.
- `Classification.model` records the version, for example
  `water-leak-minilm-v1`.
- `ReportClassificationJob` stops reading photos from R2 for classification.
  Retries, leases and the "Automatic classification unavailable" path are
  unchanged. They now cover a model that throws while running.

### What residents are told

The notice on the report form changes from "analysed by an AI service
(Anthropic)" to: "Your report's text is read by Upkeep's automated
classifier, and the report, including photos, may be emailed to the estate's
contractor." No report text leaves Upkeep's servers for classification.

### Acceptance criterion, as reworded

A resident reports a burst pipe in a common area, with a photo. If the model
gives it at least 0.80 and the estate has a plumbing contractor, a work order
is created and the contractor receives the resident's words and photo. A
report of a choked drain reaches `NEEDS_REVIEW` and a Manager decides. Whether
each holds depends on the trained model, so both are checked in the
evaluation, not assumed.

## The dataset

Only `issue_description` and `issue_type` are used. The other columns,
including the names and contact details, are dropped when the file is read.
`ml-research/data/` is git-ignored, and the notebook records the source URL
and licence.

The dataset needs cleaning before it can be trained on:

- `water_leakage` and `water-leak` become `WATER_LEAK`. Every other type
  becomes `NOT_LEAK`.
- 1,100 rows hold only 47 distinct leak sentences and 322 others.
  Template wrappers ("URGENT: … requires a crew immediately", "I wanted to
  report that …", "Please address this as soon as possible") are removed to
  find each row's core sentence, and each core sentence is kept once.
- Every sentence containing a water word (leak, pipe, burst, hydrant, flood,
  drip, seep, plumb, water, puddle, sewer, sewage, wet, damp) is read by a
  person, and its label corrected if it breaks the definition above. Changes
  are listed in the model note.

**The core sentence is the unit of splitting.** A sentence must never appear
on both the training and test side. A TF-IDF baseline shows why:

| Evaluated on | Precision | Recall | F1 |
| --- | --- | --- | --- |
| Raw rows, split at random | 1.00 | 0.99 | 0.99 |
| Raw rows, each sentence on one side only | 0.93 | 0.58 | 0.71 |
| Distinct sentences, 5 folds | 0.96 | 0.96 | 0.96 |

The first row mostly measures remembering sentences already seen. The second
is dominated by one sentence repeated 62 times, which sinks recall whenever it
is held out. The third is the honest measure and the one Check 1 uses. It also
shows the dataset's wording is easy to separate, even for a simple model, so
Check 2 is where the transformer has to prove its worth.

### Hand-written reports

- About 50 reports, each with a title and description: about 25 leaks and 25
  not, written as residents would, with typos and Singlish.
- The not-leak half includes lookalikes (mopped corridor, rain through a
  window, choked drain) and unrelated faults.
- Written **before any training**, ideally by someone other than the person
  preparing the training data, and each label checked by a second person.
  Unclear cases are agreed or left out.
- Include one report containing a literal `[SEP]` or `[CLS]`.
- Kept out of training and tuning. Nobody looks at the model's output on them
  until the final run.

## Training and evaluation (`ml-research`)

Notebook `04-water-leak-classifier.ipynb`, with reusable code promoted to
`src/ml_research/`:

1. **Model.** Fine-tune `sentence-transformers/all-MiniLM-L6-v2` with a
   2-class head, maximum 128 tokens, class-weighted loss (leaks are about 1 in
   8), fixed random seed.
2. **Check 1: cross-validation by sentence.** Five folds, stratified by class,
   with each sentence in exactly one fold. It can be run as often as needed.
   Scores are pooled across the folds' held-out predictions.
3. **Calibration.** One temperature, fitted on the pooled held-out predictions
   and folded into the exported logits.
4. **Targets for Check 1, at the `0.80` threshold:** precision `>= 0.95` and
   F1 `>= 0.85`. A false route emails a contractor for nothing, so precision
   matters most. Each iteration is a row in the notebook's log: what changed,
   and the scores. The TF-IDF baseline is one reference row in that log. It is
   not a second model and is not shipped.
5. **Final model.** Trained on every sentence, with the settings and epoch
   count that Check 1 settled on.
6. **Export.** ONNX plus `tokenizer.json`, quantised to int8 (about 23 MB,
   against about 90 MB at full precision). Exporting needs `onnxscript` in
   `ml-research/pyproject.toml`; a human runs `uv sync`.
7. **Check 2: the hand-written reports, once, on the exported model.** Recorded
   in `metrics.json`: precision, recall, F1, confusion matrix, share routed
   automatically, and every mistake. There is no target. With 50 reports each
   one is worth 2%, so it is a clear indication and not a precise measurement.
   A score below Check 1 is expected and is reported as a finding: the model
   learned from US street complaints.
8. **Also recorded:** a precision/coverage curve from Check 1 for thresholds
   0.5 to 0.95, and expected calibration error with a reliability diagram.
9. **Parity fixture.** About 20 reports with their expected probabilities from
   the exported model, in `parity-fixture.json`.
10. **Model note.** Next to the artifact: source, cleaning, label changes,
    settings, seed and both checks' results.

If Check 2 shows the model does badly on estate text, the fix is adding
estate-style examples to the training data. The 50 reports have then been
seen, so a fresh batch is needed to test again.

## Server design

- New code in `com.proj.server.routing`:
  - `WaterLeakModel`: loads the ONNX session and tokenizer and holds the
    constants copied from `metrics.json` (class order, version), as
    `AnomalyModel` does.
  - `OnnxFaultClassifier implements FaultClassifier`: builds the input, runs
    the model, and maps probabilities to a `Classification` as described
    above. The mapping is a pure function, unit tested without the model.
- **Tokenizer in Java.** `ai.djl.huggingface:tokenizers` tokenizes the input,
  and Spring feeds the token tensors to onnxruntime. Building the tokenizer
  into the graph with `onnxruntime-extensions` is not possible: its newest Java
  jar (0.13.0, October 2024) has no `osx-arm64` or `linux-arm64` library, so
  the server could not start on the team's Macs. The parity fixture catches
  any tokenizer mismatch.
- `FaultClassifier.Report` loses `images` and `locationLabel`.
  `FaultClassifier.Image` is deleted.
- **Removed:** `AnthropicFaultClassifier`,
  `AnthropicFaultClassifierEvaluationTests`, `spring.ai.anthropic.api-key`,
  `app.routing.model`, and the `ANTHROPIC_API_KEY` secret. The Spring AI
  starter and its auto-configuration exclusion predate ID-70 and stay.
- The model is about 23 MB, committed under
  `apps/server/src/main/resources/routing/`, as the 5 MB anomaly model is.
  Memory on Cloud Run rises by roughly 100 MB. Inference runs in the scheduled
  job, never in the resident's request.

## Database

No change. `ReportClassification.equipmentType` and
`EquipmentProviderRoute.equipmentType` are strings that Spring validates.

## API

No new endpoints. `EquipmentType` in the contract gains `PLUMBING`. Then
`pnpm api:generate`.

## Frontend

- `EQUIPMENT_TYPES` in `lib/report-routing.ts` gains Plumbing, which adds it to
  the Contractors page and the send-to-contractor dialog.
- The report form notice changes as described above.
- `.docs/api/report-routing.md` and `.docs/frontend/report-routing.md` are
  updated, and no longer mention Claude or classifying photos.

## The demo

Chosen from the **real** results, never written to make the model look good or
bad:

| Case | What it shows |
| --- | --- |
| True positive | A clear leak routed automatically, with confidence, and the contractor email |
| True negative | A lookalike, such as a choked drain, correctly left for the managing agent |
| False positive or false negative | A real mistake, and why the model made it |
| Escalation | A report below 0.80 reaching `NEEDS_REVIEW`, and a Manager sending it |
| Threshold | The precision/coverage curve, showing what moving 0.80 would trade |
| Honest split | Why the random split's 0.99 is misleading, and the sentence-split result |

## Edge cases

- **Empty or very short text:** the model still runs. Uncertainty sends it to
  review, like any other report.
- **Text longer than 128 tokens** is truncated. The title comes first, so it
  survives.
- **A report naming a leak and something else:** one classification. If it
  routes, the email carries the full text, so the contractor sees both.
- **Prompt-injection text** has no special effect: the model is a classifier,
  not an instruction follower.
- **Typed special tokens:** `[SEP]` or `[CLS]` is read as the real token, in
  Python and Java alike. It can only make that one report classify worse.
- **Non-English reports** are outside the training data and are expected to
  fall below the threshold.
- **Classifications stored by the Anthropic version** keep their `model` value.

## Out of scope

- Automatic routing for any fault other than water leaks.
- Types of leak, severity, or raising work-order priority from the result.
- Reading photos, or using the location.
- A second shipped model.
- Retraining from live reports or Manager decisions.

## Implementation phases

- [x] Spike: the Java tokenizer (see Spike result).
- [x] Agree this spec.
- [ ] Write and cross-check the hand-written reports, and set them aside.
- [ ] Data preparation: read, clean and de-duplicate, and review labels.
- [ ] Notebook: train and calibrate, iterating on Check 1 until it meets the
  targets. Record the results here.
- [ ] Final model, export, Check 2, parity fixture, model note. Record Check 2
  here.
- [ ] Server red-green: probability mapping, parity test, text-only job.
  Remove the Anthropic classifier.
- [ ] `PLUMBING` end to end: enum, `pnpm api:generate`, Contractors page and
  dialog, and the resident notice.
- [ ] `.docs` and full checks.

## Spike result (2026-11-09)

Passed. `ai.djl.huggingface:tokenizers` 0.40.0 and onnxruntime Java 1.31.1 ran
the public `all-MiniLM-L6-v2` (full precision), against Python `tokenizers`
0.23.3 and `onnxruntime` 1.30.0, on 10 cases: plain, Singlish, typos, Chinese
and emoji, empty, single word, punctuation, literal special tokens, odd
whitespace, and text past the 128-token limit.

| Platform | Token IDs, mask, type IDs | Largest output difference | Time per report (25 / 128 tokens) |
| --- | --- | --- | --- |
| macOS arm64, Java 25 | Identical on all 10 | 0 | 1.1 / 3.6 ms |
| Linux amd64 under emulation, Java 25, `spring` user | Identical on all 10 | 4.4e-6 | 7.8 / 24.6 ms |

Altering one expected output and one expected token ID made the check fail,
so a mismatch is detected. What this means for the build:

- **No padding at inference.** DJL keeps the truncation in `tokenizer.json`
  but not its padding, and one report at a time needs none. Padding is only
  for training batches, where the attention mask covers it.
- **Native library.** DJL extracts it to `~/.djl.ai` on first use, so the
  runtime user needs a writable home. The image's `spring` user has one.

Not covered: the team's own int8 model (the parity fixture checks it) and the
real server image with its AOT cache (checked when the model is wired in).
