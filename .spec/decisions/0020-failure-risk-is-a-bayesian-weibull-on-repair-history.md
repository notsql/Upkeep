# 0020 - Failure risk is a Bayesian Weibull on repair history

## Status

Accepted.

## Decision

A pump's breakdown forecast is a Weibull life with a fixed shape `k` and a
gamma prior on its scale, updated by that pump's own `BREAKDOWN_REPAIR` and `PREVENTIVE` events. The
update is two sums (`a = a₀ + failures`, `b = b₀ + Σ tᵢ^k`) and the
probability of failure within `h` days is one closed-form expression. Spring
computes it in `com.proj.server.risk`. It is not a model in `apps/ml`.

The forecast is derived on every read from the asset's events. No forecast
state is stored.

Only events for the unit currently installed count: an event must fall on or
after the asset's `installedOn`, and its manufacturer and model snapshot must
match the asset's current values. Replacing a pump with a different brand or
model, or moving `installedOn` later, restarts the forecast from the prior.

Rejected:
- **A sensor-based remaining-life model.** In notebook 02 sensor features did
  not beat hours since the last repair at predicting time to failure (LOFO MAE
  27.7 h for sensors vs 19.8 h for predicting the mean). Repair history, not
  sensors, is the signal available at a weeks-to-months horizon.
- **Serving the forecast from `apps/ml`.** The arithmetic needs no trained
  weights, and putting it behind HTTP would make every forecast read depend on
  the inference service being up.
- **Storing the posterior and updating it on each event.** Back-dated events,
  edits to `installedOn` and unit replacements would each need the stored
  state rebuilt. Deriving on read makes the event list the only source of
  truth, and a pump has few enough events that the cost is negligible.
- **Keeping history across a unit replacement.** A new brand or model has its
  own failure behaviour; the old unit's breakdowns would make it look worse
  than it is.

## Consequences

The pump prior (`m` = 1095 days, `k` = 1.2, `a₀` = 0.5) is an agreed estimate,
not fitted to estate data (notebook 02's dataset is one machine with seven
failures, so its fitted values are indicative only). Revisiting the constants
is a code change. Changing them changes every pump's forecast on the next read,
with no migration. Events that stop counting stay visible in the event list,
marked `countsTowardForecast: false`, so a replacement never hides history.
