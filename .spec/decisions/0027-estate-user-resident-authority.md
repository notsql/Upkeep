# 0027 — Resident authority comes from current EstateUser rows

**Status:** accepted on 2026-10-13

Supersedes the WorkOS resident-role and ResidentAssignment decisions in 0026. Its image storage, retention and ownership decisions remain in effect.

WorkOS proves identity and controls platform administration. Spring resolves estate permissions from `EstateUser` and `Estate.ownerUserId` on every request. RESIDENT permits report creation in one active estate and grants no management rights there. MEMBER/COUNCIL and ownership in other estates remain independent. A same-estate RESIDENT/owner conflict fails closed for management.

Membership deletion immediately revokes new submission without changing JWTs. Own-report list/detail/images require submitter identity only, preserving history after removal, a move or role conversion. Generic grants and council invitations cannot silently convert a resident row.

Prisma migrations add the one-resident-estate partial index and prohibition on resident invitation delegation, backfill unrevoked reviewed assignments, and remove the legacy table in a separate contract migration. Conflicting grants abort conversion. The migrations are tested against disposable Postgres; both have been applied to Neon dev. jOOQ regeneration remains pending the uncached Maven generator.

`GET /access/context` exposes independent estate capabilities without management details. Frontend management route guards await this projection in `beforeLoad`; SSR uses a fresh client with the request's token, returning no credentials. Reporting routes authenticate independently of current membership. Identity-scoped queries and private image blob cleanup protect cross-account sessions.
