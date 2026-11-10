# 0048 - Fault classification uses a trained water leak model

**Status:** accepted (ID-70, 2026-11-09). Supersedes the model choice in
0046; 0046's other points (classify in Spring, in a scheduled job, outside
any transaction, with a fixed 0.80 threshold) stand.

## Context

0046 classifies resident fault reports by sending their text and photos to
Claude. The project brief asks for an advanced AI feature, which a prompt to a
hosted model does not meet: the team neither builds the model nor can
evaluate it properly. The repo already serves one model the team trained,
the anomaly model, as ONNX inside Spring (0028), with `ml-research/`
producing it.

A first plan targeted lift faults. Five public sources were checked and none
has text that residents wrote about lifts, so training data would have been
entirely invented. A public municipal complaints dataset (MIT licence) has
labelled water leak reports and realistic lookalikes.

## Decision

- Replace `AnthropicFaultClassifier` with `OnnxFaultClassifier`, which runs a
  text classifier the team trains in `ml-research/` and ships as
  `routing/water-leak-model.onnx`. There is no API fallback.
- Two classes: `WATER_LEAK` and `NOT_LEAK`. Leaks route to a new `PLUMBING`
  contractor type. Everything else goes to the managing agent.
- The model is a fine-tuned MiniLM-L6, calibrated with temperature scaling
  and quantised to int8. The `.onnx` file plus its `tokenizer.json` are the
  interface from `ml-research/` to Spring, which tokenizes with
  `ai.djl.huggingface:tokenizers`.
- Text only: title and description. Photos and location are not classified.
- The dataset is de-duplicated to core sentences and always split by sentence,
  because a random split of its raw rows reports 0.99 F1 mostly by remembering
  repeated sentences.
- Quality is measured by cross-validation by sentence. A parity fixture keeps
  Spring in step with the export.

Rejected: lift faults (no real report text exists publicly); building the
tokenizer into the graph with `onnxruntime-extensions` (its newest Java jar,
0.13.0, has no Apple Silicon or Linux arm64 library); keeping Claude (does not
meet the brief); classifying every complaint type in the dataset (most types
never route to a contractor in Upkeep); an image model (no labelled photos).

## Consequences

- No report text or photo leaves Upkeep for classification.
  `ANTHROPIC_API_KEY` is no longer needed, and the resident notice changes.
- Only water leaks route automatically. Pumps, lifts, gates and lights go to
  the managing agent, who can still send them to a contractor.
- The training data is US street complaints, and the model is evaluated only
  on those, so its performance on what estate residents write is unmeasured.
- The server gains the DJL tokenizer library, a model of about 23 MB in the
  jar, and roughly 100 MB more memory.
- Classification quality is now owned by the team. A model change means
  retraining, re-running cross-validation, and updating the parity fixture and
  `WaterLeakModel`'s constants in the same change.
