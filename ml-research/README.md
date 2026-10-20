# ml-research

Where the ML work happens before it ships in the API: data exploration,
training, evaluation, and exporting a model to ONNX.

This folder is deliberately **outside** `apps/` and `packages/`. Those are
workspace globs - anything in them becomes an Nx project or a pnpm package that
`pnpm build`, `pnpm test` and CI are expected to run. Research does not belong
in that contract: notebooks are exploratory, runs are slow, and a half-finished
experiment must never be able to break the build.

## The boundary

```
ml-research/       experiments, training, evaluation   ->  produces model.onnx
apps/server/       runs exactly one model in process   ->  consumes model.onnx
```

The `.onnx` file is the entire interface between them (decision 0028).
`apps/server` never imports from here, and nothing here imports from
`apps/server`.

To ship a model, export it and copy it across:

```bash
cp ml-research/artifacts/<experiment>/model.onnx apps/server/src/main/resources/anomaly/model.onnx
```

Spring feeds the model a float32 `input` of shape `[n, 15]` and reads column 1
of its `probabilities` output. In the same change, update `AnomalyModel`'s
constants from the experiment's `metrics.json` and copy its `parity-fixture.json`
to `apps/server/src/test/resources/anomaly/`; `AnomalyScorerTests` checks the
model against it. A changed signature needs a code change in `AnomalyScorer`.

## Layout

| Path | Holds |
| --- | --- |
| `notebooks/` | Exploration. Name them `NN-what-it-does.ipynb` |
| `data/` | Datasets. **Git-ignored** - never commit data |
| `artifacts/` | Trained models, checkpoints, metrics. **Git-ignored** |
| `src/ml_research/` | Code that notebooks import once it is worth reusing |

`data/` and `artifacts/` are ignored on purpose: this repo is for code, not for
weights or datasets. Keep them somewhere the team shares, and write down in
your notebook where a dataset came from so someone else can fetch the same one.

## Environment

`uv`, in its own environment - research pulls in heavy training dependencies
that have no business in the serving image.

```bash
cd ml-research
uv sync
uv run jupyter lab
```

Add what you need to `ml-research/pyproject.toml` (torch, scikit-learn,
transformers, whatever the experiment calls for) and run `uv sync`. Nothing
here is subject to the pnpm `catalog:` rule.

## Conventions

- **Commit notebooks with outputs cleared.** Stored outputs make diffs
  unreadable and can leak data. `uv run jupyter nbconvert --clear-output
  --inplace notebooks/*.ipynb` before committing.
- **Record how a model was produced.** A short note next to the artifact -
  dataset, parameters, metrics - is what makes a result reproducible.
- **Promote code out of notebooks.** Once a function survives two notebooks, it
  belongs in `src/ml_research/`, importable as `from ml_research import ...`.
