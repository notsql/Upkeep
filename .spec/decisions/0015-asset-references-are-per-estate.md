# 0015 - Asset references are generated per estate

## Status

Accepted.

## Decision

Spring assigns each asset a reference `<ESTATE CODE>-A<nnnn>` (zero-padded to
four digits, growing beyond that if needed) when the asset is created. The
number is the estate's asset count plus one. It is read while the transaction
holds the estate row lock. Assets are never hard-deleted, so the count only
grows and no number is reused. `@@unique([estateId, reference])` is the
backstop.

Rejected:
- **User-entered references.** They invite typos, duplicates and inconsistent
  formats, and the ticket asks for a unique reference, not a chosen one.
- **A global sequence.** It leaks cross-estate volume and reads poorly
  ("A48213").

## Consequences

References are stored, not derived. If an owner later edits the estate's code,
existing references keep the old prefix. Creation is serialised per estate
because of the estate row lock, which it already needs for the inactive-estate
check (decision 0010). This decision is numbered 0015 because unmerged branches already
use 0012 and 0014.
