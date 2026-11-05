# Estate invitations and member roles

## Routes and components

The Members section is two folder routes sharing one page component
(`CouncilPage({ estateId, view })` in `council/-components/council-page.tsx`):

| Route | File | `view` | Tab title |
| --- | --- | --- | --- |
| `/estates/$estateId/council` | `council/index.tsx` | `"members"` (default) | "Council members" |
| `/estates/$estateId/council/invitations` | `council/invitations/index.tsx` | `"invitations"` | "Pending invitations" |

Route-local `council/-components/`: CouncilPage, access-controls,
access-confirmation, invitation-form, member-filters, estate-members-table,
member-permission and role-picker.

Layout, top to bottom (Managers, i.e. `canManageInvitationPermissions`):

- `ListPageHeader` "Members" (`icon={Users}`, no description) with the
  Filters toggle (`FilterToggle`, "Filters, N active") and, when
  `canInviteMembers`, the **Invite member** trigger (`UserPlus`) in the
  `actions` slot - the last action, where Create sits on other list pages. It
  is labelled "Invite member", not "Create", because it sends an invitation.
  The trigger opens a shadcn Dialog titled "Invite member" with the
  email/role form.
- `SubNav` "Member views": "Members" (`exact`, `/estates/$estateId/council`)
  and "Pending invitations" (`/estates/$estateId/council/invitations`). The
  router marks the current one `aria-current="page"`.
- Inactive estates show "This estate is inactive. New invitations are disabled."
- MemberFilters: the retractable `FilterBar` "Filter members" (collapsed by
  default, `useFilterPanel`), with `type="search"` Input "Search members"
  (name/email, also matches invitation email) and Select "Filter by role"
  (All roles, Owner, the presets and custom roles; `Field w-full sm:w-48`,
  trigger `w-full`). Filtering is client-side; it applies to whichever view is
  shown. Filter state is per page mount (switching views resets it); the API
  has no server-side filters.
- Members view: card "Members" with an "N active" Badge (no icon - the header
  has Users), then the paged Table (Name, Email, Role, Status, Actions). Role
  shows exactly one Badge: "Owner" (hint "Full Manager access plus
  ownership") for the estate owner, otherwise the preset label or custom role
  name. Loading is `LoadingState` "Loading members…" (table); a failed roster
  or estate read is `ErrorState` + Retry; no roster is `EmptyState` "No members
  yet" (default Inbox); filters with no result show `EmptyState` "No matching
  members" (SearchX) with an outline "Clear filters" action, alongside the
  FilterBar's own ghost Clear filters.
- Pending invitations view (and the whole page body for delegated inviters):
  card "Pending invitations" (`Mail` icon) with an "N pending" Badge; each row
  shows email, role Badge, delivery and expiry, and a ghost **Revoke** button
  (accessible name "Cancel invitation for <email>") that confirms in a
  `ConfirmDialog` ("Cancel invitation?", destructive "Cancel invitation",
  outline "Keep invitation"). A failed load is `ErrorState` + Retry. Empty is
  `EmptyState` "No pending invitations" (Inbox); filtered-out is "No matching
  invitations" (SearchX) with "Clear filters". There is no resend action
  because the API has no resend endpoint.
- Delegated inviters (no `canManageInvitationPermissions`) get
  `ListPageHeader` "Invitations" (Users icon, Invite member action), no
  SubNav or filters, and the pending-invitations card on both routes.
- The access check before render shows `LoadingState` "Loading estate
  access…"; a failed check is `ErrorState` with "Retry access"; no permission
  is a destructive Alert.

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
with the shared `Pagination` (nav "Member pages", outline "Previous page" /
"Next page", summary "1–20 of 45 members"). A shorter refreshed roster
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
the list ends with a separator and a "Create new role…" (`Plus`) item that calls
it instead of selecting. The invite form passes it only when the caller's access
has `canViewEstateRoles` and `canCreateRoles`; it navigates to
`/estates/$estateId/roles/new?returnTo=council` (see
[estate-roles.md](estate-roles.md)). After creation that page navigates to
`/estates/$estateId/council?inviteRole=<id>`; `InviteMemberDialog` reads
`inviteRole` with `useSearch({ strict: false })`, opens by default and passes it
as `CouncilInvitationForm`'s `initialRole`. The role resolves once the refreshed
choices (invalidated by `useCreateEstateRole`) include it. The typed email is not
preserved across the round trip. The `inviteRole` param stays in the URL.

Invite dialog copy: description "New users get an email · existing users accept
on Invitations"; trigger `UserPlus` "Invite member"; primary `Send` "Send
invitation"; empty choices "No eligible roles".

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

## Icons and copy

PageHeader `icon={Users}` (sidebar Members), description "Members and
invitations · <estate>". Members CardTitle has a Users icon, Pending
invitations a Mail icon (description "Not yet accepted"). Empty: "No members
yet" ("Invited members appear here"), "No pending invitations" ("Sent
invitations appear here"). The access-error "Retry access" is `outline`.
