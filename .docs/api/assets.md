# Assets API

Contract: `packages/api/openapi.json`. All asset endpoints require bearer JWT and estate ownership. Missing authentication returns 401; foreign or missing resources return 404. Writes require an active estate and lock estate before asset. No invitation-role dependency.

## GET `/estates/{estateId}/assets`

- path `estateId`: uuid (required)
- query `q`: string (optional)
- query `category`: string (optional)
- query `locationId`: uuid (optional)
- query `condition`: GOOD / NEEDS_ATTENTION / FAULTY / UNASSESSED (optional)
- query `status`: ACTIVE / INACTIVE / ALL (optional)
- 400: Invalid request or wrong confirmation reference — EstateError
- 401: Sign in required — EstateError
- 404: Estate, asset or location not found — EstateError
- 409: Inactive estate, asset or location, or a conflicting change — EstateError
- 200: Asset register — AssetResponse[]

## POST `/estates/{estateId}/assets`

- path `estateId`: uuid (required)
- Body: CreateAssetRequest
- 400: Invalid request or wrong confirmation reference — EstateError
- 401: Sign in required — EstateError
- 404: Estate, asset or location not found — EstateError
- 409: Inactive estate, asset or location, or a conflicting change — EstateError
- 201: Asset registered with a generated reference — AssetResponse

## POST `/estates/{estateId}/assets/{id}/restore`

- path `estateId`: uuid (required)
- path `id`: uuid (required)
- Body: RestoreAssetRequest
- 400: Invalid request or wrong confirmation reference — EstateError
- 401: Sign in required — EstateError
- 404: Estate, asset or location not found — EstateError
- 409: Inactive estate, asset or location, or a conflicting change — EstateError
- 200: Asset restored — AssetResponse

## POST `/estates/{estateId}/assets/{id}/deactivate`

- path `estateId`: uuid (required)
- path `id`: uuid (required)
- Body: DeactivateAssetRequest
- 400: Invalid request or wrong confirmation reference — EstateError
- 401: Sign in required — EstateError
- 404: Estate, asset or location not found — EstateError
- 409: Inactive estate, asset or location, or a conflicting change — EstateError
- 200: Asset deactivated — AssetResponse

## GET `/estates/{estateId}/assets/{assetId}/devices`

- path `estateId`: uuid (required)
- path `assetId`: uuid (required)
- 400: Missing or invalid details, or an unsupported metric — EstateError
- 401: Sign in required — EstateError
- 404: Estate, asset, location or device not found — EstateError
- 409: Duplicate identifier, or an inactive estate, asset or location — EstateError
- 200: The asset's devices, newest first — DeviceResponse[]

## POST `/estates/{estateId}/assets/{assetId}/devices`

- path `estateId`: uuid (required)
- path `assetId`: uuid (required)
- Body: CreateDeviceRequest
- 400: Missing or invalid details, or an unsupported metric — EstateError
- 401: Sign in required — EstateError
- 404: Estate, asset, location or device not found — EstateError
- 409: Duplicate identifier, or an inactive estate, asset or location — EstateError
- 201: Device registered, awaiting its first reading — DeviceResponse

## POST `/estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential`

Owner only. No body. See "Device credentials" below.

- path `estateId`: uuid (required)
- path `assetId`: uuid (required)
- path `deviceId`: uuid (required)
- 400: Missing or invalid details, or an unsupported metric — EstateError
- 401: Sign in required — EstateError
- 404: Estate, asset, location or device not found — EstateError
- 409: Duplicate identifier, or an inactive estate, asset or location — EstateError
- 201: New API key, shown only this once. Replaces and revokes any earlier key. — DeviceCredentialResponse

## GET `/estates/{estateId}/assets/{assetId}/assessments`

- path `estateId`: uuid (required)
- path `assetId`: uuid (required)
- 400: Missing or invalid details, or a date in the future — EstateError
- 401: Sign in required — EstateError
- 404: Estate or asset not found — EstateError
- 409: Inactive estate or deactivated asset — EstateError
- 200: Every assessment, current condition first — AssetAssessmentResponse[]

## POST `/estates/{estateId}/assets/{assetId}/assessments`

- path `estateId`: uuid (required)
- path `assetId`: uuid (required)
- Body: CreateAssetAssessmentRequest
- 400: Missing or invalid details, or a date in the future — EstateError
- 401: Sign in required — EstateError
- 404: Estate or asset not found — EstateError
- 409: Inactive estate or deactivated asset — EstateError
- 201: Assessment recorded — AssetAssessmentResponse

## GET `/estates/{estateId}/assets/{id}`

- path `estateId`: uuid (required)
- path `id`: uuid (required)
- 400: Invalid request or wrong confirmation reference — EstateError
- 401: Sign in required — EstateError
- 404: Estate, asset or location not found — EstateError
- 409: Inactive estate, asset or location, or a conflicting change — EstateError
- 200: Asset details, including deactivated assets — AssetResponse

## PATCH `/estates/{estateId}/assets/{id}`

- path `estateId`: uuid (required)
- path `id`: uuid (required)
- Body: UpdateAssetRequest
- 400: Invalid request or wrong confirmation reference — EstateError
- 401: Sign in required — EstateError
- 404: Estate, asset or location not found — EstateError
- 409: Inactive estate, asset or location, or a conflicting change — EstateError
- 200: Asset updated or moved — AssetResponse

## PATCH `/estates/{estateId}/assets/{id}/retirement`

- path `estateId`: uuid (required)
- path `id`: uuid (required)
- Body: RetirementCorrectionRequest
- 400: Invalid request or wrong confirmation reference — EstateError
- 401: Sign in required — EstateError
- 404: Estate, asset or location not found — EstateError
- 409: Inactive estate, asset or location, or a conflicting change — EstateError
- 200: Retirement information corrected — AssetResponse

## GET `/estates/{estateId}/assets/{id}/lifecycle-events`

- path `estateId`: uuid (required)
- path `id`: uuid (required)
- 400: Invalid request or wrong confirmation reference — EstateError
- 401: Sign in required — EstateError
- 404: Estate, asset or location not found — EstateError
- 409: Inactive estate, asset or location, or a conflicting change — EstateError
- 200: Asset lifecycle history, newest first — AssetLifecycleEventResponse[]

## AssetAssessmentResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| id | uuid | yes |  |
| assetId | uuid | yes |  |
| condition | GOOD / NEEDS_ATTENTION / FAULTY | yes |  |
| assessedOn | date | yes |  |
| notes | string | yes |  |
| recordedByUserId | string | yes |  |
| recordedByName | string / null | no |  |
| recordedAt | date-time | yes |  |

## AssetLifecycleEventResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| id | uuid | yes |  |
| action | string | yes |  |
| occurredAt | date-time | yes |  |
| actorUserId | string | yes |  |
| previousDeactivatedAt | date-time | no |  |
| previousRetiredOn | date | no |  |
| previousRetirementReason | string / null | no |  |
| deactivatedAt | date-time | no |  |
| retiredOn | date | no |  |
| retirementReason | string / null | no |  |
| lifecycleVersion | int32 | yes |  |

## AssetResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| id | uuid | yes |  |
| estateId | uuid | yes |  |
| reference | string | yes |  |
| name | string | yes |  |
| category | string | yes |  |
| locationId | uuid | yes |  |
| locationPath | string | yes |  |
| installedOn | date | no |  |
| manufacturer | string / null | no |  |
| model | string / null | no |  |
| serialNumber | string / null | no |  |
| createdAt | date-time | yes |  |
| updatedAt | date-time | yes |  |
| deactivatedAt | date-time | no |  |
| retiredOn | date | no |  |
| retirementReason | string / null | no |  |
| lifecycleVersion | int32 | yes |  |
| currentCondition | GOOD / NEEDS_ATTENTION / FAULTY | no |  |

## CreateAssetAssessmentRequest

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| condition | GOOD / NEEDS_ATTENTION / FAULTY | yes |  |
| assessedOn | date | yes |  |
| notes | string | yes | minLength=0, maxLength=2000 |

## CreateAssetRequest

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| name | string | yes | minLength=0, maxLength=200 |
| category | string | yes | minLength=0, maxLength=30 |
| locationId | uuid | yes |  |
| installedOn | date | no |  |
| manufacturer | string | no | minLength=0, maxLength=200 |
| model | string | no | minLength=0, maxLength=200 |
| serialNumber | string | no | minLength=0, maxLength=200 |

## CreateDeviceRequest

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| identifier | string | yes | minLength=0, maxLength=100 |
| model | string | yes | minLength=0, maxLength=200 |
| locationId | uuid | yes |  |
| metrics | TEMPERATURE / HUMIDITY / PRESSURE / FLOW_RATE / VIBRATION / POWER / ENERGY[] | yes |  |
| reportingIntervalSeconds | int32 | yes | minimum=1, maximum=86400 |

## DeactivateAssetRequest

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| reference | string | yes | minLength=0, maxLength=60 |
| retiredOn | date | yes |  |
| retirementReason | string | yes | minLength=0, maxLength=2000 |
| expectedVersion | int32 | yes | minimum=0 |

## DeviceResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| id | uuid | yes |  |
| estateId | uuid | yes |  |
| assetId | uuid | yes |  |
| locationId | uuid | yes |  |
| identifier | string | yes |  |
| model | string | yes |  |
| metrics | DeviceMetricResponse[] | yes |  |
| reportingIntervalSeconds | int32 | yes |  |
| lastSeenAt | date-time | no |  |
| credentialIssuedAt | date-time | no | null until a key is issued |
| createdAt | date-time | yes |  |
| updatedAt | date-time | yes |  |

## DeviceCredentialResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| deviceId | uuid | yes |  |
| apiKey | string | yes | `^upk_[A-Za-z0-9_-]{43}$`; returned only in this response |
| issuedAt | date-time | yes |  |

## DeviceMetricResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| metric | TEMPERATURE / HUMIDITY / PRESSURE / FLOW_RATE / VIBRATION / POWER / ENERGY | yes |  |
| unit | string | yes |  |

## EstateError

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| message | string | yes |  |

## RestoreAssetRequest

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| reference | string | yes | minLength=0, maxLength=60 |
| expectedVersion | int32 | yes | minimum=0 |

## RetirementCorrectionRequest

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| retiredOn | date | yes |  |
| retirementReason | string | yes | minLength=0, maxLength=2000 |
| expectedVersion | int32 | yes | minimum=0 |

## UpdateAssetRequest

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| name | string | yes | minLength=0, maxLength=200 |
| category | string | yes | minLength=0, maxLength=30 |
| locationId | uuid | yes |  |
| installedOn | date | no |  |
| manufacturer | string | no | minLength=0, maxLength=200 |
| model | string | no | minLength=0, maxLength=200 |
| serialNumber | string | no | minLength=0, maxLength=200 |

## Register and lifecycle rules

- List defaults to ACTIVE; INACTIVE is displayed as Retired. ALL includes both. Results sort by reference then ID.
- Search trims whitespace and matches literal case-insensitive substrings of name/reference. Category, location, condition and status combine with AND.
- Location includes descendants and inactive locations. Current condition derives from the latest assessment by assessedOn descending, createdAt descending, ID ascending; UNASSESSED means no assessment.
- Retirement requires exact reference, a trimmed nonblank reason (max 2000), date and expectedVersion. Date must be no later than Singapore today and no earlier than known installation.
- Corrections require a retired asset. Restoration requires a retired asset and exact reference, clears current retirement metadata and retains the same identity/history.
- Every lifecycle transition increments version and atomically records actor, timestamp and before/after snapshots. Stale version or invalid state returns 409. Legacy retired rows retain null metadata without fabricated events.
- `category` is a code from the `AssetCategory` table (list them with `GET /asset-categories`, see `catalogue.md`); an unknown code returns 400 "category: unknown asset category." The list filter takes the same codes.
- `manufacturer` and `model` are free text backed by the shared catalogue: on save they are normalised (trimmed, whitespace collapsed, uppercased) and found-or-created, so responses return the catalogue name. A model without a manufacturer returns 400 "manufacturer: required when a model is given." Changing them makes earlier events stop counting toward the failure forecast (`asset-events.md`).
- Ordinary asset edits remain blocked while retired. Device/assessment history remains attached; replacements are independent assets.

Example: `GET /estates/{estateId}/assets?q=pump&condition=FAULTY&status=ALL`.

Retirement body:
```json
{"reference":"EST-A0001","retiredOn":"2026-10-01","retirementReason":"Worn bearings","expectedVersion":0}
```

After success, restore with `{"reference":"EST-A0001","expectedVersion":1}`.

## Device credentials

Decision 0025.

- The key is `upk_` plus 32 SecureRandom bytes, base64url without padding. It is returned once and never stored, logged or returned again. `Device.credentialHash` holds its SHA-256 hex, and `credentialIssuedAt` the issue time.
- Issuing locks the estate, then the asset (as registration does), then updates the device scoped by id, asset and estate. An unknown device, a device on another asset or estate, or an estate the caller does not own returns 404. A retired asset or inactive estate returns 409. A key issued earlier keeps working once the asset is restored.
- Issuing again overwrites the hash, so the previous key is rejected at once. Replacement is the only way to revoke a key for now.
- Devices call `/device-api/**` with `Authorization: Bearer upk_...`. That path has its own stateless security chain (no CORS, no CSRF, no JWT), ordered before the main one. It always requires a device key, even when the JWT issuer is unset. A missing, malformed, unknown or replaced key returns 401 `{"message":"A valid device key is required."}`. A user's JWT is never accepted there, and a device key is never accepted on manager endpoints. The authenticated principal is the device's UUID. The only `/device-api` endpoint is `POST /device-api/readings`; see [device-readings.md](device-readings.md).

Example: `POST /estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential` returns 201
`{"deviceId":"…","apiKey":"upk_…","issuedAt":"2026-10-10T00:00:00Z"}`.

## Historical location options

`GET /estates/{estateId}/locations?includeInactive=true` returns all owner-visible locations (200 LocationResponse[]); omission/false retains active-only behavior. 401 unsigned, 404 foreign/missing estate. The UI computes hierarchical paths from parentId. LocationResponse contains required id/estateId (UUID), type (BLOCK/LEVEL/COMMON_AREA), name (string), createdAt/updatedAt (date-time), and nullable parentId (UUID), sortOrder (integer), deactivatedAt (date-time).
