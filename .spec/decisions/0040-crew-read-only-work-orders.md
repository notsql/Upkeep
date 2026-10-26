# 0040 — Crew have read-only work-order access

**Status:** accepted, 2026-10-26

The user revised Crew work-order authority to read-only. This supersedes the
work-order creation portion of
[0037](0037-standalone-inspections-and-crew-creation.md); its standalone inspection
recording, evidence and read-access decisions still apply.

Creation and the creation-only work-order asset picker require current
Owner/Manager authority in the requested active estate. Access context projects
`canCreateWorkOrders: false` for Crew; `canViewWorkOrders` remains true and
`canUpdateWorkOrders` remains false. Server checks apply after the estate lock
so a Manager demoted while waiting cannot create an order.

Crew may save Pass/Fail inspection results. Saving a Fail returns to asset
inspection history; an Owner/Manager can later convert that saved result.
Work-order source links, earlier Crew-created orders and inspection evidence
remain unchanged. Document-association writes independently require
Owner/Manager authority; permitted attachment/history reads remain available.

The existing capability-based UI hides creation controls and denies direct
creation routes without adding a new frontend role policy. See the
[agreed spec](../features/crew-work-orders-read-only.md).
