# Estate invitations, member roles and ownership

Source of truth: `packages/api/openapi.json`. Existing Council URLs are retained.
JWT subject supplies identity; current estate membership/ownership supplies
permission. WorkOS supplies verified profiles and invitation delivery, never
application role authority. See [estate-roles.md](estate-roles.md) for definitions.

## Endpoints

All require a real JWT subject, including local development. Manager means the
target estate's MANAGER or ownership-derived authority (Resident conflicts deny).
Estate/invitation/custom-role IDs are UUIDs; member IDs are WorkOS subjects.

| Method/path | Request | Success / authority |
| --- | --- | --- |
| POST `/estates/{estateId}/council-invitations` | CouncilInvitationRequest | 201 CouncilInvitationResponse; active estate, Manager or bounded custom INVITE_MEMBERS |
| GET `/estates/{estateId}/invitation-roles` | None | 200 EstateInvitationRoleOptionResponse[]; Manager gets presets/all custom definitions, delegated inviter gets only eligible custom subsets; private,no-store |
| GET `/estates/{estateId}/council-invitations` | None | 200 CouncilInvitationResponse[]; Manager gets estate offers, custom inviter gets own offers only, including while inactive |
| DELETE `/estates/{estateId}/council-invitations/{invitationId}` | None | 204; Manager or custom inviter cancelling own offer; idempotent |
| GET `/estates/{estateId}/members` | None | 200 EstateMemberResponse[]; Manager |
| PUT `/estates/{estateId}/members/{userId}/role` | UpdateEstateRoleRequest | 200 EstateMemberResponse; Manager, active estate including no-ops; owner/self safeguards |
| DELETE `/estates/{estateId}/members/{userId}` | None | 204; another Manager, owner safeguards; may remove while inactive |
| POST `/estates/{estateId}/ownership-transfer` | TransferOwnershipRequest | 200 EstateResponse; current owner to different existing same-estate Manager |
| GET `/council-invitations` | None | 200 PendingCouncilInvitationResponse[]; verified matching recipient |
| POST `/council-invitations/{invitationId}/accept` | Optional AcceptEstateInvitationRequest; required for CUSTOM | 200 AcceptedInvitationsResponse; explicit verified recipient |
| POST `/council-invitations/accept` | None | 200 AcceptedInvitationsResponse; provider-verified acceptance reconciliation |
| PUT `/estates/{estateId}/members/{userId}/invitation-permission` | InvitationPermissionRequest | Retired, 403; contract retained for compatibility |

## DTOs

| DTO | Fields |
| --- | --- |
| CouncilInvitationRequest | email: string (trimmed/lowercased, nonblank valid email, max 254), role?: EstateRole, customRoleId?: UUID or null, expectedRoleVersion?: int32 or null |
| UpdateEstateRoleRequest | role: EstateRole (required), customRoleId?: UUID or null, expectedRoleVersion?: int32 or null |
| AcceptEstateInvitationRequest | expectedRoleVersion: positive int32 (required) |
| CouncilInvitationResponse | id/estateId: UUID, email/status: string, expiresAt: datetime or null, role: EstateRole, plus CustomMetadata |
| PendingCouncilInvitationResponse | id/estateId: UUID, estateName: string, expiresAt: datetime, role: EstateRole, plus CustomMetadata |
| CustomMetadata | customRoleId: UUID or null, customRoleName: string or null, customRoleVersion: int32 or null, customPermissions: EstatePermissionResponse[] or null |
| EstateInvitationRoleOptionResponse | role: EstateRole, label: string, customRoleId: UUID or null, customRoleVersion: int32 or null, permissions: EstatePermissionResponse[] or null |
| EstateMemberResponse | userId/name/email: string, role: EstateRole or legacy MEMBER, owner/canInviteMembers: boolean, customRoleId: UUID or null, customRoleName: string or null |
| TransferOwnershipRequest | newOwnerUserId: nonblank string, max 255 |
| AcceptedInvitationsResponse | estateIds: UUID[], activated in this call |
| InvitationPermissionRequest | canInviteMembers: boolean, required |
| EstateResponse | See [estates.md](estates.md) |
| EstateError | message: string |

EstateRole: MANAGER, COUNCIL, RESIDENT, CREW, CUSTOM. Omitted invitation role
alone defaults to COUNCIL. Explicit null, ADMIN/OWNER/MEMBER/unknown codes or
ID-only selectors return 400. Preset selectors require absent/null custom fields.
CUSTOM requires both a same-estate definition UUID and positive
expectedRoleVersion. Foreign/missing roles return 404; stale versions return 409.
Member/pending summaries resolve current names/permissions/version, with null
custom fields for presets. EstatePermissionResponse is defined in
[estate-roles.md](estate-roles.md).

Custom INVITE_MEMBERS permits only CUSTOM targets wholly within the caller's
current permissions. It grants no roster, reassignment, removal or ownership
access. Other senders' invitations return 404 to delegated callers. Eligible-role
reads remain available while inactive, but sending is disabled. Definitions are
live: editing changes pending previews without cancelling offers.

Member summaries load estate ownership/activity once and custom-role grants in
bulk; mapping members performs no database queries. WorkOS profiles are still
resolved per member. Invitation-role options load definitions, grants and the
permission catalogue once per request. Outstanding and recipient invitation
lists bulk-load live definition metadata and grants, matching both role and
estate IDs, and reuse one catalogue read. These reads preserve ordering, preset
null metadata, delegated sender/subset filters and fail-closed grant validation;
their database round trips do not grow with the number of returned rows.

## Lifecycle, concurrency and safeguards

One slot per estate/normalized email spans all roles/statuses. Reservation stores
the selector before dispatch. SENDING retries retain UUID, selector, sender and
payload; changing those returns 409. Cancel before replacing a live offer.
Cancelled offers, or accepted offers after removal, can be replaced with a fresh
UUID and cleared provider metadata. Old links/callbacks cannot affect replacement.
WorkOS email offers expire after seven days. Only user_already_exists falls back
to IN_APP with seven-day expiry and no email; other errors preserve retry state.
Sending/listing never grants membership.

Explicit acceptance locks invitation then estate, verifies recipient email and
identity, PENDING/IN_APP status, expiry and active estate. CUSTOM additionally
requires the displayed version; missing version 400, stale 409. It inserts exactly
the stored selector and consumes the offer atomically. An existing same-estate
membership (even identical) causes 409. Refreshing a preview never auto-accepts.
Provider reconciliation excludes IN_APP, validates provider ID, accepted user,
email and acceptance time, and resolves the latest valid definition without
browser-version input. It never overwrites an existing membership.

Activation requires the inviter still to be a member or owner in the estate;
current INVITE_MEMBERS/subset authority is not re-required. Manager-to-CUSTOM
demotion therefore retains pending offers, even to a role above the inviter's
new set. Removal cancels their outstanding offers and offers addressed to their
current profile email. Other preset demotions retain cancellation. Recipients
already accepted keep independent memberships. Dispatch finalization cannot
revive cancelled/deleted offers. Role deletion removes all related invitation
history atomically and rejects old accept links/late callbacks.

All relevant writes recheck current authority with invitation-before-estate lock
order; multi-invitation operations restart if new rows appeared before the estate
lock. Role updates/permission changes serialize on the estate. Preset reassignment
clears customRoleId. Self-removal/demotion is protected; owner must transfer first.
Role reassignment resolves only the target member's WorkOS profile before writing;
an identity-provider failure leaves their existing role unchanged. The response
uses that profile and the target membership read inside the update transaction,
without loading the full roster or unrelated profiles.
Transfers never promote/create a recipient, preserve both Manager memberships,
and leave deactivation/ownership powers with the new owner. Inactive estates
retain roster reads/removal/cancellation, reject every reassignment (even no-op),
new invitations, role mutations and activation. Other-estate memberships remain.

400 invalid input/selectors/UUID; 401 missing identity; 403 insufficient authority,
unverified identity or retired delegation; 404 inaccessible/missing/foreign
resource; 409 stale version, existing membership/duplicate, inactive estate,
expired/consumed offer, changed retry, self/owner/ineligible transfer;
502 provider failure; 503 provider configuration or storage unavailable.

Example custom invite:

```json
{"email":"reviewer@example.com","role":"CUSTOM","customRoleId":"<role-uuid>","expectedRoleVersion":3}
```

POST to the estate invitation endpoint returns201 with CUSTOM and PENDING or
IN_APP. The recipient reads the pending preview and POSTs
`{"expectedRoleVersion":3}` to `/council-invitations/<offer-uuid>/accept`.
A preset invitation/acceptance retains the previous body/no-body contracts.
Configure WorkOS User invitation URL `/api/auth/sign-in`; AuthKit preserves
PKCE/state and returns to `/invitations`. Tests send no real email.
