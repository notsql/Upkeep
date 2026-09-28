# 0017 - Asset condition is an append-only history

## Status

Accepted.

## Decision

Condition lives in its own `AssetAssessment` table, never on `Asset`. Rows are
inserted and never updated or deleted. The current condition is derived as
the assessment with the latest `assessedOn`, then the latest `createdAt`.

Who recorded an assessment is stored as the verified JWT subject, plus a name
snapshot looked up from WorkOS at write time. The access token carries no name,
and resolving IDs to names on every read would make each history view depend
on WorkOS.

Conditions are a fixed enum: `GOOD`, `NEEDS_ATTENTION`, `FAULTY`.

Rejected:
- **A `condition` column on `Asset`.** It would need a second copy of the
  history, and it would put asset edits and condition changes in one row, which
  the ticket keeps apart.
- **Trusting a name sent by the browser.** It is not verifiable, so it cannot
  back an audit trail.

## Consequences

Editing an asset cannot lose assessments, because they are not in the row being
edited. Correcting a wrong assessment means recording a new one, which keeps
the mistake visible. A failed WorkOS lookup stores no name; the user ID is
always kept, so the name can be recovered later.
