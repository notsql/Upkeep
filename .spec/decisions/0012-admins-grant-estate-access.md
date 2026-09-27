# 0012 - Admins grant view access to estates

## Status

Accepted. Extends 0010.

## Decision

Estate access is a separate `EstateAccess` table of (estate, WorkOS user)
grants, managed only by callers with the `admin` role. Ownership stays on
`Estate.ownerUserId` and is unchanged. A user can see estates they own or have
been granted, but only the owner can edit or deactivate them.

Access is checked in the database on every request. It is not put in the JWT
or a WorkOS organisation, so grants and revocations apply immediately without
reissuing tokens or recreating users.

## Consequences

Estate reads query two sources, the owner column and the grants table. Write
paths still check ownership alone. A caller who can see an estate but not
change it gets 403 rather than 404, because hiding an estate they can already
see protects nothing. Richer per-estate roles would extend `EstateAccess` with
a role column rather than replace it.
