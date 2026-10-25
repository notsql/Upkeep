# 0034 — Work-order progress and canonical completion

Agreed 2026-10-24 for the independent ID-38/ID-40 scope.

Owners/current Managers update work in active estates; Crew read only. Explicit
Open → In Progress supports unassigned work while ID-37's real provider model
is pending. Assigned can start work when available; this change does not create
assignments or implement provider filtering. Closed requires a completion and is
immutable. ID-38 remains partly dependent on ID-37.

Estate-first locking rechecks membership and lifecycle before each write. A
required optimistic version rejects stale updates. Each transition appends a
versioned actor/time event. New creation appends Open; legacy creation history
is derived from the saved creator/time without a fabricated backfill.

WorkOrderCompletion is the canonical, unique outcome/cost record. One transaction
inserts it, changes the status/version, and appends Closed. Identical normalized
retries replay the saved result even with the original version; different outcomes
conflict. Authorization still precedes replay. Estate/order locks and uniqueness
prevent concurrent duplicate outcomes. There is no edit/reopen operation.

Findings/work performed are required. Aggregate labour/parts costs are nullable
SGD Decimal(14,2), transported as decimal strings; unknown differs from zero.
Total is known only when both components are known. Downtime is nullable whole
minutes. Versions and downtime require JSON integer tokens, preventing Jackson
from truncating fractional values or coercing numeric strings. Parts-used notes
are optional; itemization and invoices are separate.

Asset history reads completion through the original work-order asset relation;
it does not copy costs into AssetEvent. ID-49/50 should consume this identity.
Owner-only asset access remains independent of Manager work-order access.
Existing work can close after asset movement, retirement or deactivation in an
active estate; saved work location remains unchanged. Closing does not alter
asset condition, resident-report status or forecasting maintenance events.
