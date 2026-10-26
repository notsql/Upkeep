# 0037 — Standalone inspection evidence and Crew creation

Agreed 2026-10-26, implementing
[create inspection results](../features/create-inspection-results.md).

An asset inspection is a standalone append-only Pass/Fail result. It is not a
maintenance event or condition assessment, and it does not depend on a generated
monthly check. Snapshot its location identity/path and optional inspector name;
keep canonical evidence in private R2 storage under a distinct inspection prefix.
ID-49 consumes the read contract for its history table. No secondary history
write can erase or duplicate a successful result.

Current estate Owners, Managers and Crew can read results; active resources are
required for recording. The Resident override and independent ownership rules
match existing estate authority. Add separate estate-details and inspection
capabilities: Crew reads do not grant dashboard, estate-admin or asset-master
authority. Managers/Crew use restricted asset context on the existing URLs.

Save a failure before offering work-order creation. Add a nullable unique
inspection source relation to WorkOrder with a same-estate foreign key. One
estate-first transaction rechecks current authority, failed outcome, asset and
observed current location, then saves both order and source relation. Concurrent
conversion can link at most one order. Order completion never rewrites the
original Fail, and manual free-text INSPECTION sources remain supported.

Crew creation extends ID-36 generally, including its limited asset picker.
Progress/completion/correction continue to require Owner/Manager authority and
use an independent check; creation permission must not imply progress permission.

The conversion URL carries only the saved result ID. Add the authorised
estate-scoped `/inspection-results/{inspectionId}` lookup to resolve its asset
server-side, rather than trusting browser prefill fields. OpenAPI emits an
explicit object-or-null union for an absent work-order link so generated
frontend types agree with the wire response.

Prisma generated the additive migration against a disposable migrated Postgres
because the shared development database contained an unrelated migration absent
from this checkout. No reset or unrelated schema removal is part of this change.

After local verification, Prisma deploy applied the inspection migration and the
already-pending documents migration to development. The unrelated pre-existing
device-migration history entry was retained. Generated sources stay based on
the canonical repository migrations, not that other branch's extra device shape.
