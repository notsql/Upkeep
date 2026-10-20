# Estate invitations, roles and ownership

Source of truth: `packages/api/openapi.json`. Existing Council URLs are retained.
Current Neon membership/ownership supplies authority; WorkOS supplies identities,
verified email and invitation delivery. Organization roles are never assigned.

## Endpoints

Every endpoint requires a real JWT subject, including local development. Manager
means MANAGER in the target estate; existing owners retain ownership-derived
Manager authority. Non-manager members receive 403; unrelated estates return 404.

| Method | Path | Request | Success / authority |
| --- | --- | --- | --- |
| POST | `/estates/{estateId}/council-invitations` | CouncilInvitationRequest | 201 CouncilInvitationResponse; Manager, active estate |
| GET | `/estates/{estateId}/council-invitations` | None | 200 CouncilInvitationResponse[]; Manager |
| DELETE | `/estates/{estateId}/council-invitations/{invitationId}` | None | 204; Manager; cancellation is idempotent |
| GET | `/estates/{estateId}/members` | None | 200 EstateMemberResponse[]; Manager, all roles and owner |
| PUT | `/estates/{estateId}/members/{userId}/role` | UpdateEstateRoleRequest | 200 EstateMemberResponse; Manager, ownership/self-demotion guards |
| DELETE | `/estates/{estateId}/members/{userId}` | None | 204; another Manager, ownership guards |
| POST | `/estates/{estateId}/ownership-transfer` | TransferOwnershipRequest | 200 EstateResponse; current owner only |
| GET | `/council-invitations` | None | 200 PendingCouncilInvitationResponse[]; verified matching recipient |
| POST | `/council-invitations/{invitationId}/accept` | None | 200 AcceptedInvitationsResponse; explicit verified recipient acceptance |
| POST | `/council-invitations/accept` | None | 200 AcceptedInvitationsResponse; provider-verified recipient acceptance |

estateId/invitationId are UUIDs. userId/newOwnerUserId are WorkOS subjects.
The legacy member `/invitation-permission` PUT is retired and returns 403.
Its contract remains in OpenAPI for compatibility.

## DTOs

| DTO | Fields |
| --- | --- |
| CouncilInvitationRequest | email: string (trimmed/lowercased, valid/nonblank, max 254), role?: EstateRole |
| CouncilInvitationResponse | id: UUID, estateId: UUID, email: string, status: string, expiresAt: datetime or null, role: EstateRole |
| PendingCouncilInvitationResponse | id: UUID, estateId: UUID, estateName: string, expiresAt: datetime, role: EstateRole |
| EstateMemberResponse | userId/name/email: string, role: EstateRole or legacy MEMBER, owner: boolean, canInviteMembers: boolean |
| UpdateEstateRoleRequest | role: EstateRole, required/non-null |
| TransferOwnershipRequest | newOwnerUserId: string, nonblank, max 255 |
| AcceptedInvitationsResponse | estateIds: UUID[], activated in this call |
| EstateResponse | id: UUID; name/code/address/postalCode: string; description: string or null; createdAt/updatedAt: datetime; deactivatedAt: datetime or null; owned/canInviteMembers/canManageInvitationPermissions: boolean |
| EstateError | message: string |

EstateRole contains MANAGER, COUNCIL, RESIDENT and CREW. Manager/Admin is one
choice, sent as MANAGER. Omitted invitation role defaults to COUNCIL; explicit
null, OWNER, ADMIN, MEMBER and unknown values return 400. Ownership is separate.
Member names/emails come from WorkOS. The owner appears even without a legacy
explicit membership. canInviteMembers is derived from MANAGER, never delegation.

Example: POST an email with role CREW. The 201 response includes CREW and PENDING
(email) or IN_APP (existing account). Sending grants no membership. GET pending
offers includes estate, role and expiry. POST the offer ID with no body activates
exactly its stored role and returns the activated estate ID.

## Lifecycle and safeguards

One current slot exists per estate/normalized email across roles. Persist the
selected role before dispatch. SENDING retries retain UUID, role, sender and
payload. Changing sender/role returns 409; cancel before replacing an offer.
Cancelled attempts, and accepted attempts after removal, can be replaced with
a fresh UUID and cleared provider metadata. Old callbacks cannot activate or
finalize a replacement. Old invitation rows backfill to COUNCIL.

WorkOS sends new-account email invitations with seven-day expiry. Only its
user_already_exists rejection falls back to IN_APP, seven-day expiry and no email.
Other errors preserve SENDING for retry. Listing never grants access. Explicit
acceptance admits PENDING/IN_APP only, verifies matching email and identity,
checks expiry and returns 409 on replay. Automatic email reconciliation excludes
IN_APP and verifies provider ID, accepted user, email and acceptance time.

Activation locks invitation then estate, requires an active estate and current
inviter Manager authority, inserts the stored role and consumes the offer. An
existing target-estate membership, including an identical role, causes explicit
409; provider reconciliation leaves it untouched. Other-estate memberships stay
intact. Residents can accept multiple estates.

Manager removal/demotion cancels outstanding invitations they sent. Removal also
cancels invitations addressed to their current profile email. Accepted recipients
retain independent memberships. Dispatch finalization cannot overwrite cancellation.
Writes recheck current authority using the invitation-before-estate lock order.

Managers cannot remove/demote themselves. Another same-estate Manager can do so;
the current owner must transfer first. Transfer requires a different existing
MANAGER in that estate, never creates/promotes the recipient, and atomically
changes ownerUserId while retaining both Manager memberships. New estate creation
atomically records ownership and MANAGER membership. Inactive estates permit
member administration/cancellation, but reject new offers and activation.

The former owner retains estate-detail editing through their MANAGER membership.
Only the new current owner may deactivate or transfer ownership again; Manager
membership alone never grants either action. See [estates.md](estates.md).

400 invalid input/role/UUID; 401 missing identity; 403 insufficient authority,
unverified identity or retired delegation; 404 inaccessible/missing resource;
409 duplicate/existing membership, inactive/expired/consumed offer, changed retry,
self-removal/demotion, protected owner or ineligible transfer; 502 provider failure;
503 missing provider configuration or access storage unavailable. Cancelled emails may still permit account
registration, never estate activation.

EstateResponse retains canInviteMembers (active Manager) and the legacy name
canManageInvitationPermissions (Manager member/role administration). No account
is reclassified. Asset editing and staff report/location APIs are separate work.
Configure WorkOS User invitation URL as `/api/auth/sign-in`; AuthKit preserves
PKCE/state and returns to `/invitations`. Tests never send real invitation emails.
See [ADR 0028](../../.spec/decisions/0028-estate-role-invitations.md).
