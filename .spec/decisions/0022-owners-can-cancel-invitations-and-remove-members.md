# 0022 - Owners can cancel estate invitations and remove members

**Status:** accepted (2026-10-06)
**Extends:** [ADR 0020](0020-council-invitations-are-estate-scoped.md) and
[ADR 0021](0021-existing-accounts-use-in-app-invitations.md), superseding their
exclusion of invitation cancellation from this story.

Partly superseded by [ADR 0023](0023-reconcile-old-invitations-and-allow-reinvitation.md)
for recipient visibility and re-invitation behavior.

Invitation revocation/removal rules partly superseded by
[ADR 0024](0024-invitation-permission-revocation-affects-future-invites.md).

## Context

The user requested a way for estate owners to correct invitations sent to the
wrong person and revoke access after acceptance. Delegated invitation authority
must not imply authority to remove other members.

## Decision

- Only the estate owner lists outstanding invitations, cancels them, or removes
  member access. These controls also work on inactive estates. The owner cannot
  remove their own implicit access. Confirmation shows the affected email.
- Cancellation changes a SENDING, PENDING or IN_APP row to CANCELLED under its
  row lock. It is idempotent. Accepted invitations return a conflict directing
  the owner to remove the member instead.
- Enforce cancellation locally. Do not delete or revoke a WorkOS identity or
  alter organization roles. An already-sent email can still permit account
  registration, but cannot activate membership through the cancelled row.
- Member removal deletes only that estate's membership and delegated invitation
  permission. It also cancels outstanding invitations for the member's current
  WorkOS email in the same transaction. Consumed invitations stay consumed.
- Removal locks estate invitation rows before the estate, consistent with
  activation's invitation-then-estate order. Dispatch finalization uses a
  conditional update so it cannot overwrite cancellation. A concurrent state
  change returns a conflict rather than an incorrect send-success message.

## Consequences

No schema migration or new provider operation is needed. Account identity,
other-estate access and estate records remain intact. Revocation is enforced on
subsequent server requests, not by erasing already-rendered browser content.
Member removal needs a WorkOS user lookup to identify pending invitations by
email; a provider failure leaves access unchanged and reports an error.

Cancelled/accepted rows retain their unique estate/email key. Re-invitation,
resend, expiry renewal and ownership transfer remain separate work. The API and
UI details are in the [API](../../.docs/api/council-invitations.md) and
[frontend](../../.docs/frontend/council-invitations.md) docs.
