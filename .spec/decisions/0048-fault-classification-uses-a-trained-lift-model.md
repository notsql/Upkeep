# 0048 - Fault classification uses a trained lift model

**Status:** accepted (ID-70, 2026-11-08). Supersedes the model choice in
0046; 0046's other points (classify in Spring, in a scheduled job, outside
any transaction, with a fixed 0.80 threshold) stand.

## Context

0046 classifies resident fault reports by sending their text and photos to
Claude. The project brief asks for an advanced AI feature, which a prompt to a
hosted model does not meet: the team neither builds the model nor can
evaluate it properly. The repo already serves one model the team trained,
the anomaly model, as ONNX inside Spring (0028), with `ml-research/`
producing it.

## Decision

- Replace `AnthropicFaultClassifier` with `OnnxFaultClassifier`, which runs a
  text classifier the team trains in `ml-research/` and ships as
  `routing/lift-fault-model.onnx`. There is no API fallback.
- Scope it to lifts: five lift fault classes (`DOOR`, `STALLED`,
  `CONTROLS`, `RIDE`, `OTHER_LIFT`) plus `NOT_LIFT`. Reports about other
  equipment go to the managing agent.
- The model is a fine-tuned MiniLM-L6, calibrated with temperature scaling
  and quantised to int8. The `.onnx` file plus its `tokenizer.json` are the
  interface from `ml-research/` to Spring, which tokenizes with
  `ai.djl.huggingface:tokenizers`.
- Text only. Photos are not classified.
- Quality is measured on a hand-written test set, frozen before any
  training data is generated, and kept in step by a parity fixture in the
  server's tests.

Rejected: building the tokenizer into the graph with `onnxruntime-extensions` (its
newest Java jar, 0.13.0, has no Apple Silicon or Linux arm64 library); keeping
Claude (does not meet the brief); TF-IDF with logistic
regression (simpler to serve, but the team chose one model and wanted the
stronger one); an image model (no labelled lift photos to train on); covering
all four equipment types at once (four times the data work for the same
demo).

## Consequences

- No report text or photo leaves Upkeep for classification.
  `ANTHROPIC_API_KEY` is no longer needed, and the resident notice changes.
- Pumps, gates and lights are no longer routed automatically.
- The server gains the DJL tokenizer library, a model of about 23 MB in the
  jar, and roughly 100 MB more memory.
- Classification quality is now owned by the team. A model change means
  retraining, re-evaluating on the frozen test set, and updating the parity
  fixture and `LiftFaultModel`'s constants in the same change.
