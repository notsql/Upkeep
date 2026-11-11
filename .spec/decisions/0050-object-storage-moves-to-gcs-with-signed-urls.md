# 0050 — Object storage moves to GCS with signed URLs

Date: 2026-11-11. Status: accepted through the
[object storage spec](../features/object-storage-on-google-cloud-storage.md).

Documents, inspection photos and fault-report photos move from Cloudflare R2
(S3 SDK, three copies of client code) to one private Google Cloud Storage
bucket behind a single port, `com.proj.server.storage.ObjectStorage`. Its only
production implementation is `GcsObjectStorage`; no storage SDK type leaves the
`storage` package. Credentials come from Application Default Credentials, so the
Cloud Run service account needs no keys: it holds `roles/storage.objectAdmin`
on the bucket and Token Creator on itself so it can sign through IAM
`signBlob`. A blank `GCS_BUCKET_NAME` leaves storage off: slots, file-carrying
creates and links answer 503, deletes and sweeps do nothing. Signing failures
are 503 too, never 500. Locally, a non-blank `GCS_CREDENTIALS_JSON` (inline
service-account key, dev only) replaces ADC so signing works without impersonation.

File bytes no longer pass through Spring on the way in or out. Uploads take
three steps: the browser asks Spring for a slot (same permission checks as the
old upload), PUTs the file to a ten-minute V4 signed URL bound to the content
type and size limit, then calls the create endpoint with the object keys as
JSON. Spring rejects keys outside the prefix it issued for that estate, report
or inspection (leaving the object alone), then checks the real size, type and
bytes; on failure it deletes the object. Report and inspection photos are still
decoded and re-encoded, and the clean copy replaces the upload. Unconfirmed
uploads are removed by the existing hourly 24-hour sweeps.

Downloads keep their auth checks and return JSON `{ url, expiresAt }` with a
five-minute signed GET, not a 302. JSON is typed by the generated client, can
be cached until it expires, and drops into `<img src>` or a download link
without CORS or a bearer token; a redirect would need CORS, would lose the
`Authorization` header and could be cached past expiry. Document links make
storage answer with `Content-Disposition: attachment` and the original name.

Durable deletion (decision 0036) is unchanged. Existing R2 objects are not
migrated. Tests use one in-memory `ObjectStorage` fake shared through
`TestcontainersConfiguration`; GCS itself is unit-tested against a mocked
client, with no emulator.
