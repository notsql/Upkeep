# 0054 - Work order assignment

## Status

Accepted. Supersedes parts of 0040 and 0048.

## Context

Orders could only be "assigned" by emailing a contractor, and Crew could never
progress an order. Estates need to give a job to a team member or a contractor
from one place.

## Decision

- `WorkOrder` stores one assignee: a Manager/Crew member or a contractor from the
  estate's directory (`ServiceProvider`). One service performs every
  assignment, including automatic report routing.
- Contractors become a per-estate directory; per-equipment defaults point into it.
- `WorkOrderDispatch` is an email outbox with many rows per order. Taking a job
  away from a contractor supersedes their unsent emails.
- A member assignee gets a `WORK_ORDER_ASSIGNED` notification, behind a sixth
  estate switch.
- The Crew member an order is assigned to may start and complete it.

## Consequences

Removing a contractor with open jobs is refused. Closed orders keep the copied
assignee name. The migration is expand-only.
