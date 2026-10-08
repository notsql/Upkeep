# Asset register, search and retirement

**Status:** implemented and manually accepted (2026-10-08)
**Owner:** Chan Ding Jie
**Jira:** [ID-51](https://notjira.atlassian.net/browse/ID-51), incorporating missing register/search work from [ID-47](https://notjira.atlassian.net/browse/ID-47)
**Branch:** `feat/retire-assets`

## Problem

The existing owner-only deactivation flow preserves assets and assessment history,
but records only the time of deactivation. It cannot explain when equipment left
service or why. This branch has no asset register list, so retired equipment cannot
yet be excluded from a default active register with an option to view it.

## Proposed behaviour

- Extend the existing deactivation lifecycle; do not introduce a second status
  system or parallel retirement action. UI terminology becomes Retire/Retired.
- Require retirement date, a trimmed nonblank reason (maximum 2000 characters),
  and the existing exact-reference confirmation.
- Agreed date policy: today or a past date, not before installation when known;
  no future scheduling. Use the estate application's Singapore calendar date
  consistently in server validation and the form's default.
- Owners may restore an accidentally retired asset and correct retirement date
  and reason. Restoration returns the same asset ID/reference to the active
  register; it does not register replacement equipment or reset asset history.
- Retirement-information edits are separate from general asset edits, which
  remain blocked while retired. Date/reason validation also applies to corrections.
- Retain an append-only retirement/correction/restoration history recording
  what changed, who changed it and when. Show it on the asset details page;
  correcting retirement information never erases previous events.
- Retired assets remain readable with their reference, date/reason, assessments
  and device associations. Existing edit, assessment and device-registration
  restrictions remain; retiring or restoring does not delete or copy related records.
- An Assets section below Locations on estate details provides View assets and
  the existing Register asset action. Assets remain assigned to locations but
  are displayed in a separate estate asset table, not nested in the location tree.
- Default register shows active assets. A status control offers Active, Retired
  and All. Columns: reference, asset name, category, location, current condition
  and status. Reference is the existing generated per-estate asset identifier;
  renaming, retirement and restoration never change it.
- Search by asset name or reference, case-insensitive substring matching. Trim
  search text; blank search means no search filter. Filters combine with AND:
  category, location, current condition and Active/Retired/All status.
- A block/level location filter includes assets assigned directly to it or any
  descendant location. A common area filter matches that location. Support
  historical/inactive locations so retired assets remain discoverable.
- Conditions use the implemented assessment model: GOOD, NEEDS_ATTENTION, FAULTY,
  plus UNASSESSED as a filter for assets without assessments. No independent
  editable Asset.condition field is added.
- Asset name/reference links open the existing details page. Editing happens
  there, not inline in the table. Active assets retain existing owner controls
  to edit details, record assessments, register devices and retire. Retired
  assets offer Edit retirement information and Restore asset; ordinary asset
  editing remains unavailable until restoration.
- Replacement equipment uses the existing registration flow, producing its own
  asset ID/reference and independent history. No replacement link or history
  copying is included, as agreed.
- Keep current owner-only asset authorization. Do not expand estate role
  permissions or depend on the invitation PR. Cross-estate access returns 404;
  unsigned requests return 401. Inactive estates keep current write restrictions.
- No new maintenance/cost system: ID-2 supplies those records. Preserve the asset
  identity and relationships so future history remains attached to its asset.

## Data

Prisma owns the migration. Add nullable `retiredOn` (date) and `retirementReason`
(varchar 2000) to Asset. Keep `deactivatedAt` as the server-recorded retirement
operation timestamp and existing active/retired discriminator. It is distinct
from a possibly backdated business date; no extra status column is needed.

New retirement requests populate all fields atomically. Existing deactivated
rows remain retired, with missing date/reason shown as Not recorded; do not
fabricate historical reasons or silently reactivate them. Active rows have null
retirement fields. Preserve IDs, foreign keys and unique reference generation.
Restoration clears the current retired state and metadata only after preserving
its history. Add `lifecycleVersion` (integer, default 0) to Asset. Lifecycle
requests include the version read by the client; stale requests return 409 and
require refresh. Keep the existing estate-before-asset locking order.

Add AssetLifecycleEvent with UUID id, estateId/assetId (scoped foreign key),
action (RETIRED, CORRECTED, RESTORED), occurredAt (server timestamp), actorUserId,
previous retirement timestamp/date/reason and resulting retirement timestamp/
date/reason (nullable snapshots), and resulting lifecycleVersion. One transaction
changes current asset state, increments version and inserts the event. No event
is fabricated for legacy retirements; their prior state is captured when first
corrected or restored. Restoring an active asset or correcting an active asset
returns 409; repeated stale submissions do not duplicate history. Future
re-retirement creates another event without reusing the previous lifecycle version.

Derive current condition from assessments ordered by assessedOn descending,
createdAt descending, then ID (matching the existing history endpoint). Apply
condition filtering to that latest row, not to any historical matching row.
Query descendants and latest assessments in bulk; avoid per-row WorkOS or database
lookups. Reuse existing indexes; add a demonstrated necessary list index via
Prisma only. Regenerate Prisma and jOOQ after migrating the feature database.

## API

Extend existing contracts instead of leaving a reference-only bypass.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/estates/{estateId}/assets/{id}/deactivate` | Reference, `retiredOn`, `retirementReason`, `expectedVersion` | 200 AssetResponse | Owner of active estate |
| PATCH | `/estates/{estateId}/assets/{id}/retirement` | Corrected date/reason, `expectedVersion` | 200 AssetResponse | Owner of active estate |
| POST | `/estates/{estateId}/assets/{id}/restore` | Reference, `expectedVersion` | 200 AssetResponse | Owner of active estate |
| GET | `/estates/{estateId}/assets` | Optional `q`, `category`, `locationId`, `condition`, `status=ACTIVE/INACTIVE/ALL` (default ACTIVE) | 200 AssetResponse[] | Owner |
| GET | `/estates/{estateId}/assets/{id}` | none | AssetResponse with nullable retirement fields, current condition and lifecycle version | Owner |

Add GET `/estates/{estateId}/assets/{id}/lifecycle-events` returning ordered
lifecycle event DTOs for the owner, including actor ID and before/after values.
AssetResponse includes `currentCondition: GOOD | NEEDS_ATTENTION | FAULTY | null`
and `lifecycleVersion: integer`; null condition displays Not assessed yet.
The list returns the same generated DTO shape as details. Filter `condition`
accepts the three implemented values or UNASSESSED; omit it for all conditions.
Unknown filter values return 400; a foreign/missing location returns 404.
The collection has deterministic ordering (reference, then ID).

If the active-location picker cannot expose inactive locations, extend its
existing GET endpoint with an owner-only opt-in to include inactive locations;
retain active-only default behavior for registration/edit forms. Return the
ancestor paths required for an unambiguous location filter.

Use INACTIVE in the API to align with ID-47's draft; label it Retired in the UI.
Keep the current endpoint name to avoid duplicate lifecycle endpoints. Dates use
ISO YYYY-MM-DD. Invalid date/reason/reference/status is 400; unavailable estate
or asset is 404; inactive estate or conflicting retirement/edit is 409.
Regenerate OpenAPI and TypeScript types; never hand-write frontend DTOs.

## Frontend

Extend the existing shadcn retirement dialog on the asset details route with
date and reason fields. Retain confirmation, pending protection, error retention
and keyboard-accessible controls. Show retirement metadata on details, with
owner controls to correct retirement information or restore the asset.

Add `apps/web/src/routes/_auth/estates/$estateId/assets/index.tsx` and route-local
`-components/` for the agreed estate asset table. Use shared shadcn table,
buttons and status controls, with accessible links on asset names/references.
Place a labelled search box and category, location, condition and status selects
above the table, with Clear filters. Use hierarchical location labels such as
Block A › Level 2 › Pump room and mark inactive locations. Show friendly condition
labels; render Not assessed yet for null. Reset returns to Active with all other
filters cleared. No assets yet and No matching assets have distinct messages;
for filtered results offer Clear filters. Include loading and error/retry states.
Debounce search; store filters in validated route search parameters so back
navigation restores the user's view. Every filter is represented in the query
key, along with user and estate, preventing stale/out-of-order results from
replacing the currently selected query. A Back to estate link
returns to the estate; provide navigation back to the register from details.

The table reads existing Asset records; it does not require a second database
asset table. Current condition comes from the latest existing assessment using
the same ordering as assessment history; show Not assessed yet when absent.
Include it in the generated collection response without one request per row or
an independently editable duplicate condition field.

Use generated API hooks in `lib/assets.ts`, user/estate/status-scoped query keys,
and refresh relevant list/detail caches after registration, asset edits,
retirement, retirement corrections and restoration. Recording an assessment
also refreshes the table's current condition.
Show lifecycle history alongside existing condition history and devices.
Maintenance/work-order history and costs depend on ID-2: explicitly identify
unavailable integration rather than presenting fabricated zero costs or calling
condition assessments maintenance records.

## Edge cases and TDD sequence

1. Run failing API/unit tests for required date/reason, whitespace/length limits,
   future/pre-installation dates, confirmation, permissions and repeated requests.
   Then implement the smallest contract/service changes.
2. Add and run failing database tests for atomic retirement, legacy rows,
   history/device preservation, independent replacement history, and concurrent
   retirement/edit/restore, and retained lifecycle history. Apply the Prisma migration and implement persistence.
3. Add and run failing HTTP/database tests for default active filtering,
   retired/all filters, name/reference case-insensitive search, every filter and
   AND combinations, descendant/inactive/foreign locations, empty lists, invalid
   enums, estate isolation and latest-assessment selection. Include an asset
   whose older assessment matches a condition but latest assessment does not.
4. Add and run failing UI tests for date/reason submission, required validation,
   retained errors, pending controls, retired metadata, estate-to-register and
   row-to-details navigation, owner actions for active/retired assets, register
   filters, clear/reset, back-navigation state, stale-query protection, lifecycle
   history, and cache refresh after edits/assessments/lifecycle changes. Implement with shadcn and folder-based routes.
5. Regenerate API types and verify no legacy reference-only call remains. Run
   workspace tests (Docker for database tests), type checks and `pnpm fix`.
6. Update `.docs/api/assets.md`, `.docs/frontend/assets.md` and `.docs/README.md`;
   record the lifecycle/date semantics in an ADR and reconcile ID-47's shared
   register contract rather than duplicating it.

Manual acceptance: create an asset with assessments/devices, retire it, verify
it leaves Active but remains readable under Retired/All with intact history,
correct the retirement information, restore it and verify the same identity and
history, then register a replacement and verify a new reference and separate history.
Test with an unrelated estate/account and legacy retired records as well.

## Dependencies and out of scope

- Backend inspection on 2026-10-07: after `git fetch origin`, all fetched remote
  branches containing AssetController expose only individual-asset GET /{id},
  not a collection GET. This includes main and feat/building-assets. No reusable
  collection API was found in the available repository; unpublished work cannot
  be ruled out. Implement the missing endpoint here unless new code is supplied.
- ID-47 remains marked Done in Jira; that status is not evidence of delivery in
  this branch. Its old local draft is superseded by this combined plan for
  register/search behavior. Reuse existing detail/assessment/device screens.
- Work-order maintenance/cost preservation cannot be fully integration-tested
  until ID-2 provides those models; do not claim those future tests have passed.
- Pagination, custom column sorting, cross-estate search, general role permissions, deletion,
  replacement migration/copying, notifications and scheduled retirement are out
  of scope.
- Confirm a separate Neon feature branch/Infisical overrides before applying any
  migration; changing Git branches does not change the configured database.

## Agreed decisions and implementation gate

- Past dates allowed, not before installation or after today.
- Restoration and correction of retirement information are included.
- A separate estate Assets table links to detail-page editing; no inline editing
  or nesting assets in the location tree.
- Replacement equipment is a separate asset without a replacement link.
- Preserve who/when/before/after for retirement, correction and restoration.
- Include name/reference search and category/location/current-condition filters.

The user approved implementation on 2026-10-07. Follow the TDD sequence above.
Confirm the intended Neon feature branch/Infisical overrides before migration.

## Implementation verification (2026-10-07)

- Recovered on `feat/retire-assets`; retirement feature database reported the
  existing migration applied. Regenerated Prisma/jOOQ together; no migration was
  applied to shared dev during this implementation run.
- Initial six database regressions were observed failing (missing list endpoint,
  missing metadata and accepted invalid dates); they now pass. Historical-location
  opt-in was also observed failing before implementation.
- Database regressions cover lifecycle/correction/restoration, stale versions,
  legacy retirements, filter combinations/descendants, latest assessment selection,
  preserved assessments, invalid input and ownership. Concurrent retirements yield
  one success/one conflict; an event insert failure rolls back the asset update.
- UI regressions cover required retirement fields and retained errors, register
  links/condition/empty filtering, correction and restoration requests. Existing
  asset, assessment and device tests continue to pass.
- Full `pnpm test`, `pnpm check-types`, `pnpm fix`, and web build passed. Standard
  `pnpm api:generate` was attempted but its Maven plugin 1.5 was unavailable
  offline. Exported `/v3/api-docs` from the compiled API on a temporary local port
  and ran the existing Nx `@proj/api:openapi:types` target instead; installed nothing.
- Manual acceptance above remains for the user, including browser back navigation,
  device preservation and replacement registration in the feature environment.
  Work-order/cost integration remains unavailable until ID-2.

## Final review (2026-10-08)

- Clean offline Maven run: 138 backend tests passed, including 14 lifecycle and
  register integration cases against disposable Postgres. Historical invitation
  reports were excluded by cleaning build output.
- Frontend: 96 tests passed across 25 files (Nx reused the matching passing
  result); workspace type checks and formatting/lint checks passed.
- Reviewed generated OpenAPI differences: only asset list/lifecycle DTOs and
  the location includeInactive option changed. Reviewed and corrected the
  frontend documentation and index.
- Implementation remains uncommitted on feat/retire-assets. No migrations or
  data changes were made to Neon during this final review. Manual acceptance
  remains pending; use the retirement feature database.

## Manual-test correction (2026-10-08)

A filled retirement form could remain disabled when browser locale formatting
returned a slash-separated date. A regression reproduced the invalid default
before the fix. Singapore today now uses explicit ISO calendar parts. Retirement
and correction forms explain their date bounds inline, including the installation
date. Date policy and backend validation are unchanged.

## Manual acceptance (2026-10-08)

The user confirmed that all recommended manual acceptance scenarios passed after
the date-format correction. This includes register filters/navigation, retirement,
correction, restoration, repeated lifecycle history, latest assessed condition,
and conflicting submissions. Implementation is ready for review and commit.
The verification notes above describe the earlier stages of testing; manual
acceptance is now complete.

## Council merge and review (2026-10-08)

The resolved merge with main retains Council invitations, their status enum, and
asset retirement together. Prisma keeps both EstateInvitation and
AssetLifecycleEvent; their existing migrations and generated jOOQ definitions
remain intact. Active location reads remain available to accepted members;
includeInactive historical reads stay owner-only. Authorization regressions
failed when choosing the retirement-only implementation, then passed with the
combined rule and an owner-only historical-read regression.

The combined OpenAPI contract was re-exported from the merged Spring application
using isolated migrated Postgres and a temporary export harness, then the API
types and route tree were regenerated. No Neon data or schema was changed.
Fresh uncached workspace tests passed, including 203 Java tests, after removing
stale compiled output restored by Nx. Formatting, Prisma validation, type checks
and the production web build also passed.

Review cleanup uses a new @tests path alias for the retirement-panel test helper
import. The location-filter UUID check is retained: Location.id and
Asset.locationId are PostgreSQL UUIDs, not CUIDs.
