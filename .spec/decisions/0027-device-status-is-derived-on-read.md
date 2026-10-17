# 0027 - Device status is derived on read

## Status

Proposed.

## Decision

A device's reporting status is not stored. Spring calculates it from
`lastSeenAt` and `reportingIntervalSeconds` each time a device is returned,
using an injected `Clock`:

- No `lastSeenAt` gives Awaiting first reading.
- Silence of at most 3 times the reporting interval gives Online.
- Anything longer gives Offline.

Rejected:
- **A stored status updated by a scheduled job.** It would add a scheduler and
  a value that can drift from the truth between runs. Nothing yet needs to act
  at the moment a device goes offline.
- **A fixed threshold, such as 24 hours.** A device reporting every minute
  would look healthy for a day after failing. A device reporting daily would
  turn Offline whenever it was a second late.
- **Calculating status in the browser.** The browser's clock is not trusted,
  and every client would have to repeat the rule.

## Consequences

Status is only as fresh as the last fetch, so the Devices page polls. Offline
alerts will need a scheduled job, which can reuse the same rule. With very
short intervals the threshold is a few seconds, so ordinary network delay can
briefly show a device as Offline. Add a minimum threshold if that becomes noise.
