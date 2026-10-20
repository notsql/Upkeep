> These legacy global WorkOS role endpoints are retired at the Spring Security
> boundary and return 403 to authenticated callers. Their generated DTOs remain
> for compatibility; current role management uses estate-scoped Neon APIs in
> [council-invitations.md](council-invitations.md). The text below is the legacy contract.

# Admin role updates

`PUT /api/admin/users/{membershipId}/role` requires admin authentication.
`membershipId` is the WorkOS organization membership ID. Request and 200
response use `UserRoles`: `{ "roleSlugs": string[] }`.
Example request and response: `{ "roleSlugs": ["member"] }`.
The generated DTO contract is in `packages/api/openapi.json`.

Before removing `admin`, WorkOSService resolves the membership. It rejects the
change when its `userId` matches the authenticated JWT subject, then checks all
pages of the same organization's active memberships for another admin. Both
multiple roles and the legacy single role are supported. The membership being
changed is excluded. Assigning or retaining `admin`, and changing a member who
is not currently an admin, remain allowed. This protects WorkOS organization
administration; local estate ownership is a separate field and is not changed
by this endpoint.

Runtime errors: 400 for empty or blank roles; 401 for missing authentication;
403 for non-admin callers; 409 for self-demotion (`You cannot remove your own
admin role.`) or when no other active admin remains (`Estate must have at least
1 admin.`); 502 for WorkOS failures; 503 when WorkOS is unconfigured. The
400/409/502/503 body is `AdminError`: `{ "message": string }`. Failed checks do
not submit the role update. When authentication is disabled locally, there is
no JWT subject for the self check; the remaining-admin check still applies.

Role changes are serialized within one service instance so overlapping requests
on that instance cannot both demote the last two admins. WorkOS reads and writes
are separate API calls: updates through other instances or the WorkOS dashboard
are not covered by that serialization.
