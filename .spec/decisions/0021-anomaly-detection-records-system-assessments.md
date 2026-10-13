# 0021 - Anomaly detection records system assessments

## Status

Accepted.

## Decision

When the anomaly model finds a sustained abnormal run in a pump's readings,
the server records an ordinary `AssetAssessment` (decision 0017) with
`recordedByUserId = "system:anomaly-model"` and the name "Anomaly detection".
Its condition is `NEEDS_ATTENTION` or `FAULTY`, and its notes carry the run's
length, scores and times.

The metric catalogue (decision 0016) gains `VIBRATION_ACCELERATION` in g
(RMS). The existing `VIBRATION` in mm/s is unchanged.

Readings submitted for an anomaly check are scored and discarded. They are not
stored until ID-43.

Rejected:
- **A separate table for model findings.** The current condition, the flag
  logic and the condition history would each need to merge two sources. As an
  assessment, a model finding flags the pump the same way a person's does, and
  a person corrects it by recording a new assessment.
- **Converting acceleration to mm/s.** Velocity from acceleration needs the
  vibration frequency, which the device does not report, and the model was
  trained on g RMS (SKAB `Accelerometer1RMS`). A conversion would feed the
  model numbers it never saw.
- **Storing readings now.** Storage, retention and device credentials are
  ID-42 and ID-43's decisions; scoring does not need them.

## Consequences

`system:anomaly-model` is not a WorkOS user, so anything that resolves
recorder IDs must treat the `system:` prefix as a non-person. A model finding
is indistinguishable from a person's assessment except by that ID, which the
UI uses to label it. Because readings are not stored, a batch cannot be
re-scored later with a newer model, and an abnormal run cannot span two
batches.
