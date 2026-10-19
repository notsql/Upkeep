# In-process anomaly inference

**Status:** agreed
**Owner:** Ong Zheng Kai

## Problem

Anomaly scoring runs in a separate Python service (`apps/ml`) that Spring calls
over HTTP. That service is ~176 lines of generic `/predict` code: every
feature is already built in Java (`AnomalyFeatureBuilder`), and Python only
hosts onnxruntime. Keeping it costs a second container to deploy and secure
(see `deployment.md`), a network hop with a 5-second timeout, a
second cold start, and `uv` + Python as developer and CI prerequisites. The
reason 0007 gave for a Python service - preprocessing lives in Python - no
longer holds.

## Decision summary

Spring runs the ONNX model itself with onnxruntime's Java library
(`com.microsoft.onnxruntime:onnxruntime`). `apps/ml` is deleted. A new
decision record, 0028, supersedes 0007 and carries over its `ml-research/`
boundary (the exported `.onnx` stays the only interface).

A separate Spring Boot service for ML was considered and rejected: it keeps
every deployment cost above (second container, token-gated Worker, network
hop, a second ~20-40 s JVM cold start chained behind the first) and only
removes the Python toolchain. Isolating the model's lifecycle or scaling it
independently is not a need we have.

## Behaviour

- The model ships inside the Spring jar at
  `apps/server/src/main/resources/anomaly/model.onnx` (moved from
  `apps/ml/models/model.onnx`; identical to
  `ml-research/artifacts/pump-anomaly-platform/model.onnx`).
- `AnomalyScorer` (replaces `MlClient`, same package) loads the model once at
  startup into a single `OrtSession` on the CPU provider and reuses it for
  every request. `OrtSession.run` is thread-safe, so no locking.
- If the model resource is missing or does not load, the application fails to
  start. (It is in the jar, so a missing model is a build bug, not a runtime
  state - unlike `apps/ml`, which booted without one.)
- `scores(double[][] features)` feeds the rows as a `float32` tensor of shape
  `[n, 15]` named `input`, reads the `probabilities` output (`[n, 2]`), and
  returns column 1 for each row, in order.
- For every row of `parity-fixture.json` (already in test resources),
  `scores` reproduces the fixture's `score` within `1e-5`.
- If inference throws, or returns a row count different from the input, the
  scorer throws `MlUnavailableException` and the anomaly check answers `503`
  with nothing recorded - the existing contract, unchanged.
- `ML_API_URL` is no longer read anywhere.

## Changes outside the scorer

- `apps/server/pom.xml`: add `com.microsoft.onnxruntime:onnxruntime` (agent
  edits the pom; human runs the build to fetch it). Its jar bundles native
  libraries for linux x64/arm64 and macOS arm64, so the Temurin images and
  Apple Silicon both work.
- `AnomalyCheckControllerTests`: the JDK `HttpServer` stub for `apps/ml` is
  replaced by a `@MockitoBean AnomalyScorer` that returns the scores each test
  chooses. The scenarios stay the same; the "ML is slow" timeout case is
  dropped since there is no network call.
- `AnomalyModel`'s comment points at the new model path.
- Deleted: `apps/ml/`, the `dev:ml` script, the `ml` service in
  `docker-compose.yml` and `ML_API_URL` on `server`, `ML_API_URL` in
  `apps/server/.env.example`, the uv step in `pr-checks.yml`.
- `ml-research/`: README and notebook export cells point at
  `apps/server/src/main/resources/anomaly/model.onnx`.
- Docs: `.docs/api/anomaly-check.md` (503 wording), `.spec/architecture.md`
  (env table, topology), `AGENTS.md` (stack table, §5 Python section, §6
  rows), `README.md` (stack, prerequisites, ports, scripts).

## Data

None.

## API

No contract change. `POST` anomaly check keeps its request, response and
status codes; `503` now means inference failed rather than "service
unreachable".

## Edge cases

- Concurrent anomaly checks share one session; onnxruntime allows concurrent
  `run` calls on it.
- Every `OrtSession.Result` and input `OnnxTensor` is closed after use
  (try-with-resources) - they hold native memory the GC does not see.
- `float32` input: features are `double` in Java and are narrowed exactly as
  Python's `np.asarray(..., float32)` did; the parity test guards this.
- Image size grows by onnxruntime's native libraries (~30-50 MB); JVM memory
  grows by the session (the model is 5 MB).
- Replacing the model is now: drop the new `.onnx` at the resource path,
  update `AnomalyModel`'s constants and the parity fixture, redeploy Spring.

## Out of scope

- A generic `/predict` or `/model` endpoint - the only caller is the anomaly
  check.
- Hot-reloading the model without a restart.
- GPU execution providers.
- Changing `MlUnavailableException`'s name or the anomaly check's API.
