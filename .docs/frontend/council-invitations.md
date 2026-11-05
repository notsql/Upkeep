# Estate invitations and member roles

## Routes and components

`/estates/$estateId/council` retains its URL and presents Estate members (the
"Members" sidebar item). Its index.tsx and route-local -components folder contain
CouncilPage, access-controls, access-confirmation, invitation-form,
member-filters, estate-members-table, member-permission and role-picker.

Layout, top to bottom:

- PageHeader: title ("Estate members" for Managers, "Estate invitations" for
  delegated inviters), one-line description, and a primary **Invite member**
  button (only when `canInviteMembers`). The button opens a shadcn Dialog
  titled "Invite member" that holds the email/role form; there is no inline
  form on the page.
- MemberFilters (Managers only): a shared `FilterBar` (search landmark
  "Filter members") with a `type="search"` Input "Search members"
  (name/email, also matches invitation email) and Select "Filter by role"
  (All roles, Owner, the presets and custom roles; `Field w-full sm:w-48`,
  trigger `w-full`). Filtering is client-side over the loaded roster and
  invitations and applies to both tabs; the API has no server-side filters.
- shadcn Tabs (Managers only), default **Members**: tab triggers "Members"
  and "Pending invitations", each with a count Badge (total loaded rows).
  Only the active panel is mounted.
- Members tab: card with heading "Members" and an "N active" Badge, then the
  paged Table (Name, Email, Role, Status, Actions). Role shows exactly one Badge:
  "Owner" (with the hint "Full Manager access plus ownership") for the estate
  owner, otherwise the preset label or custom role name. Status is always
  "Active" for members. Loading is `LoadingState` "Loading members…" (table);
  no roster is `EmptyState` "No members yet"; filters with no result show
  `EmptyState` "No matching members" with a "Clear filters" button.
- Pending invitations tab (and the whole page body for delegated inviters,
  without tabs or filters): card with heading plus "N pending" Badge; each row
  shows email, role Badge, delivery and expiry, and a **Revoke** button
  (accessible name "Cancel invitation for <email>") that confirms in a Dialog.
  Empty is `EmptyState` "No pending invitations"; filtered-out is "No matching
  invitations" with "Clear filters". There is no resend action because the API
  has no resend endpoint.
- The access check before render shows `LoadingState` "Loading estate access…".

Owner vs Manager: the API returns `role` (the estate membership role) and a
separate `owner` boolean (`Estate.ownerUserId`). The owner always holds a
MANAGER membership (creation and transfer both guarantee it), so the UI shows
"Owner" in place of the Manager label rather than both.

Managers see the four preset invitation roles and eligible custom roles,
member roles, cancellation and removal. Shadcn Button, Card, Label, Input, Select,
Badge, Table and Dialog supply the controls. Delegation checkboxes are removed.

The email/role form disables duplicate submissions and retains input/role on
failure. IN_APP confirmation says no email was sent and directs recipients to
Invitations. Role edits retain saved state on failure. Manager self-removal and
self-demotion controls are hidden. Owners must transfer before removal/demotion;
only the owner can transfer, to another existing Manager, with confirmation.
Transfer refreshes ownership and capabilities. Removal/cancellation dialogs retain
errors and explain their estate-only effects and pending-invitation cancellation.

There is no separate invitations screen. Pending invitations (all of them, not
truncated) render as Alert rows at the top of `/estates`, which every signed-in
identity can open, including unassigned, Resident-only and Crew-only accounts;
`/estates` also mounts `InvitationAcceptance`. `/invitations`
(`apps/web/src/routes/_auth/invitations/index.tsx`) is kept only as a
`beforeLoad` redirect to `/estates` so old links still land; there is no
Invitations navigation entry. WorkOS invitation sign-in
(`/api/auth/sign-in?invitation_token=...`) returns to `/estates` with PKCE/state
preserved. The home page summary links to `/estates` ("Review invitations").
The shared summary on the Estates page still hides an empty list.

Shared pending/acceptance components remain in estates/-components. Pending
offers render as a `<ul aria-label="Pending estate invitations">` of compact
shadcn Alert rows (MailOpen icon, subtle primary tint; "You're invited to <estate>", offered role and expiry) with an
inline AlertAction "Accept" button (accessible name "Accept invitation to
<estate>"); there is no decline, as the API has no decline endpoint. Accept is explicit. Loading never explicitly
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


## Member table and pagination

CouncilPage renders members in a shadcn Table captioned Estate members with
Name, Email, Role/Owner and Actions columns. Existing invitation forms, role
editing, removal/ownership confirmations, per-row pending/errors and self/owner
protections remain. Long text wraps; horizontal scrolling is confined to the
member table on small screens. No API or permission change accompanies this UI.

`estate-members-table.tsx` paginates the existing user-scoped member array at 20 rows,
with Previous/Next and an exact visible range/total. A shorter refreshed roster
clamps the current page. The table is keyed by estate and session user so
context changes reset pagination. Failed roster reads hide stale member rows.
The existing useEstateMembers endpoint/query key and mutation invalidations
remain as documented above.
`member-permission.tsx` renders each table row using the shared RolePicker,
including custom-role names/options and confirmation before custom/resident
conversions. Role selection retains definition IDs/versions. Reassignment is
disabled when the access projection or estate activity disallows it; existing
ownership/removal protections and confirmation dialogs remain in the Actions cell.

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

`RolePicker` always renders `SelectTrigger className="w-full"` (form, dialog
and member-table uses alike). It takes an optional `onCreateRole`; when given,
the list ends with a separator and a "Create new role…" item that calls it
instead of selecting. The invite form passes it only when the caller's access
has `canViewEstateRoles` and `canCreateRoles`: the item opens the shared
`CreateRoleDialog` (`roles/-components/create-role-dialog.tsx`, see
[estate-roles.md](estate-roles.md)) stacked over the Invite member dialog. On
success `useCreateEstateRole` invalidates the user's queries (including
`[userId, "estate-invitation-roles", estateId]`) and the form selects the new
role's ID, which resolves once the refreshed choices include it.

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
