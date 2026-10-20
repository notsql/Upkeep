# 0007 - ONNX inference is its own Python service

## Status

Superseded by [0028](0028-anomaly-model-runs-in-process-in-spring.md). Its
`ml-research/` boundary carries over there.

## Context

We need to run an ONNX model. Java can host onnxruntime, but the tooling,
examples and preprocessing code for models are all Python, and a model's
lifecycle (swap the `.onnx`, restart) is unrelated to the API's.

## Decision

`apps/ml` is a FastAPI + onnxruntime service on **:8000**, managed by `uv`
and run through an Nx `dev` target like everything else.

**Only `apps/server` calls it.** It has no CORS configuration and, in Docker,
no published port - Spring reaches it at `http://ml:8000` via `ML_API_URL`.
The browser keeps talking to Spring alone, so the generated OpenAPI contract
in `packages/api` stays the web app's single source of API types.

The inference endpoint is generic: `POST /predict` takes input tensors keyed by
the names the loaded model declares and casts them to the dtypes it expects,
and `GET /model` reports that signature. Nothing here is specific to a
particular model, so swapping the `.onnx` file needs no code change.

## Consequences

- `uv` is a new prerequisite for developers. It is not installed by `pnpm
  install`; `pnpm dev` will fail on this project without it.
- Python dependencies live in `apps/ml/pyproject.toml` and `uv.lock`, outside
  the pnpm `catalog:`. The catalog rule covers JS packages only.
- Python configuration uses `pydantic-settings` (`ML_*` variables), not
  `packages/env` - that package types the TypeScript apps' environment.
- Inference is now a network hop from Spring, so the API must handle the ML
  service being down. Prefer a timeout and a clear error over a hang.
- `apps/ml` is not a pnpm workspace package (no `package.json`), only an Nx
  project. `pnpm check`/`check-types` do not cover it; `pnpm test` does, via
  the Nx `test` target.

## Training lives outside the workspace

`ml-research/` holds the experiments, notebooks and training code that produce
the model. It sits at the repo root rather than in `apps/` or `packages/`,
because those globs make a directory an Nx project or a pnpm package that
`pnpm build`/`pnpm test` and CI then run - and exploratory work must not be
able to break the build. It has its own `uv` environment so training
dependencies never reach the serving image.

The exported `.onnx` file is the only interface between the two: `apps/ml`
does not import from `ml-research`, and the reverse is equally forbidden.
