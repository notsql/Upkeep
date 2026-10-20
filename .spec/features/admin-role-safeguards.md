# Admin role safeguards

**Status:** built
**Owner:** unassigned

**Planned policy revision (2026-10-18):** the user confirmed Manager and Admin
are the same role. The [Neon authority draft](neon-role-management.md) replaces
the provider-role editor with estate-scoped role management. The safeguards
below describe the existing WorkOS implementation; their estate-local successor
preserves at least one owner and blocks Manager self-removal/self-demotion.
Only another same-estate Manager may remove/demote a non-owner Manager. The
current owner must transfer ownership to another existing same-estate Manager
before removal/demotion. These confirmed rules remain planned until implemented;
existing-account migration is deferred.

## Problem

An application admin can currently remove their own WorkOS organization admin
role. Role-update failures also appear as the generic message "Unable to update
role", so an administrator cannot tell whether the update was blocked to retain
an estate admin or because they attempted to change their own role.

## Behaviour

- An authenticated admin cannot update their own organization membership to a
  set of roles that omits `admin`.
- An authenticated admin can retain or add their own `admin` role.
- An admin can remove another member's `admin` role only when another active
  admin remains in the same WorkOS organization.
- A rejected self-demotion returns 409 with `You cannot remove your own admin
  role.`
- A rejected last-admin demotion returns 409 with `Estate must have at least 1
  admin.`
- The admin users screen displays provider-safe role errors as `Unable to update
  role: <server message>`.
- Other role-update failures continue to display `Unable to update role`.

## Data

No Prisma models or database schema change.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| PUT | `/api/admin/users/{membershipId}/role` | `UserRoles` with non-empty `roleSlugs` | 200 `UserRoles`; 400/409/502/503 `AdminError` | Authenticated application admin; JWT subject identifies self |

The server resolves `membershipId` through WorkOS before a demotion. It compares
the membership's `userId` to the authenticated JWT subject and checks the same
organization's active memberships when the target is another admin.

## Edge cases

- When a self-demotion would also remove the estate's last admin, the
  self-demotion message takes precedence.
- Inactive admins and admins from another organization do not satisfy the
  remaining-admin rule.
- WorkOS lookup failures do not submit the role update and retain the generic
  client error message.
- The web client only displays the server-provided message for the documented
  409 response; it does not expose unknown or internal server responses.
- When authentication is disabled for local development and no JWT principal is
  present, the server cannot identify self; the remaining-admin rule still
  applies.

## Out of scope

- Preventing role changes made directly in the WorkOS dashboard.
- Coordinating concurrent updates across multiple server instances.
- Changing local estate ownership or estate-access grants.

## Verification

The server and web tests were written first and observed failing before the
implementation. The focused suites pass with 15 server tests across
`WorkOSServiceTests` and `AdminControllerTests`, and 7 admin users page tests.
Workspace type checks and formatting pass. The uncached workspace suite remains
blocked by unavailable Docker for Testcontainers and six pre-existing web test
failures outside the admin role feature.
