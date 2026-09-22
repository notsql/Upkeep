# 0003 - Nx drives Maven through the official @nx/maven plugin

**Status:** accepted

## Context

`apps/server` was dropped into the monorepo without any Nx wiring, so Nx could
not see it: no caching, no dependency graph, and `pnpm build` silently skipped
the entire backend.

## Decision

Use the official `@nx/maven` plugin. It invokes Maven from the workspace root,
which required two structural changes:

- A **root aggregator `pom.xml`** listing `apps/server` as a module. It is an
  aggregator, not a parent - `apps/server` still inherits from
  `spring-boot-starter-parent`.
- The **Maven wrapper moved to the repo root** (`./mvnw`), where the plugin
  looks for it.

The plugin infers a target per Maven phase and goal, with correct inputs,
outputs and caching. `apps/server/project.json` adds three aliases on top so
the Java app answers to the same verbs as the TypeScript ones:

| Alias | Runs |
| --- | --- |
| `build` | the Maven `package` phase |
| `dev` | `spring-boot:run` |
| `openapi` | `verify -Popenapi`, exporting the API contract |

## Consequences

- `pnpm dev`, `pnpm build` and `pnpm test` cover Java and TypeScript together.
- Nx caches Java builds, keyed on sources, POMs and the resolved dependency
  tree.
- The plugin infers the Maven coordinate `com.proj:server` as the Nx project
  name; `apps/server/project.json` overrides it to `server` so tasks read
  `server:dev`. Scripts target it with `--projects=server`. Maven itself still
  uses the coordinate (`./mvnw -pl com.proj:server`).
- `@nx/maven` is marked experimental upstream. If it breaks on an upgrade, the
  fallback is a hand-written `project.json` calling `./mvnw` via
  `nx:run-commands` - the root POM and wrapper layout stay valid either way.
