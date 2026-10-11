# Council members (frontend)

## Routes and screens

- `/estates/$estateId/council`:
  `apps/web/src/routes/_auth/estates/$estateId/council/index.tsx`, under the
  signed-in `_auth` guard. `CouncilPage` and its form/permission components live
  in the adjacent `-components/council-page.tsx`.
- Estate details links to **Council members** when the API says the caller can
  invite or manage invitation permissions. This does not require the admin role.
- Owners see an invitation form and members with **Can invite members for
  {name}** checkboxes. Delegates see only the form. Other members see a permission
  message. Inactive estates disable invitations while owners can still manage
  delegated permissions.
- Form: required email, length/email validation, pending button and disabled
  inputs, error with retained input, successful invitation confirmation.
  IN_APP success directs the inviter to tell the recipient to open Estates
  and explicitly states no email was sent.
  Permission controls retain the saved state when an update fails.
- Owners also see pending invitations and member-removal controls. Both actions
  require a shadcn Dialog showing the email and estate-only effect. Controls
  remain available for inactive estates; owner self-removal is hidden.
- Uses shared shadcn Button, Card, Checkbox, Dialog, Input, and Label components.
  Permission checkboxes have explicit labelled IDs; the route is keyed by estate.

## Data hooks

All new calls live in `apps/web/src/lib/council-invitations.ts` and use the
OpenAPI-generated client and DTOs.

| Hook | Endpoint | Query key / invalidation |
| --- | --- | --- |
| `useOutstandingInvitations` | GET `/estates/{estateId}/council-invitations` | `[userId, "estate-invitations", estateId]`; mounted only for owners, session-gated |
| `useCancelCouncilInvitation` | DELETE `/estates/{estateId}/council-invitations/{invitationId}` | Invalidates outstanding invitations |
| `useRemoveEstateMember` | DELETE `/estates/{estateId}/members/{userId}` | Invalidates members, outstanding invitations, and `["estates", userId]` |
| `useEstateMembers` | GET `/estates/{estateId}/members` | `[userId, "estate-members", estateId]`; enabled only for signed-in owners |
| `useCouncilInvitation` | POST `/estates/{estateId}/council-invitations` | Mutation; sends email; invalidates `[userId, "estate-invitations", estateId]` |
| `useInvitationPermission` | PUT `/estates/{estateId}/members/{userId}/invitation-permission` | Invalidates member list and existing `["estates", userId, "details", estateId]` |
| `usePendingCouncilInvitations` | GET `/council-invitations` | `[userId, "council-invitations"]`; session-gated |
| `useAcceptInAppInvitation` | POST `/council-invitations/{invitationId}/accept` | Invalidates pending invitations and `["estates", userId]` on success |
| `useAcceptCouncilInvitations` | POST `/council-invitations/accept` | On activation invalidates `[userId, "council-invitations"]` and `["estates", userId]`, including switcher |

`CouncilPage` also uses the existing `useEstate` hook for caller capabilities.
Errors use `estateError`; query failures throw and are not treated as success.
Server permission checks handle stale UI after revocation in another session.

## Acceptance and sign-in

Email invitations use the [invitation sign-in handler](auth.md#routes), preserving
AuthKit PKCE/state and returning to `/estates`. The WorkOS User invitation URL
configuration is documented in the [API doc](../api/council-invitations.md).

`InvitationAcceptance` sits in the estate list's `-components/` folder and mounts
on **Estates**. Once the browser token bridge/session is ready, it checks
accepted email invitations once per mounted user through a mutation. It shows an
activation confirmation or an error with **Retry invitations**; existing estates
remain usable if verification fails. It does not grant access from URL claims:
Spring verifies the WorkOS acceptance and recipient identity.

`PendingInvitations` lives beside `InvitationAcceptance` and also mounts on Estates. It lists unexpired IN_APP and PENDING email invitations for the verified recipient
in a shadcn Card with estate name,
expiry and a labelled Accept button. It never accepts during loading or sign-in.
Buttons disable during acceptance, errors remain beside the invitation, and
success refreshes both the invitation list and estate access. Listing failures
have a retry action. The email reconciliation component remains separate.

## Tests

Tests cover the form, owner/delegate visibility, saved permission on errors,
duplicate-submit prevention, estate navigation, invitation refresh/retry, and
PKCE-preserving invitation-token forwarding. Provider emails are mocked. Explicit in-app acceptance and failure retention are also covered.

## Owner access controls

`access-controls.tsx` beside `council-page.tsx` contains `OwnerInvitations`,
`OutstandingInvitation` and `RemoveMemberButton`. Outstanding rows show
email, delivery mode and expiry when available. Each action opens the shared
route-local `access-confirmation.tsx`. Cancel/keep controls show distinct labels;
confirmation disables buttons and closing while pending, retains errors on
failure, and closes after success. The cancellation description makes clear
that an email already sent may still allow account registration. Member removal
explains that outstanding invitations sent by the member are cancelled, while
already accepted recipients retain their memberships. Turning off invitation
permission alone preserves previously sent invitations.

The UI invalidates the owner's queries; it does not remotely clear the removed
recipient's browser cache. Server authorization denies subsequent requests.
Tests cover owner/delegate visibility, email confirmation, keeping an invitation,
successful list refresh and retained failure dialogs.

## Verification and remaining scope

On 2026-10-06, the user confirmed both invitation delivery/acceptance flows,
acceptance after invitation-permission revocation, and no estate access through
an old email after inviter removal. Automated tests cover the other documented
boundaries. The legacy invitation name field is absent from the form and API;
accepted member names come from WorkOS.

Council members can read estates and locations. Shared asset details, assessment
history and device lists remain blocked by owner-only server checks. They belong
to the broader estate-role permissions follow-up, outside this invitation scope.

## Dashboard presentation

CouncilPage uses shared PageHeader with Estates / estate / Council members
breadcrumbs and themed shadcn Cards. Invitation, pending-invitation and member
access sections remain distinct. Invite/pending cards use two columns on large screens; email and Send invitation
share a row where space allows. Member permissions use bordered responsive cards
with wrapping email/actions and Saving invitation permission/Permission saved
status feedback. Outstanding invitations are compact cards with delivery/expiry. The shell's Council link follows the same API
capabilities as the estate-details link; it never grants an admin role. Acceptance
and in-app delivery guidance use the label Estates. All hooks, owner/delegate
checks and access confirmations above are unchanged. See
[design-system.md](design-system.md).
