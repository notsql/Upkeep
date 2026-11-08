# 0044 - Anomaly scoring runs on ingested readings

## Status

Accepted (2026-11-07). Extends [0021](0021-anomaly-detection-records-system-assessments.md):
its "scored, not stored" still describes `POST .../readings/anomaly-check`.

## Decision

Readings stored through `/device-api/readings` and `/device-api/telemetry` are
scored by the in-process model (decision 0028). Each sample's score is stored
once in `AnomalyScore`, and abnormal runs are worked out from stored scores, so
a run can span device batches and scoring passes. Findings are still ordinary
`system:anomaly-model` assessments, as 0021 decided.

- **Trigger.** `ReadingService` publishes `ReadingsStored(assetId)` when a
  request stores a new reading. `AnomalyScoringScheduler` receives it with
  `@TransactionalEventListener` (after commit), so a pass only sees committed
  readings and never runs for a request that rolled back. It hands the work to
  a dedicated two-thread executor (`anomalyScoringExecutor`), so the device's
  response never waits for the model, and logs and drops failures.
- **Coalescing.** The scheduler keeps at most one queued run per asset. A run
  scores everything unscored when it starts, so back-to-back backfill batches
  fold into it instead of each queuing a pass.
- **Serialisation.** Each pass is one transaction that first takes
  `pg_advisory_xact_lock(hashtextextended(assetId, 0))`. Passes for one asset
  wait for each other, on every server instance (Cloud Run may run several);
  passes for other assets do not. The lock is released by commit or rollback,
  so a crashed pass cannot leave it held. The unique `(assetId, measuredAt)`
  index stays as the backstop (`ON CONFLICT DO NOTHING`).
- **Failure.** `MlUnavailableException` rolls the pass back. Nothing is
  stored, and the samples stay unscored for the next pass.

Rejected:
- **`@Async` plus `@EnableAsync`.** It would change the meaning of every
  future `@Async` in the app and still need its own executor; one explicit
  executor call is smaller.
- **An in-JVM lock per asset.** It does not hold across Cloud Run instances,
  so two instances could record two assessments for one run.
- **Row locks on `Asset`.** They would block asset edits and retirement while
  the model runs.
- **A scheduled poller.** It adds latency and work when nothing has arrived,
  and still needs the same serialisation.

## Consequences

A scoring pass holds a database connection while the model runs (milliseconds
for 3,600 rows). Scoring is best effort: if the process stops between commit
and the pass, those samples are scored when the asset next stores a reading.
