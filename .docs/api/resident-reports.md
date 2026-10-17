# Resident fault reports API

`packages/api/openapi.json` is the contract source. WorkOS JWTs authenticate identity; `EstateUser.role = RESIDENT` supplies the current reporting estate. JWT resident claims grant no estate permissions. A user may report in one estate and manage another through its own owner/MEMBER/COUNCIL permissions. Missing or invalid authentication returns 401. The reporting controller requires a real JWT principal even in development without an issuer.

Creation requires an active resident membership and active estate. List, detail and private images require only authenticated subject and report ownership, including after membership deletion, a move or role conversion. Estate ownership and platform administration grant no access to other users' reports. See [access.md](access.md) for the access projection and admin membership contract.

## DTOs

| DTO | Fields |
| --- | --- |
| `ResidentContextResponse` | `estate: { id: UUID, name: string } \| null`; `canSubmit: boolean` |
| `ResidentLocationResponse` | `id: UUID`; `type: string` (`BLOCK`, `LEVEL`, `COMMON_AREA`); `name: string`; `parentId: UUID \| null`; `sortOrder: integer \| null` |
| `IssueReportSummaryResponse` | `id: UUID`; `title: string` (1–150 characters); `description: string`; `estateName: string`; `location: { id: UUID, label: string }`; `status: string`; `createdAt: date-time`; `updatedAt: date-time` |
| `IssueReportDetailResponse` | Summary fields plus `images: { id: UUID, contentType: string }[]` |
| `IssueReportPageResponse` | `items: IssueReportSummaryResponse[]`; `nextCursor: string \| null` |
| `EstateError` | `message: string` |

Storage keys, other residents' data and management notes never appear in these DTOs.

## Endpoints

| Method and path | Request | Success | Errors |
| --- | --- | --- | --- |
| `GET /resident/context` | None | 200 `ResidentContextResponse`; null estate and `canSubmit=false` without an active resident membership | 401 |
| `GET /resident/locations` | None | 200 `ResidentLocationResponse[]`; active hierarchy in the assigned active estate, or `[]` when its estate is inactive; no membership returns 403 | 401, 403 |
| `POST /resident/reports` | `multipart/form-data`: required `title` (1–50 characters after trimming), required `description` (1–2,500 characters), required `locationId` (UUID of active level or common area), optional repeated `images` (up to 3 JPEG/PNG files, 5 MB each, 4,032 × 3,024 maximum) | 201 `IssueReportDetailResponse` and `Location: /resident/reports/{id}` | 400 invalid title/text/location/image, 401, 403 missing assignment, 413 upload too large, 415 unsupported image, 503 image storage unavailable |
| `GET /resident/reports` | Optional `cursor: string`, `limit: integer` (1–50, default 20) | 200 `IssueReportPageResponse`, newest first | 400 invalid cursor/limit, 401 |
| `GET /resident/reports/{reportId}` | UUID path | 200 `IssueReportDetailResponse` | 401, 404 missing or not owned |
| `GET /resident/reports/{reportId}/images/{imageId}` | UUID path | 200 JPEG/PNG bytes, `Cache-Control: private, no-store` | 401, 404 missing or not owned, 503 storage unavailable |

Example submission:

```text
POST /resident/reports
Content-Type: multipart/form-data

title=Leaking pipe
description=Water pooling near the lift
locationId=4f34a3f5-5a2d-4de0-945f-7b8704653d8e
images=<JPEG file>
```

The server trims the title and rejects missing, blank or titles longer than 50 characters before uploading images or creating a report. Response DTOs and the database retain capacity for historical titles up to 150 characters; those titles remain readable without truncation. It sets `SUBMITTED`, the submitter and timestamps. It rechecks the assignment and location inside the write transaction after uploading validated images. Ownership is part of the detail and image database queries, so inaccessible identifiers return the same 404 as unknown ones. List cursors encode the `(createdAt, id)` key; the client treats them as opaque.

Migration `20261013135000_resident_report_title` adds a required `VARCHAR(150)` title without a default. Existing rows receive the first 150 characters of their trimmed descriptions, or `Fault report` for blank descriptions. IDs, original descriptions, images and timestamps are retained. This migration is verified on disposable Postgres and applied to the configured Neon dev database; Prisma and jOOQ have been regenerated. Other environments must apply it together with the updated API; the previous API cannot insert reports into the new schema without a title.

Resident memberships are manually provisioned as `EstateUser` rows with role `RESIDENT`. Deletion revokes creation immediately without deleting history. The partial unique index permits one resident estate per user; a check prohibits resident invitation delegation. Migration `20261013090000_resident_membership_expand` backfills unrevoked assignments, rejecting conflicting grants; `20261013090100_resident_membership_contract` removes the legacy assignment table. They are verified on migrated disposable Postgres databases; both have been applied to the configured Neon dev database, and the current database sources have been regenerated.

Image storage requires four nonblank server settings: `S3_ENDPOINT` (the R2 S3 API endpoint), `R2_ACCESS_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME` (a private bucket accessible to those credentials). For native development, a human adds their values to Infisical's `dev` environment at `/apps/server`, then restarts `pnpm dev:server`. The storage client is created at server startup; missing any setting disables it and image upload/read returns 503 with `Image storage is temporarily unavailable.` The same public error covers storage-provider failures. Reports submitted without images do not require configured storage. Do not enable public bucket access to resolve this error.

R2 uses `S3_ENDPOINT`, `R2_ACCESS_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`; the bucket must be private. Failed uploads are deleted and a bounded scheduled sweep removes old unreferenced objects.
