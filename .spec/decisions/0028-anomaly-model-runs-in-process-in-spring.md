# 0028 - The anomaly model runs in process in Spring

**Status:** accepted. Supersedes `0007`; its `ml-research/` boundary carries
over below.

## Context

0007 put ONNX inference in a separate Python service (`apps/ml`) because model
tooling and preprocessing were Python. That no longer holds: every anomaly
feature is built in Java (`AnomalyFeatureBuilder`), and `apps/ml` only hosted
onnxruntime behind a generic `/predict`. It still cost a second container to
deploy and secure, a network hop with a timeout, a second cold start, and
`uv` + Python as developer and CI prerequisites. See
`.spec/features/in-process-anomaly-inference.md`.

## Decision

- **Spring runs the model itself** with onnxruntime's Java library
  (`com.microsoft.onnxruntime:onnxruntime`). `apps/ml` is deleted.
- The model ships in the jar at
  `apps/server/src/main/resources/anomaly/model.onnx`. `AnomalyScorer` loads
  it once at startup into one CPU `OrtSession` shared by every request; a
  missing or unloadable model fails startup.
- A failed inference throws `MlUnavailableException`, so the anomaly check
  still answers 503 and records nothing.
- A separate Spring Boot ML service was rejected: it keeps every deployment
  cost above and only drops the Python toolchain.

## Training lives outside the workspace

Unchanged from 0007. `ml-research/` holds experiments, notebooks and training
code at the repo root, outside the `apps/` and `packages/` globs, so
exploratory work cannot break the build. It keeps its own `uv` environment so
training dependencies never reach the serving image. The exported `.onnx` file
is the only interface: `apps/server` does not import from `ml-research`, and
the reverse is equally forbidden.

## Consequences

- No `uv` or Python is needed to develop, test or deploy the app; only
  `ml-research/` uses them.
- The server image grows by onnxruntime's native libraries, and the JVM by the
  session. The jar bundles natives for linux x64/arm64 and macOS arm64 only.
- Swapping the model is a Spring change: replace the resource, update
  `AnomalyModel`'s constants and the parity fixture, and redeploy. A changed
  input or output signature needs a code change in `AnomalyScorer`.
- Model and API now share a lifecycle and a process; scaling or isolating the
  model separately is not possible without reversing this.
