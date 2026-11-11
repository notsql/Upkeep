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
| `ResidentReportPageResponse` | `items: IssueReportSummaryResponse[]`; `nextCursor: string \| null`; `counts: ReportCounts` (all required) |
| `ReportCounts` | `open: integer`; `inProgress: integer`; `resolved: integer` |
| `EstateError` | `message: string` |

Storage keys, other residents' data and management notes never appear in these DTOs.

`ResidentReportRepository` uses the generated jOOQ tables and typed DSL for every query and insert, including location ancestry, ownership filters and `(createdAt, id)` cursor comparisons. Report timestamps are database-generated, and image metadata retains its database creation-time default. Prisma remains the schema and migration authority.

## Endpoints

| Method and path | Request | Success | Errors |
| --- | --- | --- | --- |
| `GET /resident/context` | None | 200 `ResidentContextResponse`; empty estates and `canSubmit=false` without an active resident membership | 401 |
| `GET /resident/locations` | Required estateId: UUID query | 200 `ResidentLocationResponse[]`; active hierarchy in the selected resident estate; inactive/unassigned estate returns 403 | 400, 401, 403 |
| `POST /resident/reports/image-slots` | JSON `ReportImageSlotRequest`: required `estateId: UUID`, `contentType: string` (JPEG/PNG), `size: int64` (1 byte to 5 MiB); optional `reportId: UUID` from this report's first slot | 201 `UploadSlotResponse` (see [documents.md](documents.md)) with `reportId`; key under `reports/{reportId}/` | 400, 401, 403 missing assignment, 413 image larger than 5 MiB, 415 unsupported image, 503 storage unavailable |
| `POST /resident/reports` | JSON `CreateIssueReportRequest`: required `estateId: UUID`, `title` (1–50 characters after trimming), `description` (1–2,500 characters), `locationId` (UUID of active level or common area); optional `reportId: UUID` and `imageKeys: string[]` (up to 3 keys from the slots, already uploaded; `reportId` is required with keys) | 201 `IssueReportDetailResponse` and `Location: /resident/reports/{id}` | 400 invalid title/text/location/image or a key not uploaded, not issued for this report, or already used; 401, 403 missing assignment, 413 image too large, 415 unsupported image, 503 storage unavailable |
| `GET /resident/reports` | Optional `estateId: UUID`, `cursor: string`, `limit: integer` (1–50, default 20) | 200 `ResidentReportPageResponse`, newest first; caller-owned history, optionally narrowed to an estate, with status `counts` | 400 invalid estate filter/cursor/limit, 401 |
| `GET /resident/reports/{reportId}` | UUID path | 200 `IssueReportDetailResponse` | 401, 404 missing or not owned |
| `GET /resident/reports/{reportId}/images/{imageId}` | UUID path | 200 `SignedDownloadResponse { url, expiresAt }` (five-minute link to the private image), `Cache-Control: private, no-store` | 401, 404 missing or not owned, 503 storage unavailable |

Example submission:

```text
POST /resident/reports/image-slots
{"estateId":"<assigned-estate-uuid>","contentType":"image/jpeg","size":812345}
-> 201 {"objectKey":"reports/<report-uuid>/<image-uuid>","uploadUrl":"https://storage.googleapis.com/...","contentType":"image/jpeg","maxBytes":5242880,"expiresAt":"...","reportId":"<report-uuid>"}

PUT <uploadUrl>   (Content-Type: image/jpeg, x-goog-content-length-range: 0,5242880, body: the photo)

POST /resident/reports
{"estateId":"<assigned-estate-uuid>","reportId":"<report-uuid>","title":"Leaking pipe",
 "description":"Water pooling near the lift","locationId":"4f34a3f5-5a2d-4de0-945f-7b8704653d8e",
 "imageKeys":["reports/<report-uuid>/<image-uuid>"]}
```

Submission also queues the report for routing (`ReportRouting`, `CLASSIFYING`) in the same transaction; see [report-routing.md](report-routing.md). The resident's response and view are unchanged.

The server trims the title and rejects missing, blank or titles longer than 50 characters before touching storage or creating a report. Response DTOs and the database retain capacity for historical titles up to 150 characters; those titles remain readable without truncation. It sets `SUBMITTED`, the submitter and timestamps. Each named photo is checked from storage (real size, type, pixels), re-encoded, and the clean copy replaces the upload; a photo that fails is deleted. It rechecks the assignment and location inside the write transaction, and deletes the photos if that commit fails. Ownership is part of the detail and image database queries, so inaccessible identifiers return the same 404 as unknown ones. List cursors encode the `(createdAt, id)` key; the client treats them as opaque.

Migration `20261013135000_resident_report_title` adds a required `VARCHAR(150)` title without a default. Existing rows receive the first 150 characters of their trimmed descriptions, or `Fault report` for blank descriptions. IDs, original descriptions, images and timestamps are retained. This migration is verified on disposable Postgres and applied to the configured Neon dev database; Prisma and jOOQ have been regenerated. Other environments must apply it together with the updated API; the previous API cannot insert reports into the new schema without a title.

Resident memberships are provisioned through Manager invitations or explicit
estate role changes. A user may hold RESIDENT membership in several estates.
The context lists active assignments; location queries and submissions require
estateId and validate current membership in that selected estate. Writes lock
and recheck estate/membership after the photo checks. Removal in A preserves B and
all report/image history. Migration 20261018093417_estate_role_invitations removes
the global one-resident-estate index and permits MANAGER/CREW; it does not
reclassify existing accounts. The resident-delegation check remains.
Staff report reading/location editing uses the separate
[estate report endpoints](estate-reports.md); these own-history endpoints remain
submitter-only. Corrected locations appear in subsequent resident reads, including
after the resident's assignment is removed. All other report information and
images are retained.

Images are stored in the private Google Cloud Storage bucket named by `GCS_BUCKET_NAME` (`app.storage.bucket`, decision 0050), reached with Application Default Credentials. A human adds the value to Infisical's `dev` environment at `/apps/server` and restarts `pnpm dev:server`; signing locally also needs credentials that can sign (a service-account key or impersonation). With a blank bucket, image slots, report submissions with images and image links return 503 with `File storage is temporarily unavailable. Try again later.`; the same public error covers provider and signing failures. Reports submitted without images do not need storage. Do not make the bucket public to resolve this error.

An hourly sweep deletes objects under `reports/` older than 24 hours that no report references, which also removes photos uploaded but never submitted. `DispatchDeliveryJob` reads report photos through the same storage port to attach them to contractor emails.


## Report counts

`GET /resident/reports` also returns `counts`, totals over **every** report the
caller submitted (all pages, not just the returned page), narrowed by `estateId`
when given. Status mapping: `SUBMITTED` → `open`; `ASSIGNED` and `IN_PROGRESS`
→ `inProgress`; `CLOSED` → `resolved`. Cursor and `limit` do not affect them.
Example: `{"items":[…],"nextCursor":null,"counts":{"open":2,"inProgress":1,"resolved":4}}`.
The resident dashboard at `/` reads these.

## Estate-scoped personal history

`GET /resident/reports?estateId=<UUID>` applies the optional estate condition and
current-subject ownership before cursor pagination. Omit estateId for history
across all estates. Unknown estates or estates with no caller-owned reports return
an empty page without revealing other residents' records. Malformed UUIDs return
400. Current membership is not required for reading owned historical reports,
including after moving out or estate deactivation; filtering grants no submission
or management permission.

New opaque v1 cursors include the estate scope (or all), creation timestamp and
report ID. Reusing a cursor for another estate or between filtered/unfiltered
history returns 400. Legacy timestamp/ID cursors remain accepted only for the
unfiltered list. No database migration is required for this filter.
