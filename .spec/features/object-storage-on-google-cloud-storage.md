# Object storage on Google Cloud Storage

**Status:** agreed
**Owner:** Ong Zheng Kai

## Problem

Documents, inspection photos and fault-report photos are stored in Cloudflare
R2 through its S3 emulation (`software.amazon.awssdk:s3`). Three classes -
`document/DocumentStore`, `inspection/InspectionImageStore` and
`resident/ResidentImageStore` - each build and configure their own `S3Client`,
so the same connection, error and "not configured" code exists three times.
SDK types leak past the stores: `DocumentStore.list()` returns
`ListObjectsV2Response`, which `DocumentService` reads directly. Tests stub
the S3 client by hand in two different ways.

Every upload and download also streams the file's bytes through Spring
(multipart in, `byte[]` out). This ties up Cloud Run memory and request time
for files up to 5 MB, and the web app turns each response into a blob URL by
hand.

The API already runs on Cloud Run under a GCP service account
(`vars.GCP_API_RUNTIME_SA`, `.github/workflows/deploy.yml`), yet production
gets no storage credentials today, so storage is effectively off in `prd`.
Google Cloud Storage can be reached with that identity and no long-lived keys,
which removes a second cloud provider and its secrets.

## Design

**One storage port.** `com.proj.server.storage.ObjectStorage` covers put,
get, metadata, delete, list by prefix, and signed upload and download URLs.
Its result types do not depend on any storage provider. It has a single
implementation, built on `com.google.cloud:google-cloud-storage`.

**The bucket stays private.** A signed URL is the normal way to reach a
private bucket: each one grants a single operation on a single object for a
few minutes. Nothing is ever public.

**Upload (three steps).**
1. The web app asks Spring for an upload slot. Spring checks the same
   permissions the old upload endpoint checked, picks the object key, and
   returns `{ objectKey, uploadUrl, contentType, expiresAt }`. `uploadUrl` is
   a V4 signed `PUT` URL valid for 10 minutes. It is signed over `Content-Type`
   and `x-goog-content-length-range: 0,<max>`, so GCS rejects any other type,
   or a body over the size limit.
2. The browser sends the file directly to GCS with a `PUT` to `uploadUrl`,
   using those exact headers.
3. The web app calls the existing create endpoint as JSON, passing the object
   keys. Spring reads each object's metadata and checks that it exists, that
   the size is within the limit, that the content type is allowed, and that
   the key is under the prefix it handed out for this caller. Validation that
   needs the actual bytes reads the object back through the port. This covers
   `ResidentImageValidator`, which decodes pixels to check dimensions, and the
   document signature check (PDF/JPEG/PNG magic bytes). If any check fails,
   Spring deletes the object and returns the same 4xx as today. Only then does
   it commit the row.

If an object is uploaded but never confirmed, it has no row. The existing
hourly sweeps already delete objects with no row once they are older than
24 hours, so no new cleanup is needed.

**Download.** The existing content endpoints keep their exact auth checks.
Instead of returning bytes, they return JSON
`{ url, expiresAt }`. `url` is a V4 signed `GET` URL valid for 5 minutes.
For documents it also carries `response-content-disposition=attachment;
filename="<original name>"`, and for all files `response-content-type`.
JSON is better than a 302 redirect here:
- `openapi-fetch` and React Query can type it and cache it until `expiresAt`.
- It drops straight into `<img src>` and `<a href download>`. The browser
  loads it as a plain navigation or image request, so it needs no CORS and no
  bearer token.
- A 302 would make the API call follow a redirect across origins, which needs
  CORS on GET and loses the `Authorization` header. A redirect can also be
  cached past the URL's expiry.

**Signing credentials.** Credentials come from Application Default
Credentials (ADC), with no access keys.
- **Cloud Run:** ADC there has no private key, so the client signs through
  the IAM `signBlob` API. The runtime SA therefore needs
  `roles/iam.serviceAccountTokenCreator` *on itself*.
- **Locally:** either `GOOGLE_APPLICATION_CREDENTIALS` points at a
  service-account key file (which signs locally), or the developer runs
  `gcloud auth application-default login` while impersonating a service
  account they hold Token Creator on. Plain user credentials cannot sign.
  In dev, Infisical's `GCS_CREDENTIALS_JSON` (`app.storage.credentials-json`)
  carries the key inline and takes precedence over ADC; prod never sets it.

**Server-side reads stay on the port.** `routing/DispatchDeliveryJob` attaches
report images to contractor work-order emails, and it reads them with
`ObjectStorage.get`. Fault classification (decisions 0047/0049) reads report
text, not images. If it ever needs images, it uses the same port.

## Behaviour

Storage port

- There is exactly one storage abstraction, `ObjectStorage`, in
  `com.proj.server.storage`, with these operations:
  - put
  - get, which returns the bytes and content type, or "not found"
  - metadata, which returns the size and content type, or "not found"
  - delete
  - list by prefix, which returns each key and its last-modified time
  - sign upload, given a key, a content type, a maximum size and a TTL
  - sign download, given a key, a TTL and an optional disposition
- No type from a storage SDK appears in any class outside
  `com.proj.server.storage`.
- There is exactly one production implementation, backed by GCS; no class
  builds an `S3Client`.
- `DocumentStore`, `InspectionImageStore` and `ResidentImageStore` either use
  `ObjectStorage` or are removed in its favour; none holds its own client.
- Object keys are unchanged: `documents/{estateId}/{uuid}`,
  `inspections/{inspectionId}/{imageId}`, `reports/{reportId}/{imageId}`, all
  in one bucket.

Upload slots

- An upload-slot request by a caller who could not use the old upload
  endpoint gets the same 401/403/404/409 as before, and no URL.
- An upload slot for a content type outside the feature's allowed list is 415;
  a declared size over the feature's limit is 413.
- The signed upload URL expires 10 minutes after it is issued.
- The signed upload URL only accepts a `PUT` with the issued `Content-Type`
  and a body no larger than the feature's limit. These are enforced by GCS
  through the signed headers.
- Each slot returns a fresh key. For reports and inspections, the key's
  record id is fixed when the slot is issued, and the create call must use
  that same id.

Confirming (create)

- A create call that names a key with no object behind it is 400, and no row
  is written.
- A create call that names a key the caller was not issued, outside the
  prefix for this estate, report or inspection, is 400. No row is written and
  the object is left alone.
- A create call whose object's actual size or content type breaks the limits
  is 413/415. The object is deleted and no row is written.
- A report image that fails `ResidentImageValidator`'s pixel checks, which run
  on bytes read from storage, is 400. The object is deleted and no row is
  written.
- A document whose bytes fail the signature check is 415. The object is
  deleted and no row is written.
- If the row commit fails after the checks pass, the objects are deleted, as
  today.
- An object that is uploaded but never confirmed is deleted by the hourly
  sweep once it is more than 24 hours old, and is kept until then.

Downloads

- Each content endpoint applies the same auth checks as before, and returns
  401/403/404 in the same cases.
- On success it returns 200 with `{ url, expiresAt }`, with
  `Cache-Control: private, no-store`, and with `expiresAt` 5 minutes after
  issue.
- The document download URL makes GCS respond with
  `Content-Disposition: attachment; filename="<original file name>"`.
- No content endpoint returns file bytes.

Configuration, credentials, failure

- The bucket comes from `app.storage.bucket` (`GCS_BUCKET_NAME`).
  `app.storage.project-id` (`GCS_PROJECT_ID`) is optional and falls back to
  ADC.
- The `app.r2.*` properties and the `S3_ENDPOINT`, `R2_ACCESS_ID`,
  `R2_SECRET_ACCESS_KEY` and `R2_BUCKET_NAME` variables no longer exist.
- With a blank bucket the app starts and storage counts as "not configured".
  Upload slots, creates that carry files, and content endpoints then answer
  503 "storage temporarily unavailable". Deletes and sweeps do nothing.
- Signing failures (for example, a missing Token Creator role) also answer
  503 "storage temporarily unavailable". They are not 500s.

Unchanged behaviour (existing tests, adapted to the new flow, still pass)

- Durable deletion (decision 0036) does not change:
  1. The soft-delete marker is written first.
  2. The object is deleted second.
  3. `storageDeletedAt` is set only after the delete succeeds.
  If the delete fails, it is retried later.
- The hourly sweeps keep their prefixes and their 24-hour rule.
- Deleting a key that no longer exists counts as success.

Tests

- One in-memory `ObjectStorage` fake replaces three test doubles, and is shared
  through test support:
  - `DocumentR2Stub`
  - the inline S3 stub in `InspectionPhotosIntegrationTests`
  - the Mockito mocks of `ResidentImageStore`
- The fake has two failure switches: `unavailable` makes every operation fail,
  and `deletionUnavailable` makes only delete fail. Its signed URLs are
  recognisable fake strings that carry the key, content type, maximum size
  and expiry, so tests can assert on them.
- Integration tests "upload" a file by putting it into the fake under the
  issued key, then calling create.
- The GCS implementation is not run against a real bucket or an emulator
  container.

Dependencies and deploy

- `software.amazon.awssdk:s3` is removed from `apps/server/pom.xml`.
  `com.google.cloud:google-cloud-storage` is added, with its version managed
  by importing `com.google.cloud:libraries-bom`. A human adds and resolves
  this dependency (AGENTS.md rule 1).
- `deploy.yml` passes `GCS_BUCKET_NAME` to `upkeep-server-prd`.
- The production bucket has uniform bucket-level access, enforces public
  access prevention, and has no public ACLs.
- R2 secrets are removed from Infisical, the `.env.example` files and the
  docs.

## Human setup steps

1. Create the bucket in `asia-southeast1`. Turn on uniform bucket-level
   access and enforce public access prevention.
2. Grant the runtime SA `roles/storage.objectAdmin` on that bucket only.
3. Grant the runtime SA `roles/iam.serviceAccountTokenCreator` on itself, so
   that it can call `signBlob`.
4. Set bucket CORS (`gcloud storage buckets update --cors-file`) as follows:
   - Origins: `http://localhost:3001` and the production web origin.
   - Methods: `PUT` and `GET`.
   - Response headers: `Content-Type` and `x-goog-content-length-range`.
   - `maxAgeSeconds` 3600.
5. Add `GCS_BUCKET_NAME` (and `GCS_PROJECT_ID` if needed) to Infisical
   `/apps/server` and as a GitHub variable for `deploy.yml`, then delete the
   R2 secrets.
6. Give developers ADC that can sign: either a dev service-account key file,
   or Token Creator on a dev SA to impersonate.

## Data

No Prisma change. Existing key columns and `storageDeletedAt` keep their
meaning.

## API

This **is** a contract change. Run `pnpm api:generate`, and fix the web call
sites in the same PR.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| POST | `/estates/{estateId}/documents/upload-slots` | `DocumentUploadSlotRequest { fileName: string, contentType: string, size: int64 }` | 201 `UploadSlotResponse { objectKey: string, uploadUrl: string, contentType: string, maxBytes: int64, expiresAt: date-time }`; 401/403/409/413/415/503 | Same as `uploadDocument` |
| POST | `/estates/{estateId}/documents` (`uploadDocument`) | was multipart; now JSON `CreateDocumentRequest { objectKey: string, fileName: string, ...existing metadata fields }` | 201 `DocumentResponse` (unchanged); 400/409/413/415/503 | unchanged |
| GET | `/estates/{estateId}/documents/{documentId}/content` | - | was `byte[]`; now 200 `SignedDownloadResponse { url: string, expiresAt: date-time }`; 401/403/404/503 | unchanged |
| POST | `/estates/{estateId}/assets/{assetId}/inspections/photo-slots` | `ImageUploadSlotRequest { contentType: string, size: int64 }` (one per photo) | 201 `UploadSlotResponse` (`objectKey` under `inspections/{inspectionId}/`, plus `inspectionId: uuid`) | Same as `createInspectionResult` |
| POST | `/estates/{estateId}/assets/{assetId}/inspections` (`createInspectionResult`) | was multipart; now JSON `CreateInspectionRequest { inspectionId: uuid, outcome, inspectedOn, notes, expectedLocationId, photoKeys: string[] }` | 201 `InspectionResultResponse` (unchanged); 400/413/415/503 | unchanged |
| GET | `/estates/{estateId}/assets/{assetId}/inspections/{inspectionId}/photos/{photoId}` | - | was image bytes; now 200 `SignedDownloadResponse` | unchanged |
| POST | `/resident/reports/image-slots` | `ImageUploadSlotRequest { estateId: uuid, contentType: string, size: int64 }` | 201 `UploadSlotResponse` (`objectKey` under `reports/{reportId}/`, plus `reportId: uuid`) | Same as `createResidentReport` |
| POST | `/resident/reports` (`createResidentReport`) | was multipart; now JSON `CreateIssueReportRequest { reportId: uuid, ...existing fields, imageKeys: string[] (max 3) }` | 201 `IssueReportDetailResponse` (unchanged); 400/401/403/413/415/503 | unchanged |
| GET | `/resident/reports/{reportId}/images/{imageId}` (`getResidentReportImage`) | - | was image bytes; now 200 `SignedDownloadResponse` | unchanged |
| GET | `/estates/{estateId}/reports/{reportId}/images/{imageId}` (`getEstateReportImage`) | - | was image bytes; now 200 `SignedDownloadResponse` | unchanged |

When an inspection or report has several photos, the web app asks for the
first slot without an id and passes the returned
`inspectionId`/`reportId` into the later slot requests. This keeps all keys
under one prefix.

## Frontend

- `apps/web/src/lib/documents.ts`, `inspections.ts`, `reports.ts` and
  `estate-reports.ts` currently fetch content with `parseAs: "blob"` and call
  `URL.createObjectURL`. They change to:
  - query the content endpoint for `{ url, expiresAt }` and use `url`
    directly in `<img src>` or `<a href download>`;
  - set `staleTime` to just under `expiresAt`, so the URL is refetched before
    it expires;
  - drop the `revokeObjectURL` cleanup.
- The upload mutations (document upload, inspection create, resident report
  create) each run three steps: request a slot, send the file to GCS with a
  plain `fetch` `PUT` (the only raw fetch this allows, because the target is
  the GCS URL and not our API), then call create with the keys. If the `PUT`
  fails, the mutation fails and nothing is created.
- `reading-imports.ts` and `asset-history.ts` also use `parseAs: "blob"`, but
  not for stored objects, so they are untouched.
- Update the matching `.docs/frontend/*.md` and `.docs/api/*.md` files.

## Rollout (expand/contract)

Only `apps/web` calls the multipart and byte-returning endpoints, and both
apps deploy from `main`. The old forms are therefore replaced in the same PR,
with no parallel proxy endpoints.

There is one window where the new server is live but the old web bundle
(Workers Builds) is still being served, or the reverse. During that window
uploads and image views break for a few minutes. This is accepted rather than
built around. Storage is already off in `prd` today, so nothing that works now
gets worse.

## Edge cases

- A signed URL expires while a page stays open: the query refetches before
  `expiresAt`. A download link clicked after expiry gets a 403 from GCS, and
  the next render fixes it.
- A client sends a different `Content-Type` or a bigger body than it
  declared: GCS rejects the `PUT`, because the headers are signed. Create
  re-checks the real metadata anyway.
- A client creates with someone else's key: the prefix check rejects it, and
  the object is not deleted.
- The same key is confirmed twice: the second create fails on the existing
  row's unique key, and the object stays with the first row.
- A list call with more results than one page returns: the port pages through
  every result, so sweeps see all objects.
- The bucket is set, but ADC is missing or cannot sign: the response is 503,
  and the app still starts.
- Rows that point to objects existing only in R2 get a signed URL that 404s at
  GCS, because the data is not migrated.

## Out of scope

- Migrating existing R2 objects. If that is ever wanted, it is a one-off
  manual `rclone`/`gcloud storage` copy.
- Resumable uploads, and files larger than today's limits.
- Running fault classification on images.
- A GCS emulator, per-feature buckets, lifecycle rules, a CDN or object
  versioning.
- Provisioning with Terraform or scripts. The human setup steps above are
  done once by hand.

When this is built, record the change in
`.spec/decisions/0050-object-storage-moves-to-gcs.md`, covering GCS, signed
URLs, and JSON instead of redirects. Do not write it yet.

## Open questions

- What is the dev bucket name and GCP project: the same project as `prd`, or
  a separate one?
- Does dev use one shared bucket, or a key prefix per developer?
- Should existing dev objects in R2 be copied across, or dropped?
- How do developers sign locally: a shared dev SA key file, or impersonation?
- What is the exact production web origin for the CORS config?
