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
| `AdminUsersPage` (`routes/_auth/admin/users/-components/admin-users-page/admin-users-page.tsx`) | "User roles" page. "Total users" figure in the header (member count or "—"; plain text, no card). "Estate" select of WorkOS organizations (disabled while a role save is pending; changing it clears the selected member and resets the role mutation). Desktop members table (`TableCaption` "Users and assigned roles", sr-only): User (name + email), Joined, Current role (per-row select (`MemberRoleSelect`, trigger `aria-label="Role for {name}"`), saves on change; disabled while saving, when roles failed to load or are empty, when the member has several roles - "Manage multiple roles in WorkOS." - or has no membership ID), Estates ("Manage estates" button, `aria-label="Manage estates for {name}"`). The Estate select and the search box ("Search users", filters by name or email client-side) sit in the retractable `FilterBar` "Filter users" (toggled by `ListPageHeader`'s Filters button, shown once estates load; it starts open because the Estate picker that scopes the page lives there) (Estate `Field w-full sm:w-48`, trigger `w-full`). Loading uses `LoadingState` ("Loading estates…", "Loading members and roles…"); no estates, no estate selected and no members use `EmptyState` (`Building2` for no estates, `Users` for no estate selected / no members); "No matching users" (`SearchX`) has an outline Clear filters. The FilterBar passes `activeCount` (1 while searching) and `onClear`, so its header shows "1 active" and a ghost Clear filters. `ListPageHeader` `icon={ShieldCheck}`, description "Member roles and estate access"; the Members heading is a `SectionHeading` with a Users icon. Below 768px `admin-users-member-list.tsx` renders a `ul` "Admin users" of shadcn `Item size="sm"` rows split by `ItemSeparator` (no cards): title = name, muted "email · role" line, small "Joined {date}", trailing Manage estates button, and the role select in the item footer. Opens `MemberEstates` in a Dialog for the chosen member; focus returns to Manage estates. Pending access saves prevent closing. A failed organizations/members/roles query shows `ErrorState` (Retry refetches the failed queries); a failed role save shows a destructive alert line. The page composes sections beside it: `admin-users-header.tsx`, `admin-users-filters.tsx`, `admin-users-members.tsx` (heading, empty states, and `admin-users-member-list.tsx` on mobile or `admin-users-table.tsx` on desktop) and `admin-users-access-dialog.tsx`; state and handlers live in `use-admin-users-page.ts`, and the queries/mutation in `lib/admin-users.ts`. | `Button`, `Item`, `Input`, `Label`, `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`, `Table`, `TableBody`, `TableCaption`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` |
| `MemberEstates` (`routes/_auth/admin/-components/member-estates/member-estates.tsx`) | "Estate access for {name}" section. Optional showTitle (false in the dialog, whose title names the member), and onPendingChange for dismissal prevention. One checkbox per estate, labelled "{name} ({code})", plus " · Owner" / " · Inactive". Checked when `owner || granted`; disabled for owners (they always keep access) and while a change is pending. Toggling saves immediately. Keyed by `userId`, so switching member resets it. Loading is `LoadingState` "Loading estates…"; a failed load is `ErrorState` + Retry; a failed change is a destructive alert line; none is `EmptyState` "No estates yet" (`Building2` icon). | `Checkbox`, `Label` |

## Endpoints

All calls are inline in the two components (there is no `lib/admin.ts`). Query
keys are not user-scoped; they start with `"admin"`. Queries use React Query's
default retry.

| Hook site | Method + path | Query key | Enabled |
| --- | --- | --- | --- |
| organizations (`useAdminOrganizations`, `lib/admin-users.ts`) | `GET /api/admin/users/organization/all` | `["admin", "organizations"]` | always |
| members (`useAdminMembers`) | `GET /api/admin/users/organization/{organizationId}/members` | `["admin", "members", organizationId]` | organization chosen |
| roles (`useAdminOrganizationRoles`) | `GET /api/admin/users/organization/{organizationId}/roles` | `["admin", "roles", organizationId]` | organization chosen |
| estate access | `GET /api/admin/users/{userId}/estates` | `["admin", "estate-users", userId]` | when `MemberEstates` mounts |

| Mutation | Method + path | Body | Invalidates |
| --- | --- | --- | --- |
| role change (`useAdminRoleUpdate`, `lib/admin-users.ts`) | `PUT /api/admin/users/{membershipId}/role` | `{ roleSlugs: [role] }` | `["admin", "members", organizationId]` (exact), on success |
| grant access (`MemberEstates`) | `PUT /api/admin/users/{userId}/estates/{estateId}` | none | `["admin", "estate-users", userId]` (exact), on settled |
| revoke access (`MemberEstates`) | `DELETE /api/admin/users/{userId}/estates/{estateId}` | none | same, on settled |

Response fields used: organization `id`, `name`; member `membershipId`,
`userId`, `name`, `email`, `joined`, `roleSlugs`; role `slug`, `name`; estate
access `estateId`, `name`, `code`, `owner`, `granted`, `active`.

Error messages are fixed strings ("Couldn't load organizations. Try again.", "Couldn't
load members. Try again.", "Couldn't load roles. Try again.", "Couldn't update role. Try again.", "Couldn't load
estate access. Try again.", "Couldn't update estate access. Try again."), not `estateError`.

## Dashboard presentation

The screen uses shared PageHeader (User roles) with no breadcrumbs, a plain Total users figure (no card), desktop Admin users table and a mobile item list
below 768px, selected through useMobile. Joined dates parse the API ISO string.
Desktop overflow is labelled and keyboard-focusable. No-match and no-member
messages are distinct. RoleEditor and ManageEstateButton keep controls identical
between presentations. The organisation picker,
search, role selection and estate-access controls keep their current endpoints
and restrictions. Shared colors, theme switch and responsive layout follow
[design-system.md](design-system.md).

Resident rows have `membershipRole = RESIDENT`, `granted = false` and `canManageGrant = false`. `MemberEstates` labels these as Resident assignment (read-only) and disables their checkboxes. Other estate grants remain editable. A generic PUT/DELETE targeting a resident row returns 409. This UI does not provision, remove or convert resident memberships. The generated contract includes `membershipRole` and `canManageGrant`; see [API access](../api/access.md).
