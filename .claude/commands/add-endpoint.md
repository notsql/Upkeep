---
description: Add a REST endpoint to the Spring API and wire it through to the web app
argument-hint: <what the endpoint should do>
---

Add an endpoint to `apps/server` and make it usable from `apps/web`.

Requested endpoint: $ARGUMENTS

Follow the contract loop in `AGENTS.md` §4 exactly:

1. Read `.spec/architecture.md` first if you have not already this session.
2. Implement the controller method in `apps/server`, packaged by feature
   (`com.proj.server.<feature>`), not by layer. Keep the controller thin and
   put logic in a service.
3. Return a **real DTO type** - a `record`. Never `Map<String, Object>` or a
   bare `Object`: those generate as `unknown` and break frontend type safety.
   Never return a persistence type directly.
4. Validate the request body with `@Valid` plus Jakarta constraints.
5. Run `pnpm db:start`, then `pnpm api:generate` to export the contract and
   regenerate `packages/api/src/schema.ts`.
6. Run `pnpm check-types` and fix every call site the contract change breaks.
7. Call the endpoint from the web app through `apps/web/src/lib/api.ts` - never
   with a raw `fetch`.

Report which generated files changed, so they get committed with the Java code.
