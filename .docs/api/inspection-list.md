# Monthly inspection list API (ID-84, ID-86)

Contract: `packages/api/openapi.json`. Spec: `.spec/features/monthly-inspection-list.md`.

Due spot checks for assets in categories flagged as failing silently ([asset-categories.md](asset-categories.md)),
with due dates from service intervals ([service-intervals.md](service-intervals.md)) or the
failure-risk forecast ([failure-risk.md](failure-risk.md)). A check stays open until an inspection
result ([inspections.md](inspections.md)) completes it; an open check from an earlier month is
overdue. Package `com.proj.server.inspectionlist`.

## Access

Both endpoints require a bearer JWT subject (401 otherwise) and use `EstateRepository.findManaged`:
the estate owner or a same-estate `MANAGER`. A same-estate `RESIDENT` gets 403; CREW, COUNCIL,
MEMBER, strangers and unknown estates get 404. Both paths are explicitly allowed in
`SecurityConfig`. "This month" is the current Singapore calendar month.

## GET `/estates/{estateId}/inspection-list`

- 200: `InspectionListResponse`; 401 / 403 / 404: `EstateError`. Works for inactive estates.

## POST `/estates/{estateId}/inspection-list/generate`

- No body. 200: `GenerateInspectionListResponse` (`added`, possibly 0, and the list after
  generating). 409: inactive estate. 401 / 403 / 404: `EstateError`.

## DTOs

| DTO | Fields |
| --- | --- |
| GenerateInspectionListResponse | added: integer; list: InspectionListResponse |
| InspectionListResponse | month: date (first of the month); estateActive: boolean; generatedAt: date-time or null (latest run this month); generatedByName: string or null; overdueCount, dueCount, doneCount: integer; checks: InspectionCheckResponse[]; unscheduled: UnscheduledAssetResponse[] |
| InspectionCheckResponse | id; assetId; assetReference; assetName; categoryLabel; block: InspectionLocationResponse; level: InspectionLocationResponse or null; dueOn: date; dueBasis: `PREDICTION \| INTERVAL \| NEVER_INSPECTED`; interval: ServiceInterval or null; intervalSource: `ASSET \| CATEGORY` or null; status: `OVERDUE \| DUE \| DONE`; result: CheckResultResponse or null |
| InspectionLocationResponse | id: uuid; name: string |
| CheckResultResponse | id: uuid (the inspection result); outcome: `PASS \| FAIL`; inspectedOn: date |
| UnscheduledAssetResponse | assetId; assetReference; assetName; categoryLabel |

`level`, `interval` and `result` are `oneOf` their schema and `null` in the contract
(`InspectionListOpenApiConfiguration`), so generated types include `| null`.

## Rules

- **Eligible:** active assets (`deactivatedAt` null) whose category is flagged in the estate
  (`AssetCategorySettingsService.flaggedCategories`).
- **Due date** (`DueDates.due`): base = latest inspection `inspectedOn`, else `installedOn`. No base:
  due on the first of the month, `NEVER_INSPECTED`. Otherwise the earlier of
  base + effective interval (calendar days/months/years; `INTERVAL`) and the forecast window start
  (today, +30 or +60 days for within 30/60/90 days; none for beyond 90; `PREDICTION`); a tie is
  `INTERVAL`. Neither: the asset is **unscheduled** (listed unless it has an open check).
- **Generate** locks the estate row, then adds one `InspectionCheck` per eligible asset whose due
  date is on or before the month's last day and that has no open check and no check this month.
  It stores the month, due date, basis, interval used (value, unit, source), who and when, and
  records an `InspectionListRun` (added count, who, when) even when it adds nothing.
- **Completion:** `InspectionService.create` (ID-85) calls `InspectionListRepository.complete`
  in its write transaction, setting the asset's open check's `completedByResultId` and
  `completedAt`. A result with no open check completes nothing.
- **Listed checks:** open checks of active assets (any month) plus every check of this month.
  Status: completed → `DONE`; open from an earlier month → `OVERDUE`; otherwise `DUE`. Checks of
  retired or deactivated assets are hidden from the list and counts.
- **Order:** block name, block-wide (no level) before levels by `sortOrder` then name, status
  (OVERDUE, DUE, DONE), due date, asset reference. A level's common area belongs to that level; a
  block's common area, or the block itself, is block-wide.
- **Database:** a partial unique index allows one open check per asset; `(assetId, month)` is
  unique; `CHECK`s keep `dueBasis`, the interval columns, first-of-month `month` and the
  completion pair consistent.

Design choices, with their alternatives and where to change each one, are listed under
**Decisions** in `.spec/features/monthly-inspection-list.md`. Notably, the clock counts from the
last **inspection** (or installation), and maintenance or service events don't reset it.

Example: `POST /estates/{estateId}/inspection-list/generate`

```json
{"added":1,"list":{"month":"2026-11-01","estateActive":true,"generatedAt":"2026-11-01T02:00:00Z",
 "generatedByName":"Casey Doe","overdueCount":0,"dueCount":1,"doneCount":0,
 "checks":[{"id":"…","assetId":"…","assetReference":"L-1","assetName":"Lobby light",
  "categoryLabel":"Lighting","block":{"id":"…","name":"Block A"},"level":null,
  "dueOn":"2026-11-01","dueBasis":"NEVER_INSPECTED","interval":null,"intervalSource":null,
  "status":"DUE","result":null}],"unscheduled":[]}}
```
