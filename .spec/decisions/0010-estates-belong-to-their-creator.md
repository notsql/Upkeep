# 0010 - Estates belong to their creator

## Status

Accepted.

## Decision

Any authenticated user may create an estate. Spring stores the verified JWT
subject as its owner; ownership is never supplied by a request body. Estate
queries include the owner ID. A controller rejects missing JWT subjects even in
local open-security mode. WorkOS manages identity; no local user table or global
manager role is needed.

Ownership is separate from future estate memberships. Manager invitations and
roles are a later feature and do not change who owns an estate.

Deactivation stores a timestamp without deleting records. The API requires the
exact current estate code. Edit and deactivation use row locks within Spring
transactions. Future asset/report creation must take the same row lock and
check active status before inserting, to serialize against deactivation.

## Consequences

Estate IDs alone grant no access. Unknown and foreign-owned estates return the
same 404. Codes remain globally unique after deactivation. Owners may correct
inactive estate details, but cannot reactivate or transfer them in this story.
Prisma owns the schema; generated jOOQ accesses Neon and generated OpenAPI types
are the browser contract, following decisions 0001, 0002 and 0008.
