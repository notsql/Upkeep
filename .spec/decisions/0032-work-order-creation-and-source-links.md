# 0032 — Work-order creation and source links

Agreed 2026-10-22 for ID-36.

Owners and current estate Managers create work orders; owners, Managers and
Crew read every order in their authorized estates. Explicit access projection
booleans keep these permissions independent of sensor administration, report
response and owner-only asset management. A restricted asset picker supports
non-owner Managers without widening asset APIs. Equipment links are optional.

A report can lead to several jobs. Each order retains its report relation and
independent immutable creation data, reference, category and priority. Creating
one never changes or consumes the report. Report conversion also requires
independent responder membership and compares observed report placement after
the shared estate lock is acquired. The chosen work location can differ.
Inspection/recommendation sources initially store a manual reference; saved
inspection integration waits for that feature.

Creation locks Estate before checking current authority and related active
records, then allocates a per-estate count-plus-one reference under the lock,
using the current estate code and W plus at least four digits. No deletion or
renumbering exists; a code change keeps the sequence. Composite estate foreign
keys protect related records. Initial status is OPEN; workflow and assignment
are follow-up stories. Additive migration permits rolling deployment.

The form disables Save while pending and does not retry POST automatically.
An ambiguous response asks the creator to check the list. Intentional concurrent
jobs from the same report are valid, so there is no unique source constraint or
general request-idempotency subsystem.

