# 0024 - Revoking invitation permission affects future invitations

**Status:** accepted (2026-10-06)

Supersedes the current-invitation-permission acceptance requirement in
[ADR 0020](0020-council-invitations-are-estate-scoped.md) and extends removal in
[ADR 0022](0022-owners-can-cancel-invitations-and-remove-members.md).

## Decision

An invitation sent with authority remains valid after the owner revokes that
member's invitation permission. Revocation blocks new invitations; explicit
cancellation withdraws an existing invitation. Both email reconciliation and
in-app acceptance follow this rule.

Removing a member cancels outstanding SENDING, PENDING and IN_APP invitations
they sent in that estate, as well as invitations addressed to them. This occurs
in the existing removal transaction, using its invitation-before-estate lock
order. Accepted recipients retain their independent memberships. The removal
confirmation states the cancellation effect.

Acceptance still checks that the inviter belongs to the estate (or is its
owner), plus the existing expiry, recipient, active-estate and invitation state
checks. No new schema, endpoint or configuration is needed.

## Consequences

Turning off permission does not leave unusable invitations. Member removal
withdraws outstanding invitations from recipient and owner lists on refetch;
already-open recipient pages are not remotely cleared. A cancelled invitation
cannot activate even if its email still permits WorkOS registration. The owner
can issue a fresh invitation when access is appropriate.
