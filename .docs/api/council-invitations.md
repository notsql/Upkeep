# Council invitations and delegation

Source of truth: `packages/api/openapi.json`. Spring owns estate authorization
and persistence; WorkOS owns identities and new-account invitation emails.
Organization roles are never changed by these endpoints.

## Endpoints

All endpoints require a signed-in JWT subject, including when the development
resource-server configuration is disabled. The signed-in subject determines
permissions; request bodies cannot select a role or inviter.

| Method | Path | Request | Success | Authorization |
| --- | --- | --- | --- | --- |
| POST | `/estates/{estateId}/council-invitations` | `CouncilInvitationRequest` | 201 `CouncilInvitationResponse` | Estate owner or estate member with `canInviteMembers` |
| GET | `/estates/{estateId}/council-invitations` | none | 200 `CouncilInvitationResponse[]` | Estate owner |
| DELETE | `/estates/{estateId}/council-invitations/{invitationId}` | none | 204, no body | Estate owner |
| DELETE | `/estates/{estateId}/members/{userId}` | none | 204, no body | Estate owner; cannot remove owner |
| GET | `/estates/{estateId}/members` | none | 200 `EstateMemberResponse[]` | Estate owner |
| PUT | `/estates/{estateId}/members/{userId}/invitation-permission` | `InvitationPermissionRequest` | 204, no body | Estate owner |
| GET | `/council-invitations` | none | 200 `PendingCouncilInvitationResponse[]` | Signed-in user with verified matching WorkOS email |
| POST | `/council-invitations/{invitationId}/accept` | none | 200 `AcceptedInvitationsResponse` | Verified recipient explicitly accepting that in-app invitation |
| POST | `/council-invitations/accept` | none | 200 `AcceptedInvitationsResponse` | Signed-in recipient; server verifies WorkOS identity and acceptance |

`estateId` and `invitationId` are UUIDs; `userId` is the existing member's WorkOS user ID. Owners
are implicit members and are not added to the list unless an explicit grant
exists. Names and emails in the member list come from WorkOS.

## DTOs

- `CouncilInvitationRequest`: `email: string` (trimmed, lowercased, valid email, nonblank, max 254).
- `CouncilInvitationResponse`: `id: UUID`, `estateId: UUID`, `email: string`, `status: string` (`SENDING`, `PENDING` for email, `IN_APP` for existing
  accounts), `expiresAt: ISO datetime | null` (null before dispatch finalization).
  No invitation token or setup link is returned to the inviter.
- `EstateMemberResponse`: `userId: string`, `name: string`, `email: string`,
  `canInviteMembers: boolean`.
- `InvitationPermissionRequest`: `canInviteMembers: boolean` (required;
  null is invalid). Updating the same value is idempotent.
- `AcceptedInvitationsResponse`: `estateIds: UUID[]`, containing only estates
  activated in this call. The email reconciliation endpoint can return an empty
  list; successful explicit in-app acceptance returns one estate ID.
- `PendingCouncilInvitationResponse`: `id: UUID`, `estateId: UUID`,
  `estateName: string`, `expiresAt: ISO datetime`.
- Errors: `EstateError { message: string }` for controller/advice errors.
  Security-filter 401 responses may have no JSON body.

Example invitation:

```http
POST /estates/4c05c636-496e-43f5-bdd8-0751d82e95a7/council-invitations
Authorization: Bearer <token>
Content-Type: application/json

{"email":"alice@example.com"}
```

```json
{"id":"7c4b1311-83de-4cc4-9532-0ddafbe9c067","estateId":"4c05c636-496e-43f5-bdd8-0751d82e95a7","email":"alice@example.com","status":"PENDING","expiresAt":"2026-10-12T08:00:00Z"}
```

Example delegation: PUT the member permission endpoint with
`{"canInviteMembers":true}`. Only the estate owner can do this. A delegate
cannot pass invitation permission onward or acquire asset-write access.

## Errors and lifecycle

- 400: invalid input, malformed UUID/body, missing/null permission.
- 401: no valid signed-in identity.
- 403: missing invitation/owner permission, or unverified/mismatched WorkOS
  identity for in-app listing/acceptance.
- 404: inaccessible/missing estate or member; invitation belongs to another
  recipient or is missing (including an ID replaced by a fresh invitation).
- 409: inactive estate, already a member (including owner), duplicate invitation,
  unavailable in-app acceptance (expired, consumed, or inviter removed),
  owner self-removal, cancelling an accepted invitation, or dispatch finalization
  after another request changed the invitation.
- 502: WorkOS failure or malformed provider invitation.
- 503: missing WorkOS configuration.

An invitation reserves a unique `(estateId, normalized email)` row before
contacting WorkOS. `SENDING` retries reuse its UUID as the provider idempotency
key and retain the original inviter/payload; email dispatch success moves it to
`PENDING`. A delivery error does not activate membership. WorkOS emails use a
seven-day expiry. Provider acceptance of dispatch is not proof of email delivery.

WorkOS `user_already_exists` during send is handled as an in-app invitation:
`IN_APP`, no provider ID, seven-day expiry, no email. The failed SENDING row can
be retried normally into this state. Other WorkOS errors remain failures.
GET `/council-invitations` lists that verified recipient's unexpired IN_APP and PENDING
rows on active estates. Listing never grants access. POST to the UUID-specific
accept endpoint activates only that invitation; state and expiry are checked
under the invitation lock. Replayed acceptance returns 409. No separate invitation token is needed:
the authenticated WorkOS identity and verified matching email authorize it.

Example: GET `/council-invitations` returns
`[{"id":"7c4b1311-83de-4cc4-9532-0ddafbe9c067","estateId":"4c05c636-496e-43f5-bdd8-0751d82e95a7","estateName":"Maple Grove","expiresAt":"2026-10-12T08:00:00Z"}]`.
POST `/council-invitations/7c4b1311-83de-4cc4-9532-0ddafbe9c067/accept`
returns `{"estateIds":["4c05c636-496e-43f5-bdd8-0751d82e95a7"]}`.
Both require a bearer token; POST has no request body.

The existing email acceptance sweep excludes IN_APP rows.
Email acceptance reads the recipient's identity directly from WorkOS, requires a
verified matching email, then reads each matching local pending invitation by
its provider ID. Only accepted invitations with the same accepted user ID,
matching email/ID, and acceptance between local creation and provider expiry
can activate. An invitation accepted on time can be reconciled later. Pending,
late-accepted, mismatched, or unverified cases return no activation.

Activation locks the invitation and estate in a transaction, rejects inactive
estates or an inviter who is no longer the owner or a member, inserts Council membership
with invitation permission false, and marks the invitation accepted. Revoking invitation
permission alone preserves previously sent invitations. Existing
grants and roles remain unchanged. Members can browse the
[location hierarchy](locations.md); location writes remain owner-only.
Broader estate-role permissions are follow-up work: asset details, assessment
history and device-list reads still
require ownership in their services. Council membership does not yet grant
those reads.
Concurrent/repeated activation does not
duplicate membership. Deleting an estate grant deletes its delegated permission.

## Owner cancellation and member removal

The owner list returns SENDING/PENDING/IN_APP rows for this estate, including
expired invitations. It omits accepted/cancelled rows and does not resolve
recipient profiles through WorkOS. Example GET
`/estates/{estateId}/council-invitations` returns an array of the invitation DTO
shown above; a failed dispatch can have `status: "SENDING", expiresAt: null`.

DELETE `/estates/{estateId}/council-invitations/{invitationId}` takes no body and
returns 204. Pending invitations become CANCELLED, and repeating cancellation
returns 204. Missing/cross-estate IDs return 404; accepted rows return 409.
Cancellation remains available on inactive estates. It prevents local estate
activation even if an already-sent WorkOS email still permits registration.
A provider response cannot revive a row cancelled during dispatch.

DELETE `/estates/{estateId}/members/{userId}` takes no body and returns 204.
The owner cannot remove themselves (409); a missing member returns 404.
WorkOS supplies the member's current email, then a transaction locks invitation
rows and the estate, removes that grant/delegation, and cancels outstanding
invitations for that email or sent by that member in this estate. Existing
accepted rows remain consumed; their recipients keep their own memberships. No account,
organization role, other-estate grant or estate record is deleted. Provider
lookup failure leaves membership unchanged. Concurrent acceptance cannot restore
the removed grant from an already-pending invitation.

These endpoints require owner authority, including on inactive estates. A
delegate receives 403; an unrelated caller receives 404. Subsequent API calls
check current access; another browser's previously rendered content may remain
until it refetches.

Re-inviting a cancelled address, or an accepted recipient after member removal,
reuses the estate/email slot with a fresh UUID, inviter and creation time;
old provider and acceptance metadata are cleared. Old IDs and provider callbacks
cannot activate or finalize the replacement. Current memberships and outstanding
invitations still return 409. Cancel an expired pending invitation before inviting
again. Failed SENDING dispatches can be retried with their current delivery key.
No manual deletion or migration is needed for older test invitations; the row
represents the current attempt, not a permanent invitation audit history.

## Estate response extension

`EstateResponse` from the existing estate endpoints now includes
`canInviteMembers: boolean` and `canManageInvitationPermissions: boolean`.
The first is true only for an active estate's owner or delegated member; the
second is true only for its owner. These booleans guide UI visibility; every
write independently checks current server-side permissions.

## Configuration and verification

Use the existing server `WORKOS_API_KEY`; no new secret is introduced. In the
WorkOS application's **Redirects**, set the **User invitation URL** to the web
app's `/api/auth/sign-in` (locally `http://localhost:3001/api/auth/sign-in`).
Keep WorkOS invitation email delivery enabled. This route preserves PKCE,
forwards `invitation_token` to hosted authentication, and returns invitees to
`/estates`; that screen calls the acceptance endpoint. Existing account roles
are preserved because invitations contain neither organization ID nor role.

Invitations use email only. WorkOS is the source of the accepted user's
identity/name; inviting never sets or renames a profile. The legacy database
name column remains for compatibility but is not exposed or read for invitations;
new attempts store an empty value.
No real invitation emails are sent by automated tests.

Unhandled WorkOS failures retain the generic `WorkOS request failed` response. The
server logs the provider HTTP status, error code, and request ID for diagnosis;
it does not log the raw provider response or exception message.

## Design references

[ADR 0020](../../.spec/decisions/0020-council-invitations-are-estate-scoped.md)
records estate scoping and delegation;
[ADR 0021](../../.spec/decisions/0021-existing-accounts-use-in-app-invitations.md)
records the existing-account delivery decision and its tradeoff;
[ADR 0022](../../.spec/decisions/0022-owners-can-cancel-invitations-and-remove-members.md)
records owner cancellation/removal and its concurrency rules;
[ADR 0023](../../.spec/decisions/0023-reconcile-old-invitations-and-allow-reinvitation.md)
records compatibility with older invitations and fresh invitation attempts.

[ADR 0024](../../.spec/decisions/0024-invitation-permission-revocation-affects-future-invites.md)
records permission revocation versus removal and explicit cancellation.
