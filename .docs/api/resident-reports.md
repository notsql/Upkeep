# Resident fault reports API

`packages/api/openapi.json` is the contract source. WorkOS JWTs authenticate identity; `EstateUser.role = RESIDENT` supplies the current reporting estate. JWT resident claims grant no estate permissions. A user may report in several assigned estates and manage others through their independent memberships. Missing or invalid authentication returns 401. The reporting controller requires a real JWT principal even in development without an issuer.

Creation requires an active resident membership and active estate. List, detail and private images require only authenticated subject and report ownership, including after membership deletion, a move or role conversion. Estate ownership and platform administration grant no access to other users' reports. See [access.md](access.md) for the access projection and admin membership contract.

## DTOs

| DTO | Fields |
| --- | --- |
| `ResidentContextResponse` | `estates: { id: UUID, name: string }[]`; `canSubmit: boolean` |
| `ResidentLocationResponse` | `id: UUID`; `type: string` (`BLOCK`, `LEVEL`, `COMMON_AREA`); `name: string`; `parentId: UUID \| null`; `sortOrder: integer \| null` |
| `IssueReportSummaryResponse` | `id: UUID`; `title: string` (1–150 characters); `description: string`; `estateName: string`; `location: { id: UUID, label: string }`; `status: string`; `createdAt: date-time`; `updatedAt: date-time` |
| `IssueReportDetailResponse` | Summary fields plus `images: { id: UUID, contentType: string }[]` |
| `IssueReportPageResponse` | `items: IssueReportSummaryResponse[]`; `nextCursor: string \| null` |
| `EstateError` | `message: string` |

Storage keys, other residents' data and management notes never appear in these DTOs.

`ResidentReportRepository` uses the generated jOOQ tables and typed DSL for every query and insert, including location ancestry, ownership filters and `(createdAt, id)` cursor comparisons. Report timestamps are database-generated, and image metadata retains its database creation-time default. Prisma remains the schema and migration authority.

## Endpoints

| Method and path | Request | Success | Errors |
| --- | --- | --- | --- |
| `GET /resident/context` | None | 200 `ResidentContextResponse`; empty estates and `canSubmit=false` without an active resident membership | 401 |
| `GET /resident/locations` | Required estateId: UUID query | 200 `ResidentLocationResponse[]`; active hierarchy in the selected resident estate; inactive/unassigned estate returns 403 | 400, 401, 403 |
| `POST /resident/reports` | `multipart/form-data`: required estateId: UUID, required `title` (1–50 characters after trimming), required `description` (1–2,500 characters), required `locationId` (UUID of active level or common area), optional repeated `images` (up to 3 JPEG/PNG files, 5 MB each, 4,032 × 3,024 maximum) | 201 `IssueReportDetailResponse` and `Location: /resident/reports/{id}` | 400 invalid title/text/location/image, 401, 403 missing assignment, 413 upload too large, 415 unsupported image, 503 image storage unavailable |
| `GET /resident/reports` | Optional `cursor: string`, `limit: integer` (1–50, default 20) | 200 `IssueReportPageResponse`, newest first | 400 invalid cursor/limit, 401 |
| `GET /resident/reports/{reportId}` | UUID path | 200 `IssueReportDetailResponse` | 401, 404 missing or not owned |
| `GET /resident/reports/{reportId}/images/{imageId}` | UUID path | 200 JPEG/PNG bytes, `Cache-Control: private, no-store` | 401, 404 missing or not owned, 503 storage unavailable |

Example submission:

```text
POST /resident/reports
Content-Type: multipart/form-data

estateId=<assigned-estate-uuid>
title=Leaking pipe
description=Water pooling near the lift
locationId=4f34a3f5-5a2d-4de0-945f-7b8704653d8e
images=<JPEG file>
```

The server trims the title and rejects missing, blank or titles longer than 50 characters before uploading images or creating a report. Response DTOs and the database retain capacity for historical titles up to 150 characters; those titles remain readable without truncation. It sets `SUBMITTED`, the submitter and timestamps. It rechecks the assignment and location inside the write transaction after uploading validated images. Ownership is part of the detail and image database queries, so inaccessible identifiers return the same 404 as unknown ones. List cursors encode the `(createdAt, id)` key; the client treats them as opaque.

Migration `20261013135000_resident_report_title` adds a required `VARCHAR(150)` title without a default. Existing rows receive the first 150 characters of their trimmed descriptions, or `Fault report` for blank descriptions. IDs, original descriptions, images and timestamps are retained. This migration is verified on disposable Postgres and applied to the configured Neon dev database; Prisma and jOOQ have been regenerated. Other environments must apply it together with the updated API; the previous API cannot insert reports into the new schema without a title.

Resident memberships are provisioned through Manager invitations or explicit
estate role changes. A user may hold RESIDENT membership in several estates.
The context lists active assignments; location queries and submissions require
estateId and validate current membership in that selected estate. Writes lock
and recheck estate/membership after image uploads. Removal in A preserves B and
all report/image history. Migration 20261018093417_estate_role_invitations removes
the global one-resident-estate index and permits MANAGER/CREW; it does not
reclassify existing accounts. The resident-delegation check remains.
Staff report reading/location editing uses the separate
[estate report endpoints](estate-reports.md); these own-history endpoints remain
submitter-only. Corrected locations appear in subsequent resident reads, including
after the resident's assignment is removed. All other report information and
images are retained.

Image storage requires four nonblank server settings: `S3_ENDPOINT` (the R2 S3 API endpoint), `R2_ACCESS_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` (a private bucket accessible to those credentials). For native development, a human adds their values to Infisical's `dev` environment at `/apps/server`, then restarts `pnpm dev:server`. The storage client is created at server startup; missing any setting disables it and image upload/read returns 503 with `Image storage is temporarily unavailable.` The same public error covers storage-provider failures. Reports submitted without images do not require configured storage. Do not enable public bucket access to resolve this error.

R2 uses `S3_ENDPOINT`, `R2_ACCESS_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`; the bucket must be private. Failed uploads are deleted and a bounded scheduled sweep removes old unreferenced objects.
