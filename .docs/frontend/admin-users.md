# Admin: user roles and estate access (frontend)

Paths are relative to `apps/web/src/`.

## Routes

| File | URL | Guard | Title |
| --- | --- | --- | --- |
| `routes/_authenticated/admin/users.tsx` | `/admin/users` | `_authenticated`, then own loader: `getAuth()`; if no user or `role !== "admin"`, `redirect({ to: "/estates" })` | none set |

The header shows "Admin Dashboard" only to admins (see [shell.md](shell.md)).

## Screens and components

| Component (file) | Does | shadcn |
| --- | --- | --- |
| `AdminUsersPage` (`routes/_authenticated/admin/users.tsx`) | "User roles" page. "Total users" card (member count or "—"). "Estate" select of WorkOS organizations (disabled while a role save is pending; changing it clears the selected member and resets the role mutation). Members table (`TableCaption` "Users and assigned roles", sr-only): User (name + email), Joined, Current role (per-row select labelled "Role for {name}", saves on change; disabled while saving, when roles failed to load or are empty, when the member has several roles - "Manage multiple roles in WorkOS." - or has no membership ID), Estates ("Manage estates" button, `aria-label="Manage estates for {name}"`). Search box ("Search users") filters by name or email client-side. Opens `MemberEstates` for the chosen member. Shows the first of any query/mutation errors in one alert. | `Button`, `Card`, `Input`, `Label`, `NativeSelect`, `NativeSelectOption`, `Table`, `TableBody`, `TableCaption`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` |
| `MemberEstates` (`routes/_authenticated/admin/-components/member-estates.tsx`) | "Estate access for {name}" section. One checkbox per estate, labelled "{name} ({code})", plus " · Owner" / " · Inactive". Checked when `owner || granted`; disabled for owners (they always keep access) and while a change is pending. Toggling saves immediately. Keyed by `userId`, so switching member resets it. | `Checkbox`, `Label` |

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
