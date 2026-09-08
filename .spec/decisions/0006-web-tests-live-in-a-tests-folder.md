# 0006 - Web tests live in `apps/web/tests/`

**Status:** accepted. Supersedes the co-location choice in `0004`; the rest of
`0004` (Vitest, no globals, no jest-dom) still stands.

## Context

`0004` put tests beside the code they cover (`loader.test.tsx` next to
`loader.tsx`). That keeps a test one glance from its subject, but it mixes test
files into `src/`, so the shipped source tree and the test tree are the same
tree - and shared test infrastructure has nowhere natural to live.

## Decision

All web tests move to `apps/web/tests/`, mirroring the structure of `src/`:
a test for `src/routes/thing.tsx` lives at `tests/routes/thing.test.tsx`.
Tests import their subject through the `@/` alias rather than relative paths.

This gives shared test infrastructure an obvious home:

- `tests/setup.ts` - registered as Vitest's `setupFiles`.
- `tests/test-utils.tsx` - `renderWithProviders`, which wraps a component in
  the same `QueryClientProvider` and `ThemeProvider` that `__root.tsx`
  supplies. Components using `useQuery` or `useTheme` throw without them.

## Consequences

- `src/` contains only shipped code, which makes the build inputs honest.
- `nx.json`'s `production` named input excludes `apps/web/tests/**`. The
  existing `*.test.*` glob does not match `setup.ts` or `test-utils.tsx`, so
  without that exclusion, editing a test helper would invalidate the build
  cache.
- A test and its subject are no longer adjacent in the file tree; the mirrored
  path is what keeps them findable. A test that does not mirror a real `src/`
  path is a smell - usually it is testing something that should be extracted.
- `renderWithProviders` builds a fresh `QueryClient` per call with retries
  disabled. Sharing one would make tests order-dependent, and retries turn an
  intentional failure case into a multi-second timeout.
