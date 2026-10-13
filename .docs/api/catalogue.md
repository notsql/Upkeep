# Catalogue API

Contract: `packages/api/openapi.json`. Read-only lookups shared by all estates; they hold no estate data, so any signed-in user (bearer JWT) can read them, with no estate ownership check. Missing authentication returns 401.

## GET `/asset-categories`

- 401: Sign in required — EstateError
- 200: Every asset category, ordered by label — AssetCategoryResponse[]

## GET `/manufacturers`

- query `query`: string (optional)
- 401: Sign in required — EstateError
- 200: Manufacturers whose names contain the query, at most 20 — ManufacturerResponse[]

## GET `/manufacturers/{manufacturerId}/models`

- path `manufacturerId`: uuid (required)
- query `category`: string (required)
- query `query`: string (optional)
- 200: The manufacturer's models in the category, at most 20 — AssetModelResponse[]
- 400: Missing or unknown category — EstateError
- 404: Manufacturer not found — EstateError
- 401: Sign in required — EstateError

## AssetCategoryResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| code | string | yes |  |
| label | string | yes |  |

## AssetModelResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| id | uuid | yes |  |
| manufacturerId | uuid | yes |  |
| category | string | yes |  |
| name | string | yes |  |

## EstateError

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| message | string | yes |  |

## ManufacturerResponse

| Field | Type | Required | Constraints |
| --- | --- | --- | --- |
| id | uuid | yes |  |
| name | string | yes |  |

## Catalogue rules

- Asset categories live in the `AssetCategory` table (seeded, Prisma-owned), not a Java enum. `code` is the value assets store and send (e.g. `PUMP`); `label` is for display. The server only branches on codes in `AssetCategoryCodes` (currently `PUMP`).
- Names are normalised: trimmed, inner whitespace collapsed to one space, uppercased. "Grundfos", " grundfos " and "GRUNDFOS" are the same manufacturer.
- `query` matches names containing the normalised query; blank or omitted returns all. Results order by name and cap at 20.
- Models are scoped to one manufacturer **and** one category; `category` is required on the models lookup. Missing category or a malformed UUID returns 400 "Invalid catalogue request."; an unknown category returns 400 "Unknown asset category."; an unknown manufacturer returns 404.
- There are no create endpoints. Manufacturers and models are found-or-created when an asset is saved with free-text `manufacturer`/`model` (see `assets.md`); concurrent saves of the same name resolve to one row.

Example: `GET /manufacturers?query=grund` then `GET /manufacturers/{manufacturerId}/models?category=PUMP&query=cr`.

```json
[{"id":"6f1c…","manufacturerId":"2b9e…","category":"PUMP","name":"CR 32-2"}]
```
