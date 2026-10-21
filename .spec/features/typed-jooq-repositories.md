# Typed jOOQ repository queries

**Status:** built
**Owner:** repository maintainers

## Problem

`AssetRepository`, `DashboardRepository`, and `EstateReportRepository` execute
handwritten SQL through `DSLContext`. Those queries bypass the generated schema
types, allowing schema drift to surface only at runtime.

## Behaviour

- All full SQL queries in these three repositories use the jOOQ query builder
  and generated tables. Result projections use typed fields.
- Asset listing preserves estate isolation, recursive location paths and subtree
  filtering, literal case-insensitive name/reference search, category, condition
  and active/inactive filters, and ordering by reference then ID.
- Latest assessment selection remains assessed date descending, creation time
  descending, then assessment ID ascending in both asset and dashboard queries.
- Dashboard counts retain existing ownership/membership restrictions, distinct
  council-member counting, empty estates, and one SQL statement/snapshot.
- Estate report lookups preserve optional row locking, estate-scoped hierarchy
  joins, and the existing `Record` field names consumed by the service.
- Report relocation updates only the scoped report's location and update time.
  Database wall-clock timestamp semantics are retained.
- Existing HTTP requests, DTOs, statuses, authorization, and frontend behavior
  remain unchanged.

## Data

Read the existing `Estate`, `EstateUser`, `Location`, `Asset`, `AssetAssessment`,
`Manufacturer`, and `AssetModel` models. Update the existing `IssueReport` model's
`locationId` and `updatedAt` fields. No schema changes, migrations, generated
source edits, or new dependencies.

## API

Existing contracts in `packages/api/openapi.json` remain unchanged:

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/assets` | Existing search/filter query parameters | `AssetResponse[]` | Existing estate management access |
| GET | `/dashboard/summary` | None | `DashboardSummaryResponse` | Signed-in subject |
| GET | `/estates/{estateId}/reports` | Existing hierarchy filters and cursor pagination | `IssueReportPageResponse` | Estate responder |
| GET | `/estates/{estateId}/reports/{reportId}` | Existing UUID paths | `IssueReportDetailResponse` | Estate responder |
| PATCH | `/estates/{estateId}/reports/{reportId}/location` | `RelocateReportRequest` | `IssueReportDetailResponse` | Estate responder |
| GET | `/estates/{estateId}/reports/{reportId}/images/{imageId}` | Existing UUID paths | Private image bytes | Estate responder |

## Edge cases

- Empty results and estates with no assets; assets with no assessment.
- Tied assessment dates/timestamps and stable UUID ordering.
- Literal search terms containing `%` or `_` must not become wildcards.
- Foreign-estate location IDs; inactive locations and ancestors.
- Duplicate memberships, resident conflicts, and shared-only estates.
- Concurrent report corrections, stale expected locations, revoked membership,
  and no-op corrections retaining their update timestamp.

## Validation

Run the existing asset, dashboard, and fault-report integration tests before and
after the refactor. Preserve their assertions; add characterization tests first
only for uncovered observable behavior. This is an implementation refactor with
no intended behavior changes. Run `pnpm check-types`, `pnpm test`, and `pnpm fix`;
inspect the final diff and update the matching API documentation to describe the
typed queries. No controller or contract regeneration is needed.

Verified on 2026-10-21:

- Baseline server suite: 820 tests passed.
- Fresh server compilation after cleaning generated output and resetting Nx.
- `MAVEN_ARGS=-o pnpm test --skip-nx-cache --output-style=static`: 821 server
  tests and 461 web tests passed, with no server failures, errors, or skips.
- `MAVEN_ARGS=-o pnpm check-types` and `MAVEN_ARGS=-o pnpm fix` passed.
- Added a characterization test for literal wildcard characters and mixed-case
  search; retained all existing behavior assertions.
- The existing integration suites cover the remaining edge cases, including
  assessment ties, empty results, ownership/membership scope, hierarchy filters,
  concurrent corrections and no-op timestamps.

## Out of scope

- SQL fragments in `FlatlineRepository` and `AssetReadingRepository`.
- Raw SQL in tests, Prisma migrations, and generated jOOQ sources.
- Service/controller redesign, new endpoints, frontend changes, and query
  behavior or authorization changes.
