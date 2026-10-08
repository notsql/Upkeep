# Manager account authorization

**Status:** invitation and membership workflows implemented; live invitation checks confirmed
**Owner:** Chan Ding Jie
**Jira:** [ID-21](https://notjira.atlassian.net/browse/ID-21)

## Scope

An estate's creator can invite Council members and delegate invitation work to
selected members. This feature covers invitations, acceptance, estate membership,
invitation delegation, cancellation and removal. It is separate from application
admin roles and WorkOS organization roles.

Broader estate-role permissions are follow-up work. Estate and location reads
already support members. Asset details, assessment history and device-list reads
still require ownership; this feature does not claim those permissions are built.
ID-94 concerns custom roles; the exact follow-up ticket for shared asset reads
has not been assigned. The original Jira wording included asset access and must
be interpreted alongside this clarified invitation scope.

## Agreed behavior

- The owner or a member with `canInviteMembers` can invite by email only.
  WorkOS owns profile names; invitations never create a second display name.
- Only the owner grants or revokes invitation permission. Delegates cannot
  delegate onward, cancel invitations or remove members.
- Membership and invitation permission are per estate. Accepting preserves
  existing grants and roles. New Council grants have invitation permission off.
- New accounts receive a WorkOS email/signup invitation. `user_already_exists`
  selects in-app acceptance, with no email claim. Other provider errors remain
  failures; a failed SENDING attempt can be retried with its original delivery key.
- Verified matching recipients can explicitly accept unexpired IN_APP or
  PENDING invitations on My estates. Listing or ordinary sign-in never accepts
  an invitation. WorkOS-accepted email invitations can be reconciled automatically.
- Invitations expire after seven days. Explicit acceptance checks current local
  expiry. Provider acceptance must occur before provider expiry and after local
  creation; reconciliation may happen later.
- Revoking invitation permission blocks future invitations, preserving those
  already sent. An already-authorized dispatch may finish after revocation.
- Removing a member deletes their estate grant/delegation and cancels outstanding
  invitations addressed to them or sent by them in that estate. Previously
  accepted recipients keep their independent memberships.
- Owners can cancel individual invitations and remove members on inactive
  estates too. Owner self-removal is rejected. Confirmation dialogs state the
  estate-only effect and cancellation of the removed member's pending invitations.
- Cancellation blocks estate access even when an old WorkOS email still opens
  signup/the app. Cancelling an accepted invitation is rejected; remove the
  member instead. Repeated cancellation of the same current ID is idempotent.
- Re-inviting after cancellation or member removal creates a fresh invitation
  ID in the same estate/email slot. Old IDs/callbacks cannot activate the new
  attempt. Current members and outstanding invitations reject duplicates;
  cancel expired pending invitations before inviting again.
- Inactive estates reject new invitations and activation. Acceptance checks that
  the inviter remains the owner or an estate member. Concurrent activation does
  not duplicate membership; removal/cancellation cannot revive consumed access.
- Forms retain input on failure and prevent duplicate pending submissions.
  Failed permission updates retain the saved value. Acceptance refreshes estate
  access and the recipient invitation list. Other browsers refetch to see changes;
  server authorization applies immediately to subsequent requests.

## Implementation and documentation

`EstateUser` stores role and invitation permission. `EstateInvitation` stores the
current attempt, not an immutable audit history: SENDING, PENDING, IN_APP,
ACCEPTED or CANCELLED. No plaintext setup token or local user profile is stored.
The enum review refactor centralizes these five states and acceptance/outstanding
rules in `CouncilInvitationStatus`. Only IN_APP/PENDING are acceptable; SENDING
is outstanding but not acceptable, and ACCEPTED/CANCELLED are terminal for the
current attempt. Unrecognized stored states remain ineligible. Persisted and API
status strings keep their existing values; this refactor needs no migration.
The legacy non-null name column remains compatible with the applied migration;
new attempts write an empty value and the invitation API/UI never uses it.

Prisma owns schema changes; the initial migration and generated jOOQ sources are
included. Later invitation refinements require no additional migration/reset.
API types are generated from Spring. The configured export plugin was unavailable
offline, so the real `/v3/api-docs` output and `@proj/api:openapi:types` target were
used without installing dependencies.

- [API contract and lifecycle](../../.docs/api/council-invitations.md): nine
  endpoints, DTOs, errors, locking rules and WorkOS configuration.
- [Frontend](../../.docs/frontend/council-invitations.md): routes, components,
  hooks, query keys and invalidations.
- [ADR 0020](../decisions/0020-council-invitations-are-estate-scoped.md): original
  estate scoping and delegation.
- [ADR 0021](../decisions/0021-existing-accounts-use-in-app-invitations.md):
  existing-account in-app delivery.
- [ADR 0022](../decisions/0022-owners-can-cancel-invitations-and-remove-members.md):
  cancellation/removal and concurrency.
- [ADR 0023](../decisions/0023-reconcile-old-invitations-and-allow-reinvitation.md):
  older pending invitations and fresh attempts.
- [ADR 0024](../decisions/0024-invitation-permission-revocation-affects-future-invites.md):
  permission revocation versus member removal.

ADRs retain historical decisions and link to their successors; current behavior
is stated above and in `.docs/` rather than repeated as chronological amendments.

## Verification

TDD failures were observed for the implemented behavior changes. The recorded
workspace suite passed, including 170 Java tests, type checks and formatting.
Tests use mocked WorkOS responses and isolated migrated Testcontainers PostgreSQL;
automated tests do not send real emails.

Server coverage: `CouncilControllerTests`, `CouncilIntegrationTests`,
`workos/CouncilIdentityTests`, and location authorization tests. Web coverage:
Council form/access controls, pending invitations, acceptance refresh/retry,
estate/location screens, and PKCE-preserving invitation sign-in forwarding.
Boundaries include expiry, wrong/unverified recipients, duplicates, provider
failure/retry, concurrency, revocation/removal, fresh invitation IDs and preserved
other-estate access.

Enum review verification (2026-10-08): the new rule tests first failed because
the enum was missing, then passed after implementation. Twelve rule cases and
six HTTP/database cases cover all five local states plus an unrecognized value.
`pnpm test` passed with 188 Java tests; workspace type checks and formatting
also passed. No schema, controller or generated API changes were needed.

User-confirmed live checks on 2026-10-06:

- New-account email and existing-account invitation flows work.
- Previously sent invitations remain usable after invite permission is revoked.
- Removing the inviter prevents estate access through their old email; the email
  can still open authentication/the app as expected.

Not every manual edge case was separately confirmed. Implementation branch:
`feat/council-invitation`. Merge and deployment are separate delivery steps.

## Limitations and follow-up

- Broader estate-role permissions and shared asset-record access, as noted above.
- Bulk invitations, ownership transfer, dedicated resend/decline UI and a
  permanent invitation-attempt audit trail are outside this feature.
- Existing accounts discover invitations on My estates; there is no separate
  email service or notification email for that flow.
