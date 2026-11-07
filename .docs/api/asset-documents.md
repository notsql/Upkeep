# Asset document association (ID-25)

Source of truth: `packages/api/openapi.json`, generated from
`AssetDocumentController`. Existing uploads link by document UUID; linking does
not upload, extract or verify a file.

## Authority and errors

Every endpoint requires an authenticated identity, including local open-security
mode. Association reads and attachment lists require ordinary asset-register
authority (currently estate ownership) plus `VIEW_DOCUMENTS`. Writes use the
same live ownership check as ordinary asset editing and require an active estate;
they do not additionally require `EDIT_DOCUMENTS`. Document-only Council/custom
roles, Managers and Crew do not gain asset authority through document or
inspection access. Existing document download and deletion rules remain intact.

Retirement permits both linking and unlinking. Inactive estates retain reads but
reject writes, including no-ops. Responses use `Cache-Control: private, no-store`.

Errors return `EstateError { message: string }`: 400 malformed UUID, omitted target,
invalid body/version/cursor/limit; 401 missing identity; 403 denied asset/document
authority; 404 inaccessible estate or missing/foreign/deleted record; 409 inactive
estate, stale version, attempted direct reassignment or conflicting work-order
asset; 500 persistence failure. The authentication filter may return 401 without
JSON. Errors do not expose SQL, storage keys or user identity subjects.

## Endpoints

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| GET | `/estates/{estateId}/documents/{documentId}/asset` | UUID path parameters | 200 `DocumentAssetResponse`, including unlinked state |
| PUT | `/estates/{estateId}/documents/{documentId}/asset` | `ChangeDocumentAssetRequest` | 200 `DocumentAssetResponse`, including current-version no-ops |
| GET | `/estates/{estateId}/assets/{assetId}/documents` | UUID path parameters; optional opaque `cursor`, `limit: integer` 1–100, default 25 | 200 `DocumentPageResponse` |

The picker reuses the existing
[`GET /estates/{estateId}/assets`](assets.md) with `q`, `category`, `locationId`,
`condition` and `status` filters, initially `status=ALL`. Search/filter semantics
and asset response fields remain unchanged.

`ChangeDocumentAssetRequest` has two required keys:

- `assetId: UUID | null`: UUID links; explicit null unlinks. Omission is a 400.
- `expectedAssociationVersion: integer >= 0`: JSON integers only; fractional,
  string and null versions are rejected.

`DocumentAssetResponse` has required fields:

- `documentId: UUID` and `associationVersion: integer`.
- `assetId: UUID | null`, `assetReference: string | null`,
  `assetName: string | null`.
- `changedAt: ISO-8601 timestamp | null`: initially null; retained after unlink
  as the time of the latest real association change.

`DocumentPageResponse` reuses [the document contract](documents.md): required
`items: DocumentResponse[]` and optional/nullable `nextCursor: string | null`.
Each `DocumentResponse` contains required `id: UUID`, `estateId: UUID`,
`documentType: "INVOICE" | "SERVICE_REPORT"`, `originalFilename: string`,
`contentType: string`, `sizeBytes: integer`, `createdAt: ISO-8601 timestamp` and
`canDelete: boolean`. Lists exclude deleted documents, sort by upload time then
UUID descending, and bind cursors to the estate, asset and attachment kind.
Downloads reuse authenticated `GET /estates/{estateId}/documents/{documentId}/content`.

Example initial link:

```json
{"assetId":"00000000-0000-0000-0000-000000000003","expectedAssociationVersion":0}
```

Unlink after reviewing version 1:

```json
{"assetId":null,"expectedAssociationVersion":1}
```

## Persistence and consistency

A document has at most one asset; an asset has many documents. A composite
`(assetId, estateId)` foreign key enforces same-estate links. Existing uploads
start unlinked at version 0. Real changes increment
`Document.assetAssociationVersion` and record actor/time atomically. That version
is independent of the work-order association version. Current-version no-ops
preserve version and change attribution; stale requests conflict even if they
repeat an earlier successful target.

Writes lock estate, then document, matching deletion and work-order association
writes. A failed write preserves the previous link/version/attribution. Moving
to another asset requires unlink then link; direct replacement returns 409.

Both asset and work-order association writes reject different non-null document
and work-order asset IDs. Either absent asset is allowed, and linking never
assigns an asset to the work order. Unlinking retains the file, metadata and
work-order link. No association action touches R2, equipment fields, condition,
maintenance/cost records or work-order state/completion.

Relocation and retirement retain links by UUID. Existing authorized soft deletion
retains the internal document/link while removing it from current attachment
and content access. See decision [0041](../../.spec/decisions/0041-asset-document-associations.md).
