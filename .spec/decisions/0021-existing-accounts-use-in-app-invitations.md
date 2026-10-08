# 0021 - Existing accounts accept estate invitations in the application

**Status:** accepted (2026-10-05)
**Supersedes:** the existing-account delivery and acceptance assumptions in
[ADR 0020](0020-council-invitations-are-estate-scoped.md).

Partly superseded by [ADR 0023](0023-reconcile-old-invitations-and-allow-reinvitation.md)
for recipient visibility and re-invitation behavior.

## Context

Live WorkOS calls returned `400 user_already_exists` when sending an
application-wide invitation to an existing account. The original mocked tests
did not expose this restriction. Existing users must reuse their identity,
retain current roles/access, and explicitly accept membership in a new estate.

The repository has no transactional email service. The user chose in-app
acceptance for existing accounts rather than introducing a provider and sender
domain setup solely for this feature.

## Decision

- Keep WorkOS application-wide email invitations for new accounts.
- Handle only the send operation's `user_already_exists` rejection as an
  existing-account invitation. Other errors remain provider failures.
- Store it as IN_APP with a seven-day expiry and no provider invitation ID.
  Reuse the existing invitation row and schema; do not create another identity.
- Show pending invitations on My estates only to the signed-in WorkOS user
  whose verified email matches. Require an explicit Accept action for one
  invitation. Neither sign-in nor listing grants access.
- Check expiry and invitation state under the activation lock. Retain the
  active-estate/current-inviter checks and preserve existing estate grants.
  The automatic WorkOS acceptance reconciliation processes email invitations
  only; it excludes IN_APP rows.
- Tell the inviter that the recipient accepts on My estates and no email was
  sent. A previously failed SENDING reservation can be retried into this flow.

## Alternatives and consequences

Application-owned email invitations for everyone would provide consistent
notifications, but require an email service, verified sender, credentials,
secure links and delivery/retry handling. This remains a possible future change,
not an integrated feature.

WorkOS organization invitations would change the membership model. Estates
remain local authorization boundaries; no organization memberships or roles
are added merely to work around the provider restriction.

Existing users must visit My estates to discover invitations. No new secret,
dependency or schema migration is needed for this correction. Resend/revoke and
expired-invitation renewal remain outside scope. The endpoint and UI details
live in the [API](../../.docs/api/council-invitations.md) and
[frontend](../../.docs/frontend/council-invitations.md) docs.
