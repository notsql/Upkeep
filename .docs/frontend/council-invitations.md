# Estate invitations and member roles

## Routes and components

`/estates/$estateId/council` retains its URL and now presents Estate members.
Its index.tsx and route-local -components folder contain CouncilPage,
access-controls and access-confirmation. Managers see the four preset invitation roles and eligible custom roles,
member roles, cancellation and removal. Shadcn Button, Card, Label, Input, Select,
Badge and Dialog supply the controls. Delegation checkboxes are removed.

The email/role form disables duplicate submissions and retains input/role on
failure. IN_APP confirmation says no email was sent and directs recipients to
Invitations. Role edits retain saved state on failure. Manager self-removal and
self-demotion controls are hidden. Owners must transfer before removal/demotion;
only the owner can transfer, to another existing Manager, with confirmation.
Transfer refreshes ownership and capabilities. Removal/cancellation dialogs retain
errors and explain their estate-only effects and pending-invitation cancellation.

`/invitations` is `apps/web/src/routes/_auth/invitations/index.tsx`. Every signed-in
identity can enter, including unassigned, Resident-only and Crew-only accounts.
The auth guard checks identity without requiring workspace access. Desktop/mobile
navigation includes Invitations. WorkOS invitation sign-in returns here with
PKCE/state preserved. Existing estate/home invitation summaries remain.

Shared pending/acceptance components remain in estates/-components. Pending cards
show estate, offered role and expiry; Accept is explicit. Loading never explicitly
accepts. Failures retain the offer and permit retry. The separate email component
reconciles only provider-accepted invitations once per mounted user, with Retry.
Resident acceptance works with the estate selector in [resident-reports.md](resident-reports.md).
Crew report screens and report-location editing remain separate work.

## Hooks and cache

All requests use generated DTOs/client in apps/web/src/lib/council-invitations.ts.

| Hook | Endpoint | Query key / invalidation |
| --- | --- | --- |
| useEstateMembers | GET estate members | userId, estate-members, estateId; capability/session gated |
| useOutstandingInvitations | GET estate invitations | userId, estate-invitations, estateId; mounted for Managers and delegated inviters (own offers) |
| useCouncilInvitation | POST estate invitations | Sends the chosen selector; invalidates outstanding offers; failure refreshes choices |
| useCancelCouncilInvitation | DELETE invitation ID | Invalidates outstanding offers |
| useRemoveEstateMember | DELETE member ID | Invalidates roster/offers/estate lists/access/resident context |
| useUpdateEstateRole | PUT member role | Invalidates current-user queries, including roles/access/estates |
| useTransferOwnership | POST ownership-transfer | Invalidates current-user queries and owner controls |
| usePendingCouncilInvitations | GET /council-invitations | userId, council-invitations; session gated |
| useAcceptInAppInvitation | POST invitation ID accept | Awaits pending/estate/access/resident-context invalidation |
| useAcceptCouncilInvitations | POST /council-invitations/accept | On activation refreshes pending/estate/access/resident context |

The legacy useInvitationPermission hook is removed. Identity changes clear the
previous user's cache. Spring rechecks authority independently of stale UI.

## Custom roles and access resolution

CouncilPage waits for `/access/context` before mounting invitation controls.
Loading/error states never show forms; errors offer Retry access. A custom
INVITE_MEMBERS-only caller enters the same council route without requesting
estate details or the member roster. The outstanding list shows only their own
offers, as filtered by the server; Managers see all estate offers. Outstanding
invitation cards show the email, role name, delivery status, expiry and cancel
action, without permission labels or descriptions. Inactive
estates retain the list and roster but disable sending and member reassignment.

Route-local `invitation-form.tsx`, `role-picker.tsx` and `member-permission.tsx`
use generated DTOs. `useEstateInvitationRoles` reads
GET `/estates/{estateId}/invitation-roles`, key
`[userId, "estate-invitation-roles", estateId]`, gated by resolved invitation
capability. The form waits for choices, shows loading/error Retry/empty states,
shows role names without permission labels/descriptions and sends the exact customRoleId
and expectedRoleVersion. The default is Council member when offered by the server,
otherwise the first eligible role. Empty choices leave no selected role and disable
sending. A manual selection is preserved across refreshes; if it becomes unavailable,
sending is disabled until another eligible role is selected. Failed sends preserve email/selection and refresh
choices. Preset choices remain for Managers; custom delegates receive only
eligible custom definitions, with no client preset fallback.

Manager member controls combine the four presets with GET roles and catalogue
through `lib/estate-roles.ts`. Custom assignment/conversion opens confirmation
with only "[email]. Assign [role]. The new role replaces the previous role and
its permissions." Permission labels/descriptions are omitted. Resident conversion
to a preset role explains that new submissions stop while past own reports remain
readable. Save uses the currently reviewed
version; failure preserves the previous assignment. Self/owner safeguards remain.

Recipient pending cards show custom role name and expiry without permission
labels or descriptions. Accept sends only expectedRoleVersion with the offer ID; no role
selector override. On409/404, `useAcceptInAppInvitation` refreshes recipient offers
and reports the error, then waits for another explicit click. It never silently
retries acceptance. Successful acceptance refreshes pending offers, estate lists,
access and resident context. Definition edits/deletion invalidate current-user
role/roster/offer/access queries; see [estate-roles.md](estate-roles.md).
