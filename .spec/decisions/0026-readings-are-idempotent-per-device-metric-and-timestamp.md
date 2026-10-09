# 0026 - Readings are idempotent per device, metric and timestamp

## Status

Proposed.

## Decision

A reading is identified by its device, metric and `measuredAt`, enforced by a
unique index.

- A new key is stored and returns 201.
- An identical retry, with the same key and value, stores nothing and returns
  200 with the reading already stored.
- A different value for an existing key is rejected with 409 and changes
  nothing.
- Valid readings that arrive out of order are accepted.

Values are stored as `numeric(18, 6)` and compared as decimals, never as
floating-point numbers.

Validation checks the shape of the payload. It does not judge whether a value
is plausible.

Rejected:
- **Last write wins.** It silently rewrites history that maintenance decisions
  may already rest on.
- **Rejecting out-of-order readings.** Devices buffer readings and resend them
  after network drops, so arrival order is not measurement order.
- **Comparing values as `double`.** `21.5` and `21.50`, or values that
  round-trip through JSON differently, would count as conflicts.
- **Range checks on values.** An extreme reading may be the fault the system
  exists to catch.

## Consequences

A device that genuinely corrects a reading cannot do so through the API. The
correction has to arrive with a new timestamp. 200 and 201 let a device tell
"already had it" from "stored now", but both mean success. Last-seen is
updated on both, because either proves the device is alive.
