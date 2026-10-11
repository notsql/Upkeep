# Testing

How we test, and how to work test-first. `decisions/0004` and `decisions/0006`
record why the setup looks the way it does.

## Layout

```
apps/web/
├── src/                        # application code
└── tests/
    ├── setup.ts                # runs before every test file
    ├── test-utils.tsx          # renderWithProviders + re-exported queries
    └── components/
        └── loader.test.tsx     # mirrors src/components/loader.tsx

apps/server/src/test/java/       # JUnit, standard Maven layout
```

`tests/` mirrors `src/`. A test for `src/routes/thing.tsx` belongs at
`tests/routes/thing.test.tsx`. Import the code under test through the `@/`
alias (`@/components/loader`), never with a long relative path.
Shared test helpers can use `@tests/test-utils`; `@tests/*` maps to `apps/web/tests/*`
in the web tsconfig, which Vite and Vitest both resolve natively.

## Commands

```bash
pnpm test                          # everything, cached by Nx
pnpm --filter web test:watch       # the red-green loop
```

---

## Recovering stale Java build output

If an HTTP test expects a DTO field present in Java source but absent from the
response, inspect the compiled class before changing the test. For example,
`javap apps/server/target/classes/com/proj/server/dashboard/DashboardSummaryResponse.class`
must include `councilMemberCount()`. Outdated cached classes caused this exact
failure on 2026-10-09; recompiling current source passed all 211 Java tests.

Clean generated Java output and reset both Nx cache and workspace metadata:

```bash
MAVEN_ARGS=-o pnpm nx run server:clean --skip-nx-cache
pnpm nx reset
MAVEN_ARGS=-o UV_NO_SYNC=1 pnpm test
```

Use the full reset here: `nx reset --onlyCache` left task-cache records behind
in this installed Nx version. A run reporting success with **No tests to run**
after cached compilation is not valid regression evidence. Confirm actual
test reports and current compiled classes. To force all tasks to execute,
run `MAVEN_ARGS=-o UV_NO_SYNC=1 pnpm test --skip-nx-cache`.
These commands affect generated artifacts and task metadata, not database data,
Git changes or dependencies. Docker must still be available for Java tests.

## Test-driven development

The point of TDD here is not ceremony. It is that **a test written first
describes behaviour, and a test written afterwards describes implementation**.
The second kind passes forever and catches nothing.

### The loop

1. **Red.** Write one failing test naming a behaviour the system does not yet
   have. Run it. *Watch it fail.* A test you never saw fail is a test you have
   no reason to trust - it may be asserting nothing.
2. **Green.** Write the least code that passes it. Obvious, ugly, hard-coded -
   all fine. Getting to green is a separate job from getting it right.
3. **Refactor.** Now improve the code with the test holding it still. Change
   structure or implementation, never behaviour. The test must not need
   editing; if it does, it was coupled to implementation.

Then repeat with the next behaviour. Small loops - minutes, not hours.

### What to write a test about

Work from `features/` specs. The **Behaviour** section is written as statements
that are each either true or false, which is exactly one test apiece.

> "An unauthenticated visitor cannot see the admin link."

becomes

```tsx
it("hides the admin link from signed-out visitors", () => { ... });
```

Name tests after the behaviour, not the function. `it("rejects a booking that
overlaps an existing one")` survives a rewrite; `it("calls validateBooking")`
does not.

### What not to test

TDD is not "100% coverage". Coverage is an output, never a target - chasing it
produces tests of getters and framework glue that cost maintenance and catch
nothing.

Don't test:

- **Third-party code.** React Query caches correctly; that is their test suite.
- **Generated code.** `packages/api/src/schema.ts` comes from the OpenAPI
  contract - test *your* use of it, not it.
- **Implementation details.** Internal state, private methods, call counts.
  Assert what a user or caller can observe.
- **Types the compiler already checks.** A test that a function returns a
  `string` is TypeScript's job.

Do test: branching logic, boundaries, error paths, and anything a spec's
**Edge cases** section names.

### Frontend specifics

- **Query the way a user perceives the page** - by role and accessible name.
  `getByRole("button", { name: "Save" })` breaks when the button stops being a
  button, which is exactly when you want to know. `querySelector(".btn-save")`
  survives that and tells you nothing.
- When accessible querying is hard, the component usually has an accessibility
  gap. Fix the component. `Loader` gained `role="status"` and a label this way -
  the test found a real bug.
- **Use `renderWithProviders` from `tests/test-utils.tsx`** for anything
  touching `useQuery` or `useTheme`; bare `render` throws without the providers.
- **Never assert on a fixed delay.** Use `await screen.findBy...` or `waitFor`.
  A `setTimeout` in a test is a flake with a countdown.
- **No `@testing-library/jest-dom`.** `getByRole` throws when nothing matches,
  so the query is already the assertion.

### Backend specifics

- Plain JUnit unit tests for logic - fast, no Spring context.
- `@SpringBootTest` only when you genuinely need wiring. It is slow; do not
  reach for it to test a pure function.
- Test controllers through their HTTP contract (status codes, response shape),
  because that contract is what the frontend generates against.

### Working with an agent

Agents are strong at step 2 and weak at step 1, because a plausible-looking
test that passes immediately feels like success to them.

- Ask for **the failing test first**, and require the failure output before any
  implementation.
- Be suspicious of a test that passes on its first run. Break the
  implementation deliberately and confirm the test goes red.
- Never let an agent edit a test to make an implementation pass. Changing a
  test to match broken code deletes the only thing protecting the behaviour.
  If the test is genuinely wrong, say so and fix it as its own change.

### Definition of done

- Every **Behaviour** bullet in the feature spec has a test.
- Every **Edge case** bullet has a test or a written reason it has none.
- Each test was seen to fail before it passed.
- `pnpm test` is green, and so is `pnpm check-types`.
