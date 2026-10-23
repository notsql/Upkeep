# Estate invitations and member roles

## Routes and components

`/estates/$estateId/council` retains its URL and now presents Estate members.
Its index.tsx and route-local -components folder contain CouncilPage,
access-controls and access-confirmation. Managers see all four invitation roles,
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
After the pending-invitations query succeeds with an empty list, this page shows
a shadcn Empty panel headed "No pending invitations" with explanatory text.
It stays hidden during loading or errors; failures keep the retry action instead.
The shared summary on the Estates page still hides an empty list.

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
| useOutstandingInvitations | GET estate invitations | userId, estate-invitations, estateId; mounted for Managers |
| useCouncilInvitation | POST estate invitations | Sends email/role; invalidates outstanding offers |
| useCancelCouncilInvitation | DELETE invitation ID | Invalidates outstanding offers |
| useRemoveEstateMember | DELETE member ID | Invalidates roster/offers/estate lists/access/resident context |
| useUpdateEstateRole | PUT member role | Invalidates current-user queries, including roles/access/estates |
| useTransferOwnership | POST ownership-transfer | Invalidates current-user queries and owner controls |
| usePendingCouncilInvitations | GET /council-invitations | userId, council-invitations; session gated |
| useAcceptInAppInvitation | POST invitation ID accept | Awaits pending/estate/access/resident-context invalidation |
| useAcceptCouncilInvitations | POST /council-invitations/accept | On activation refreshes pending/estate/access/resident context |

The legacy useInvitationPermission hook is removed. Identity changes clear the
previous user's cache. Spring rechecks authority independently of stale UI.
