# 0023 - Show older pending invitations and allow fresh invitations

**Status:** accepted (2026-10-06)
**Supersedes:** recipient-list restrictions in ADR 0021 and the re-invitation
limitation in ADR 0022.

## Context

Live testing found that accounts created after an email invitation could not
find it on My estates. Cancelled invitation records also permanently blocked
inviting that address again, preventing recovery from testing or mistakes.

## Decision

Verified matching recipients may see and explicitly accept both PENDING email
and IN_APP invitations before expiry. Explicit acceptance checks expiry under
the row lock. The existing WorkOS reconciliation flow still accepts only provider
acceptances matching its invitation ID, email, user and expiry. Listing alone
never grants membership; failed SENDING rows remain retryable by the inviter.

The unique estate/email row represents the current invitation attempt. A fresh
invitation replaces a CANCELLED attempt, or an ACCEPTED attempt after membership
removal. Replacement assigns a new UUID and creation time, uses the newly
submitted name and authorized inviter, and clears provider/acceptance metadata.
Active membership and outstanding attempts still block duplicate invitations.
The old UUID and provider correlation cannot activate or finalize the new attempt.
An activation racing with replacement treats a missing old ID as unavailable.

## Consequences

No schema migration or manual deletion of test records is required. Previous
invitation attempts are not retained as a separate audit history. Re-inviting
uses the normal form; active duplicate dispatch retries keep the current key,
while a new attempt has a new key. New-account delivery remains subject to
WorkOS errors; there is no promise of forcibly resending an existing provider
email. Expired pending attempts can be cancelled before starting a fresh one.
