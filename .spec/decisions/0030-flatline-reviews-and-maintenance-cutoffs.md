# 0030 — Derive flatline reviews and persist maintenance cutoffs

## Status

Accepted for ID-68, from the human-agreed specification (2026-10-20).

## Decision

Keep ingestion (ID-43) append-only. Derive each device/metric's current run from
accepted DeviceReading values on review. ID-68 does not call ML, store another
asset-condition flag, or depend on ID-67's future quality flags.

Persist estate/metric policies and the latest device/metric maintenance pause
through Prisma. Retain an expired pause's resumesAt as the measurement-time cutoff:
server time ends it without a browser and late pre-expiry data cannot revive old
evidence. Reject extensions of active pauses. Writes follow estate-then-asset
locking with a conditional unique-key upsert for simultaneous first pauses.

The pure detector compares whole-run decimal range and measurement timestamps.
A gap greater than twice the reporting interval restarts the run; silence never
extends evidence. Reviews use a repeatable snapshot and one injected UTC Clock.
Filter and classify before paginating results.

Sensor checks use current estate membership: owner/assigned admin managers edit,
Council reads, and same-estate residency overrides conflicting authority. Preserve
other features' owner-only asset permissions and return feature-specific canManage.

## Consequences

Late readings and policy edits are reflected by replaying stored history without
schedulers or invalidation bookkeeping. Queries batch current estate/device/asset
and registered metrics using the existing device/metric/time index. No arbitrary
lookback silently changes detection. Query cost/memory grow with retained history
despite bounded response pages; no scale benchmark is claimed. Incremental state
or caches require a separate design if that cost becomes material.

Only the latest pause cutoff is retained. Pause history UI, early resume, extensions,
physical diagnosis, automatic tolerance learning and notifications are out of scope.
