# 0042 - Contractors are reached by email dispatch on ID-36 work orders

**Status:** accepted (ID-70). Builds on 0032 (work-order creation), 0034
(progress) and 0040 (Crew read-only). Supplies the minimal provider and
assignment model that ID-37 extends.

## Context

ID-70 sends equipment faults to whoever fixes them. Contractors are outside
firms with no Upkeep account. `main` already has work orders (ID-36) and their
progress (ID-38). Its spec reserves providers, category routing and assignment
for ID-37, which is not built, and warns against parallel provider catalogues.

## Decision

- **Routing creates ID-36 work orders.** It uses the same creation rules
  (estate lock, active estate and location) through
  `WorkOrderService.createFromRoutedReport`. Automatic orders are created by
  `system:report-routing`, shown as "Upkeep (automatic routing)", with Medium
  priority. A Manager sending an escalated report chooses the priority.
- **A contractor is a `ServiceProvider`** (an estate's name and email address,
  unique per address), routed per equipment type by `EquipmentProviderRoute`.
  The ID-37 owner agreed this record becomes ID-37's provider.
- **Dispatch is the assignment.** Creating a `WorkOrderDispatch` records the
  provider and moves the order `OPEN` → `ASSIGNED` through `main`'s status
  history, as ID-37 is not built. Only open `EQUIPMENT_FAULT` orders from a
  resident report can be dispatched.
- **Email over SMTP** (Gmail account `csd.upkeep`), plain text, with the
  resident's photos attached. Storage keys never become public links (0026).
  Delivery runs through an outbox with retries; the dispatch status is separate
  from the order status.
- **Lock order is estate first**, then routing or order rows, everywhere.

Rejected: a second `WorkOrder` table (the first version, built on a stale
branch); contractors as `CREW` accounts; HTTP email APIs or a mail sandbox
(Gmail chosen); waiting for ID-37.

## Consequences

- ID-37 extends `ServiceProvider` and the dispatch-as-assignment instead of
  starting over, and owns reassignment, unassignment and provider filtering.
- The resident's words and photos leave the system and cannot be recalled.
- The email is one-way: no replies, status updates or completion from the
  contractor.
- Without SMTP settings, dispatches fail with `MAIL_NOT_CONFIGURED` and orders
  stay `ASSIGNED` until a Manager retries.
