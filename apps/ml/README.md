# ml

FastAPI + onnxruntime service that serves one ONNX model on **:8000**.

Only `apps/server` calls it - it has no CORS configuration and is not exposed to
the browser. The Spring API stays the single typed contract the web app knows
about.

## Running it

```bash
pnpm dev:ml          # or `pnpm dev`, which starts it alongside web + server
```

The dev target shells out to `uv`, which must be installed on your machine
(`brew install uv`). `uv run` creates and syncs `.venv` on first use.

Drop a model at `apps/ml/models/model.onnx` before starting - the app loads it
during startup and refuses to boot without it.

## Configuration

Environment variables, read from `apps/ml/.env` (all prefixed `ML_`):

| Variable | Default | Meaning |
| --- | --- | --- |
| `ML_MODEL_PATH` | `models/model.onnx` | The `.onnx` file to serve, relative to `apps/ml` |

The bind address and port (`0.0.0.0:8000`) are uvicorn CLI flags, set in
`apps/ml/project.json` and `apps/ml/Dockerfile`.

These are Python-side settings via `pydantic-settings`, so they are *not* in
`packages/env` - that package only types the TypeScript apps' environment.

## Endpoints

| Route | Does |
| --- | --- |
| `GET /health` | `200 {"status":"ok"}`, or `503 {"status":"no_model"}` when no `.onnx` is present |
| `GET /model` | The loaded model's input/output names, types and shapes |
| `POST /predict` | Runs inference |

`/predict` is generic: it takes each input tensor by the name the model
declares, as nested JSON lists, and casts it to the dtype the model expects.

```bash
curl -X POST localhost:8000/predict \
  -H 'content-type: application/json' \
  -d '{"inputs": {"input": [[1.0, 2.0, 3.0]]}}'
```

```json
{ "outputs": { "output": [[0.1, 0.9]] } }
```

Unknown or missing input names come back as `400`. Call `GET /model` when you
are not sure what the model wants.

The service starts even when `ML_MODEL_PATH` points at nothing; until a model
is dropped in and the service restarted, `/model` and `/predict` return `503`.
A model file that exists but won't load still stops startup.

## Tests

```bash
pnpm test            # includes this project
cd apps/ml && uv run pytest
```

The tests build a tiny ONNX graph on the fly, so they need no checked-in model.
