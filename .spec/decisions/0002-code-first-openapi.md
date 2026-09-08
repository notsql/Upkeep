# 0002 - The OpenAPI contract is generated from the Java code

**Status:** accepted

## Context

The frontend and backend are written in different languages and, on a team,
usually by different people. Something has to guarantee they agree on the
shape of the API.

## Decision

Code-first. The Spring controllers are the contract:

1. `springdoc` derives an OpenAPI document from the annotated controllers.
2. `pnpm api:generate` boots the app, writes `packages/api/openapi.json`, and
   regenerates `packages/api/src/schema.ts` from it.
3. `apps/web` consumes that schema through the typed client in `packages/api`.

Both `openapi.json` and the generated `schema.ts` are committed, so a fresh
clone type-checks without running a server, and contract changes show up as a
reviewable diff in the PR that causes them.

## Consequences

- The spec cannot drift from the implementation - it is derived from it.
- An endpoint that is not annotated does not exist as far as the frontend is
  concerned. Response DTOs must be real types, not `Map` or `Object`, or the
  generated client degrades to `unknown`.
- The frontend can be blocked on the backend for genuinely new endpoints. If
  that becomes the bottleneck, revisit in favour of a spec-first flow.
- A forgotten `pnpm api:generate` shows up as a stale committed diff, which is
  why regenerating is part of the endpoint workflow in `AGENTS.md`.
