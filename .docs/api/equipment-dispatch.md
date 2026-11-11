# Equipment dispatch API

Sending crew or a contractor to flagged equipment (spec
`.spec/features/equipment-dispatch.md`). "Send a contractor" has no endpoint of
its own: it is the existing `POST /estates/{estateId}/work-orders` with source
`MAINTENANCE_RECOMMENDATION` (or `INSPECTION` with `sourceInspectionId` after a
Fail). `packages/api/openapi.json` is the source of truth.

All errors are `EstateError { message: string }`. Every endpoint needs a bearer
token (401 without one).

## Who may call

| Action | Who |
| --- | --- |
| List inspectors, send crew | Same check as `POST …/inspection-list/generate`: the estate owner or an assigned Manager (`EstateRepository.findManaged`). Others get 404 (403 for a resident membership). |
| Read the open work order | Same as reading work orders: owner, Manager or Crew. |
| "Can record inspections" (who may be sent) | The owner (unless a resident there) and `MANAGER` / `CREW` members — the same rule `InspectionService` uses to guard recording. Custom roles have no inspection permission today, so none are listed. |

## GET `/estates/{estateId}/inspectors`

`operationId: listInspectors`. 200 `InspectorResponse[]`, sorted by name
(case-insensitive), then user ID.

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | string | WorkOS user ID |
| `name` | string | WorkOS display name; the user ID when WorkOS has none |
| `roleName` | string | `Owner`, `Manager` or `Crew` |

```json
[{ "userId": "user_01", "name": "Ahmad Rahman", "roleName": "Crew" }]
```

## POST `/estates/{estateId}/assets/{assetId}/inspection-requests`

`operationId: requestInspection`. Body `InspectionRequest
{ assignedToUserId: string }` (required, not blank).

Locks the estate row (the same lock as list generation and recording), then:

| Case | Status | Body |
| --- | --- | --- |
| No check for this asset this month, and no open one | 201 | the new `InspectionCheckResponse` |
| The asset already has an open check (this month or carried over) | 200 | that check, unchanged (first sender's choice kept; no new notification) |
| This month's check is already done | 409 | "This equipment was already inspected this month." |
| Assignee missing/blank | 400 | validation error |
| Assignee can't record inspections here | 400 | "<name> can no longer record inspections here." |
| Asset not in the estate | 404 | "Asset not found." |
| Asset retired | 409 | "This equipment is retired." |
| Estate inactive | 409 | "This estate is inactive. Crew cannot be sent." |

A new check has `month` = this Singapore month, `dueOn` = today,
`dueBasis` = `REQUESTED`, `generatedBy*` = the sender, `assignedTo*` = the
person. It also inserts one `CHECK_REQUESTED` notification addressed to the
assignee (see below). The one-check-per-asset-per-month unique key and the
one-open-check index make a second check impossible even from two tabs.

Monthly generation (`POST …/inspection-list/generate`) skips equipment that
already has this month's check, so a requested check is never duplicated.

## Changes to existing contracts

- `DueBasis` gains `REQUESTED`.
- `InspectionCheckResponse` gains `requestedByName: string | null` (the sender,
  set only for `REQUESTED`) and `assignedToName: string | null`.
- `POST /estates/{estateId}/assets/{assetId}/inspections` (JSON): `outcome`
  `FAIL` with blank or whitespace-only `notes` returns **400** "Say what's wrong
  so the manager knows what to fix." Pass keeps notes optional. Existing results
  are untouched.
- Recording any inspection result completes the asset's open check (as before)
  and resolves its open `CHECK_REQUESTED` and `CHECK_FAILED` notifications.
- A `FAIL` result then inserts a `CHECK_FAILED` notification for the estate's
  managers: `summary` = the note (trimmed, shortened to 300 characters with an
  ellipsis), `inspectionResultId` = the result.
- `NotificationType` gains `CHECK_REQUESTED` and `CHECK_FAILED`;
  `NotificationResponse` gains `inspectionResultId: string | null` (set only
  for `CHECK_FAILED`). Neither new type has a detail object (`anomaly`,
  `serviceDue`, `repairPredicted` are all null).
- `CHECK_REQUESTED` `summary` is "Sent by <manager>".

### Notification visibility

Decided at read time (`NotificationRepository.visibleTo`):

- `recipientUserId` null (every type except `CHECK_REQUESTED`): estates the
  caller manages (owner or Manager), as before.
- `recipientUserId` set (`CHECK_REQUESTED`): only that user, and only while
  they can still record inspections in the estate (owner, Manager or Crew, not
  resident). If they lose access, the notification disappears for them.

## GET `/estates/{estateId}/assets/{assetId}/open-work-order`

`operationId: getOpenWorkOrder`. The asset's newest work order whose status is
not `CLOSED`.

- 200 `OpenWorkOrderResponse { id: uuid, reference: string }`
- 204 (empty body) when there is none.

```json
{ "id": "6f0c…", "reference": "OAK-W0007" }
```

## Data

Migrations `20261109081711_equipment_dispatch` (columns, index, FK) and
`20261109082210_equipment_dispatch_checks` (CHECK constraints), expand-only:

- `InspectionCheck.assignedToUserId`, `assignedToName` (nullable; set exactly
  when `dueBasis = 'REQUESTED'`), `dueBasis` allows `REQUESTED`.
- `Notification.inspectionResultId` (FK to `AssetInspectionResult`, set exactly
  for `CHECK_FAILED`), `recipientUserId` (indexed, set exactly for
  `CHECK_REQUESTED`), `type` allows both new values.
- The existing partial unique index (one open notification per asset and type)
  still holds: a new inspection result resolves the previous open `CHECK_FAILED`
  before a new one is inserted.
