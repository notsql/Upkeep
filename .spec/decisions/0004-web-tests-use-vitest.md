# 0004 - Web tests run on Vitest with a config of their own

**Status:** accepted. The co-location choice below is superseded by `0006`;
everything else stands.

## Context

The web app had Testing Library and jsdom in `devDependencies` but no test
runner, so `pnpm test` covered only the Java side.

## Decision

Vitest, configured in **`apps/web/vitest.config.ts` rather than reusing
`vite.config.ts`**.

The app config loads the TanStack Start and Nitro plugins, which exist to build
an SSR server. Component tests run in jsdom and need none of that; loading it
only slows the suite and pulls server-side concerns into unit tests. The test
config carries just the React transform and tsconfig path resolution.

Two smaller choices:

- **No Vitest globals.** Tests import `describe`/`it`/`expect` explicitly, so
  there is no hidden global namespace and no extra `types` entry in tsconfig.
  Because Testing Library only auto-cleans when a global `afterEach` exists,
  the setup file calls `cleanup()` itself (now `tests/setup.ts` - see `0006`).
- **No `@testing-library/jest-dom`.** Its matchers are convenient but not
  required: `getByRole` throws when nothing matches, so the query is already
  the assertion. This keeps the dependency list smaller at the cost of
  `toBeVisible`, `toBeDisabled` and friends.

## Consequences

- `pnpm test` now covers both languages, cached by Nx.
- Tests were originally co-located with the code they cover. `0006` moved them
  to `apps/web/tests/`.
- Querying by role and accessible name is the house style. When that is hard,
  it usually indicates an accessibility gap in the component - the `Loader`
  spinner gained `role="status"` and a label for exactly this reason.
- If assertions start feeling verbose, adding `@testing-library/jest-dom` back
  is a one-line change and does not invalidate this decision.
