# 0045 - Report urgency and Safety classification

Date: 2026-11-07
Status: Accepted

## Context

ID-72 needs a hazard-first queue without adding a report lifecycle or changing
resident submission/history. Duplicate handling (ID-74) is now merged; report
routing remains independent.
Concurrent Manager edits must not silently overwrite unseen changes.

## Decision

Keep report urgency separate from work-order priority. Use a fixed application
enum Low/Medium/High/Urgent with Medium as the additive database default.
Current active-estate Managers manually mark Safety; Safety requires Urgent and
sorts above routine Urgent. Existing report-read capabilities expose estate-only
urgency fields on ID-74’s shared estate DTOs; resident contracts remain unchanged.

Derive Open from same-estate source work orders: no work orders or any non-CLOSED
order. The estate queue defaults Open; the API defaults All for source pickers.
Default to the full safety/rank/time/UUID order and offer Newest first and
Oldest first, which order solely by time/UUID descending or ascending. Apply
filters and ordering in PostgreSQL before paging.
Cursors carry the ordering tuple and are scoped to filters and the selected sort. Existing estate/location indexes
filter candidates; rank uses a typed jOOQ CASE, not alphabetical string order.
No unmanaged expression index or redundant stored ranking field is introduced.

Serialize edits with the existing estate-before-membership lock order. Require
an observed version, including no-ops, to catch stale and changed-back edits.
Update the report and append its event in one transaction. Resolve the optional
actor display-name snapshot before taking locks. Store all events but expose
only the latest event through estate detail; a full audit browser is outside
ID-72. Explicit OpenAPI object-or-null composition keeps generated TypeScript
honest for a report without any change event.

## Consequences

Changes are compatible with older report writers and do not rewrite existing
work orders. Safety is a Manager judgement, not an automatic classification.
Queue pagination is not a snapshot across requests; edits can move rows and a
first-page refresh reloads the current order. Duplicate and urgency writes
return the same combined estate detail; the existing duplicate restrictions on
work-order creation remain. Future dismissed routing records must be excluded
from Open once routing exists.
