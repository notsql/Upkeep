# 0020 - Council invitations and delegation belong to an estate

**Status:** accepted; existing-account delivery and acceptance superseded by
[ADR 0021](0021-existing-accounts-use-in-app-invitations.md).

Invitation revocation/removal rules partly superseded by
[ADR 0024](0024-invitation-permission-revocation-affects-future-invites.md).

## Context

ID-21 lets estate creators provision council access and delegate invitation
work. WorkOS organization roles and the existing admin dashboard are separate
from application estates. Council membership must not replace existing identity
roles or grant access to other estates.

## Decision

- Keep membership/role and `canInviteMembers` on `EstateUser`; ownership remains
  on `Estate.ownerUserId`. Only the owner grants/revokes invitation permission.
  Delegates invite Council members but cannot delegate onward. All checks read
  the database on each request. New/existing grants default to no delegation.
- Track a unique estate/email invitation with its original inviter and a stable
  delivery UUID before contacting WorkOS. Use that UUID as the idempotency key
  so a failed dispatch can be retried without a new logical invitation.
- Use application-wide WorkOS invitations (no organization/role assignment).
  WorkOS sends the email and handles account creation/reuse; Spring stores the
  pending name/email and the provider invitation ID, never the setup token.
- WorkOS permits application invitations to be accepted with another email.
  Spring therefore verifies recipient identity/email and provider acceptance
  before activating estate membership. It never trusts client claims of success.
- My estates reconciles accepted invitations through an authenticated POST.
  Atomic activation preserves existing grants, rejects inactive estates or
  revoked inviters, and prevents duplicate membership on concurrent acceptance.
- Extend the existing sign-in route to forward invitation tokens on the URL
  produced by AuthKit, retaining its PKCE cookies/state. No custom credential
  handling, mail service, or webhook secret is added.

## Consequences

The WorkOS User invitation URL must point to the web `/api/auth/sign-in` route.
Council asset access remains read-only. General custom roles stay in ID-94.
Activation waits until the user opens My estates and verifies successfully;
provider failures expose retry without blocking access to existing estates.
Resend/revoke management is outside this story, so duplicate local invitation
rows are retained instead of silently issuing new emails.
