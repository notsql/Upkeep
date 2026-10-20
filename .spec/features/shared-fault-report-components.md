# Shared fault report components

**Status:** built; frontend verified on 2026-10-20; full workspace test run has
unrelated backend failures (see Verification)
**Owner:** unassigned
**Related features:** [Resident fault reporting](resident-fault-reporting.md),
[fault report locations](fault-report-locations.md)

## Problem

The resident and manager fault report screens duplicate their report card,
metadata, description and private image presentation. The manager list omits
metadata labels shown to residents, and the manager detail arranges the same
metadata differently. Presentation changes can drift between the two views.

## Behaviour

- Resident and estate report lists use the same report card and metadata
  components, based on the current resident presentation. Each card shows its
  linked title, labelled Estate name, Location, Status and Submission time.
- Both detail screens use the same card, metadata, Description and Images
  components. Location and status retain the resident view's aligned, wrapping
  row. Description preserves full multiline text and long-word wrapping.
- Every submitted image retains its natural aspect ratio at the available
  width, without cropping. No images shows "No images submitted." An image
  failure remains visible without hiding the report or other images.
- The estate detail retains its Updated timestamp and permission-controlled
  Change location action alongside the shared presentation.
- Estate list filters, cursor navigation, retries, detail links and location
  correction retain their current behaviour. Resident links and pagination
  retain their current behaviour.
- Resident and responder screens continue using their existing separate
  authenticated query hooks and endpoint paths. Current estate capability and
  resident ownership checks still control access.
- Private image object URLs are revoked when image data changes or the
  component unmounts, including when an identity change removes report content.

## Implementation scope

Extract the existing resident presentation into focused shared components in
`apps/web/src/components/reports/`, and use them from both pairs of list/detail
routes. Keep route-specific querying, navigation, filters and correction logic
in their current routes or adjacent `-components/` folders. Shared presentation
accepts data derived from the generated API types and route-provided links or
actions; it does not choose authorization policies or API endpoints.

Share private image rendering and object URL cleanup while retaining the
existing resident and responder query wrappers and their loading behaviour.
Use the existing shadcn primitives and folder-based routes.

Update `.docs/frontend/resident-reports.md` and
`.docs/frontend/estate-reports.md` to describe the resulting shared components.
Add behavioural regression coverage before changing implementation, observe
the intended failure, then run the existing resident/responder suites and
workspace checks. Do not test internal component structure.

## Data

No Prisma models or database changes.

## API

No endpoint or generated contract changes. Existing resident report and
estate-scoped report/image endpoints retain their requests, responses and
authorization policies. Frontend props derive report fields from the generated
contract rather than defining replacement API DTOs.

## Edge cases

- Long titles, descriptions and location paths wrap on narrow screens.
- Empty lists, filtered lists with no matches, loading and request failures
  retain their existing messages and retry controls.
- Image failures and empty image collections remain accessible in the Images
  section, which retains its labelled heading.
- Access revocation and account switching hide protected content and release
  image URLs as before.
- Users without relocation permission never see Change location. Save errors,
  concurrent location updates and reload behaviour remain covered by existing
  correction tests.

## Implementation phases

- [x] Agree this spec with the user.
- [x] Write and run failing coverage for the manager's labelled report cards.
- [x] Extract the shared resident presentation and use it in both views.
- [x] Run report regression suites, workspace checks and formatting; update
      the frontend documentation.

## Verification

- The new manager-card regression failed before implementation because the
  Estate name label was absent, then passed with the shared card.
- `pnpm nx run web:test`: 376 tests passed across 63 files.
- After moving the resident image wrapper into its route's `-components/`
  folder, all 24 resident report tests passed again.
- `pnpm check-types`, `pnpm fix` and the final web type/lint checks passed.
  Formatting did not change unrelated files.
- `MAVEN_ARGS=-o pnpm test`: the backend ran 638 tests with 13 failures,
  all in the existing `LocationControllerTests` bulk-floor cases, which receive
  HTTP 403 instead of their expected statuses. Backend source and tests were
  not changed by this refactor.

## Out of scope

- New dependencies, backend changes, database changes or API regeneration.
- Changes to new-report submission, role permissions or query cache keys.
- New report editing actions or changes to pagination/filter behaviour.
- Refactoring unrelated screens or introducing a general-purpose card system.
