> The legacy WorkOS/global-grant screen is no longer reachable through current
> access capabilities. Managers use the Estate members page for their selected
> estate. Its backing global APIs are denied; see [council-invitations.md](council-invitations.md).
> The source described below remains for compatibility.

# Admin: user roles and estate access (frontend)

Paths are relative to `apps/web/src/`.

## Routes

| File | URL | Guard | Title |
| --- | --- | --- | --- |
| `routes/_auth/admin/users/index.tsx` | `/admin/users` | `_auth`, then own loader: `getAuth()`; if no user or `role !== "admin"`, `redirect({ to: "/estates" })` | none set |

The header account menu shows "Admin users" only when `canAccessPlatformAdmin`
(see [shell.md](shell.md)); there is no sidebar on `/admin/users`.

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `AdminUsersPage` (`routes/_auth/admin/users/-components/admin-users-page.tsx`) | "User roles" page. "Total users" card (member count or "—"). "Estate" select of WorkOS organizations (disabled while a role save is pending; changing it clears the selected member and resets the role mutation). Desktop members table (`TableCaption` "Users and assigned roles", sr-only): User (name + email), Joined, Current role (per-row select (`MemberRoleSelect`, trigger `aria-label="Role for {name}"`), saves on change; disabled while saving, when roles failed to load or are empty, when the member has several roles - "Manage multiple roles in WorkOS." - or has no membership ID), Estates ("Manage estates" button, `aria-label="Manage estates for {name}"`). The Estate select and the search box ("Search users", filters by name or email client-side) sit in the retractable `FilterBar` "Filter users" (toggled by `ListPageHeader`'s Filters button, shown once estates load; it starts open because the Estate picker that scopes the page lives there) (Estate `Field w-full sm:w-48`, trigger `w-full`). Loading uses `LoadingState` ("Loading estates…", "Loading members and roles…"); no estates, no estate selected and no members use `EmptyState` with the default Inbox icon; "No matching users" uses SearchX with an outline Clear filters. The FilterBar passes `activeCount` (1 while searching) and `onClear`, so its header shows "1 active" and a ghost Clear filters. `ListPageHeader` `icon={ShieldCheck}`, description "Member roles and estate access"; the Members heading is a `SectionHeading` with a Users icon. Mobile member cards retain name/email/joined date, the same role controls and Manage estates. Opens `MemberEstates` in a Dialog for the chosen member; focus returns to Manage estates. Pending access saves prevent closing. A failed organizations/members/roles query shows `ErrorState` (Retry refetches the failed queries); a failed role save shows a destructive alert line. | `Button`, `Card`, `Input`, `Label`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Table`, `TableBody`, `TableCaption`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` |
| `MemberEstates` (`routes/_auth/admin/-components/member-estates.tsx`) | "Estate access for {name}" section. Optional showTitle (false in the dialog, whose title names the member), and onPendingChange for dismissal prevention. One checkbox per estate, labelled "{name} ({code})", plus " · Owner" / " · Inactive". Checked when `owner || granted`; disabled for owners (they always keep access) and while a change is pending. Toggling saves immediately. Keyed by `userId`, so switching member resets it. Loading is `LoadingState` "Loading estates…"; a failed load is `ErrorState` + Retry; a failed change is a destructive alert line; none is `EmptyState` "No estates yet" (default Inbox). | `Checkbox`, `Label` |

## Endpoints

All calls are inline in the two components (there is no `lib/admin.ts`). Query
keys are not user-scoped; they start with `"admin"`. Queries use React Query's
default retry.

| Hook site | Method + path | Query key | Enabled |
| --- | --- | --- | --- |
| organizations | `GET /api/admin/users/organization/all` | `["admin", "organizations"]` | always |
| members | `GET /api/admin/users/organization/{organizationId}/members` | `["admin", "members", organizationId]` | organization chosen |
| roles | `GET /api/admin/users/organization/{organizationId}/roles` | `["admin", "roles", organizationId]` | organization chosen |
| estate access | `GET /api/admin/users/{userId}/estates` | `["admin", "estate-users", userId]` | when `MemberEstates` mounts |

| Mutation | Method + path | Body | Invalidates |
| --- | --- | --- | --- |
| role change (`AdminUsersPage`) | `PUT /api/admin/users/{membershipId}/role` | `{ roleSlugs: [role] }` | `["admin", "members", organizationId]` (exact), on success |
| grant access (`MemberEstates`) | `PUT /api/admin/users/{userId}/estates/{estateId}` | none | `["admin", "estate-users", userId]` (exact), on settled |
| revoke access (`MemberEstates`) | `DELETE /api/admin/users/{userId}/estates/{estateId}` | none | same, on settled |

Response fields used: organization `id`, `name`; member `membershipId`,
`userId`, `name`, `email`, `joined`, `roleSlugs`; role `slug`, `name`; estate
access `estateId`, `name`, `code`, `owner`, `granted`, `active`.

Error messages are fixed strings ("Unable to load organizations", "Unable to
load members", "Unable to load roles", "Unable to update role", "Unable to load
estate access", "Unable to update estate access"), not `estateError`.

## Dashboard presentation

The screen uses shared PageHeader (User roles) with no breadcrumbs, a real Total users card, desktop Admin users table and mobile cards
below 768px, selected through useMobile. Joined dates parse the API ISO string.
Desktop overflow is labelled and keyboard-focusable. No-match and no-member
messages are distinct. RoleEditor and ManageEstateButton keep controls identical
between presentations. The organisation picker,
search, role selection and estate-access controls keep their current endpoints
and restrictions. Shared colors, theme switch and responsive layout follow
[design-system.md](design-system.md).

Resident rows have `membershipRole = RESIDENT`, `granted = false` and `canManageGrant = false`. `MemberEstates` labels these as Resident assignment (read-only) and disables their checkboxes. Other estate grants remain editable. A generic PUT/DELETE targeting a resident row returns 409. This UI does not provision, remove or convert resident memberships. The generated contract includes `membershipRole` and `canManageGrant`; see [API access](../api/access.md).
