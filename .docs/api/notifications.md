# Notifications API (ID-100, ID-101, ID-103, ID-105, ID-106, ID-107)

Contract: `packages/api/openapi.json`. Spec: `.spec/features/notifications.md`.

In-app only (no email). A `Notification` belongs to one estate and one asset; read state is per
user (`NotificationRead`). Package `com.proj.server.notification`.

## Access

Every endpoint requires a bearer JWT subject (401 otherwise) and is explicitly allowed in
`SecurityConfig`. A user sees the notifications of the estates they **manage** -
`AccessService.managerEstates`: owner, or same-estate `MANAGER`, and not a resident there. This is
decided on every read, so promotion shows existing notifications and losing the role hides them.
MEMBER, COUNCIL, CREW, RESIDENT and custom roles see none. A notification outside the caller's
managed estates (or an unknown ID) is 404.

## GET `/notifications/unread-count`

- 200: `NotificationCountResponse` - visible notifications the caller has not read.

## GET `/notifications`

- Query `page` (default 0, at least 0), `size` (default 20, 1-100).
- 200: `NotificationPageResponse`, newest first by `createdAt`, ties by `id` descending.
  A page past the end has empty `items` and the real `total`.
- 400: bad `page` or `size`.

## POST `/notifications/{notificationId}/read`

- 204: read for the caller (idempotent). 404: unknown or not visible.

## POST `/notifications/read-all`

- 200: `NotificationCountResponse` afterwards (normally 0). Marks read every visible notification
  created up to the start of the request; other users are unaffected.

## POST `/notifications/{notificationId}/acknowledge` (ID-107)

- Body `AcknowledgeAlertRequest { reason?: string }`; `{}` is fine. The reason is trimmed; blank
  becomes null.
- 200: `NotificationResponse` after acknowledging. It records `response = ACKNOWLEDGED`,
  `respondedByUserId`, `respondedByName` (WorkOS display name) and `respondedAt`, and marks the alert
  read for the caller. It never resolves the alert.
- 400: reason over 500 characters. 404: unknown or not visible.
- 409: not an `ANOMALY` notification, already dismissed, inactive estate, or retired asset
  (`deactivatedAt`). Resolved alerts can still be acted on.

## POST `/notifications/{notificationId}/dismiss` (ID-107)

- Body `DismissAlertRequest { reason: string }`. 400 "Enter a reason for dismissing this alert."
  when missing or blank, or over 500 characters after trimming.
- 200 / 404 / 409 as acknowledge. An acknowledged alert can be dismissed. A dismissed alert is final.

## GET `/estates/{estateId}/assets/{assetId}/anomaly-alerts` (ID-107)

- 200: `NotificationResponse[]`, the asset's `ANOMALY` notifications newest first, with `read` for
  the caller. Uses `EstateRepository.findManaged` (owner or same-estate `MANAGER`); a same-estate
  `RESIDENT` gets 403; anyone else, or an unknown asset, gets 404.

## GET `/estates/{estateId}/notification-settings`

- 200: `NotificationSettingsResponse` - the saved switches, or every switch on when the estate has
  none. Uses `EstateRepository.findManaged`: owner or same-estate `MANAGER`; a same-estate
  `RESIDENT` gets 403; anyone else or an unknown estate gets 404. Works for inactive estates.

## PUT `/estates/{estateId}/notification-settings`

- Body `NotificationSettingsRequest`, all five switches required as booleans. Unknown fields
  (including the retired `anomalyScoreThreshold`, `serviceLeadDays`, `repairLeadDays`) are ignored.
- 200: the saved switches. Upserts `EstateNotificationSettings` and deletes today's
  `NotificationSweep` row so the next read sweeps again with the new switches. Last write wins.
- 400: a switch missing or null, or unreadable JSON.
- 409: inactive estate. 401 / 403 / 404 as for GET.

```http
PUT /estates/{estateId}/notification-settings
{ "anomalyEnabled": true, "serviceDueEnabled": true, "repairPredictedEnabled": false,
  "checkRequestedEnabled": true, "checkFailedEnabled": true }
```

### What a switch does

- Off: no new notification of that type is created for the estate - not by the sweep
  (`SERVICE_DUE`, `REPAIR_PREDICTED`), the anomaly check (`ANOMALY`, and so no email), or the
  inspection inserts (`CHECK_REQUESTED` in `InspectionListRepository.notifyAssignee`,
  `CHECK_FAILED` in `notifyFailed`, which insert only when no settings row turns the switch off).
- Existing notifications of a switched-off type stay visible and still resolve as usual; the sweep
  still runs its resolve step. Turning a switch back on does not back-fill missed milestones.
- Check requested off stops only the in-app message; the check is still assigned and listed.

## DTOs

| DTO | Fields |
| --- | --- |
| NotificationCountResponse | unread: integer |
| NotificationPageResponse | items: NotificationResponse[]; page; size; total |
| NotificationResponse | id; type: `ANOMALY \| SERVICE_DUE \| REPAIR_PREDICTED`; estateId; estateName; assetId; assetReference; assetName; summary: string (one line, written by the server); createdAt; updatedAt; resolvedAt: date-time or null; read: boolean (for the caller); anomaly: AnomalyAlertDetails or null; serviceDue: ServiceDueDetails or null; repairPredicted: RepairPredictedDetails or null; inspectionResultId: uuid or null; milestoneDays: integer or null (90, 60, 30, 14 for `SERVICE_DUE`; 90, 60, 30 for `REPAIR_PREDICTED`; null otherwise and on rows raised before milestones until the next sweep marks them) |
| NotificationSettingsRequest / NotificationSettingsResponse | anomalyEnabled, serviceDueEnabled, repairPredictedEnabled, checkRequestedEnabled, checkFailedEnabled: boolean (all required) |
| AnomalyAlertDetails | condition: `NEEDS_ATTENTION \| FAULTY`; medianScore, maxScore: number (0-1); firstDetectedAt, lastDetectedAt; explanation; response: `NONE \| ACKNOWLEDGED \| DISMISSED`; respondedByName, respondedAt, responseReason: or null |
| ServiceDueDetails | dueOn: date; interval: ServiceInterval; intervalSource: `ASSET \| CATEGORY` |
| RepairPredictedDetails | recommendedTimeframe: `WITHIN_30_DAYS \| WITHIN_60_DAYS \| WITHIN_90_DAYS`; probability: number; basis: `SERVICE_INTERVAL \| ASSET_HISTORY`; failuresObserved: integer |

Exactly one detail object is non-null, matching `type`. The three are `oneOf` their schema and
`null` in the contract (`NotificationOpenApiConfiguration`).

## Anomaly alerts (ID-105, ID-106)

Raised by `POST /estates/{estateId}/assets/{assetId}/readings/anomaly-check`
([anomaly-check.md](anomaly-check.md)), whose request and response are unchanged.
`AnomalyCheckService.check` is now `@Transactional`, and the assessment and the alert change commit together.
`AnomalyAlerts` (package `notification`) applies these rules after scoring:

- **Normal batch:** the longest abnormal run is shorter than `MIN_ABNORMAL_RUN` (10). It resolves the
  pump's open `ANOMALY` notification, if any (`resolvedAt = now()`).
- **Qualifying run:** at least 10 readings, median score at least the model's fixed
  `AnomalyModel.DECISION_THRESHOLD` (0.51), no reading in the run outside its `DeviceMetric` valid
  range, and the estate's `anomalyEnabled` switch on. No estate setting changes the threshold.
  - With no open alert, it inserts one: unread for everyone, and publishes
    `AnomalyAlertRaised(notificationId, estateId, assetId)` for email (below).
  - With an open alert, it locks the alert (`FOR UPDATE`) and updates `condition`, `summary`,
    `medianScore`, `maxScore`, `explanation` and `updatedAt`. `lastDetectedAt` only moves forward
    (`greatest`). `createdAt`, `firstDetectedAt` and read receipts are untouched.
  - An insert that loses a race to the partial unique index updates the winner instead.
- **Any other batch** leaves alerts alone: an abnormal run below the threshold, one containing an
  out-of-range reading, or any run while the switch is off.
- Alerts are raised whether or not an assessment is recorded (the assessment is still only recorded
  when the condition changes, decision 0021).
- A failed check (400/404/409/503) changes nothing.
- `summary` is "Abnormal readings: needs attention" or "Abnormal readings: faulty". `explanation` is
  the assessment's sentence. Scores are stored to four decimal places.

### Email for a new alert

- Only a NEW open `ANOMALY` insert sends email; an update, a resolve or a lost insert race does not.
- `AnomalyAlertEmailSender` listens with `@TransactionalEventListener` (after commit; a rollback
  sends nothing) and hands the work to the one-thread `anomalyAlertEmailExecutor`, so email never
  blocks or fails the anomaly check.
- No `EmailSender` bean (Resend not configured): nothing is sent, no error.
- Recipients: `Estate.ownerUserId` plus every `MANAGER` from `CouncilRepository.members`, each user
  once. Addresses come from `CouncilIdentity.user(userId).email()` (WorkOS) at send time; a failed
  lookup, blank or unverified address is skipped and logged at WARN. Each address is emailed once.
  A send failure is logged at WARN with the notification ID, not retried.
- Copy (`AnomalyAlertEmail`): subject `Unusual readings: <asset name> at <estate name>`; plain-text
  body saying the readings look unusual, linking `<web origin>/estates/<estateId>/assets/<assetId>`,
  and saying how to turn the messages off. The web origin is the first `app.cors.allowed-origins`
  entry (`CORS_ALLOWED_ORIGINS`).

## The daily sweep (ID-103, ID-101)

Service-due dates and forecasts are derived on read, so `NotificationSweeper` raises and resolves
these two types:

- **When:** `GET /notifications` and `GET /notifications/unread-count` sweep each **active** estate
  the caller manages that has not been swept today (Singapore day), before answering.
- **Once per day:** a sweep first inserts `NotificationSweep (estateId, day)` with
  `ON CONFLICT DO NOTHING`, and only the request that inserts it sweeps. Concurrent reads therefore
  sweep once.
- **Isolated:** each estate runs in a savepoint (`PROPAGATION_NESTED`). A failure rolls back that
  estate's sweep and its record, so the next read retries. It is logged and never fails the read.
- **Re-sweep:** saving notification settings deletes today's record, so the next read sweeps again.
- **Rule:** for each type, an active asset that qualifies has a current milestone. If that
  milestone has not fired (see each type) and the type's switch is on, any open reminder is
  resolved and one for the new milestone inserted, so it shows unread again. Open notifications
  whose asset no longer qualifies are resolved (`resolvedAt`), switch on or off. This includes
  retired assets, since only active assets are considered. One open per asset and type.
- **Rows from before milestones:** an open row with null `milestoneDays` is marked with the current
  milestone and not resent.
- **Busy assets:** assets with a work order in `OPEN`, `ASSIGNED` or `IN_PROGRESS` never qualify.

**`SERVICE_DUE` (ID-103):**

- `dueOn` = last inspection `inspectedOn`, else `installedOn`, plus the effective interval
  (`ServiceIntervalService.effectiveForEstate`; `ServiceInterval.after`). This is the inspection
  list's clock.
- Milestones are fixed: 90, 60, 30 and 14 days before `dueOn`. The current one is the smallest of
  them `>=` days left; more than 90 days left means none (not qualifying); overdue counts as 14.
- A milestone fires once per asset and `dueOn`: dedupe is against every `SERVICE_DUE` row (open or
  resolved) with the same asset, `dueOn` and `milestoneDays`. A new `dueOn` starts again from 90.
  Only the nearest milestone fires; skipped ones are not back-filled.
- `summary`: "Service due in 30 days (on 20 Nov 2026)" (90/60/30 milestones), "Service due on
  20 Nov 2026" (14) or "Service overdue since 20 Nov 2026".
- It stores `dueOn`, the interval, and `intervalSource` (`ASSET` override or `CATEGORY`).

**`REPAIR_PREDICTED` (ID-101):**

- Pumps only (`FailureRiskConstants.SILENT_FAILURE_CATEGORIES`), using the ID-32 forecast
  (`FailureRiskCalculator` over the asset's events, today in Singapore).
- An asset qualifies when its `recommendedTimeframe` is within 30, 60 or 90 days and its basis is
  `ASSET_HISTORY` or `SERVICE_INTERVAL`. The window is the milestone (no 14-day repair reminder:
  the forecast has no date).
- It stores the timeframe, that window's probability (the "confidence level", 4 decimal places),
  the basis and `failuresObserved`.
- `summary`: "Repair likely within 30 days (18% chance)".
- A nearer window than the open reminder's (90 -> 60 -> 30) replaces it. A further window never does
  (a reminder never steps backwards; the open one keeps its summary). It resolves when the asset
  leaves all windows, and the next crossing starts again.

## Storage

- `Notification`: type-specific columns are nullable and enforced per type by CHECKs; a partial
  unique index allows one open (`resolvedAt` null) notification per `(assetId, type)`.
- `NotificationRead (notificationId, userId)`: read receipts, inserted with `ON CONFLICT DO NOTHING`.
- `Notification.milestoneDays`: nullable; a CHECK allows 90/60/30/14 on `SERVICE_DUE`, 90/60/30 on
  `REPAIR_PREDICTED`, null elsewhere. Index `(assetId, type, milestoneDays)`.
- `EstateNotificationSettings (estateId)`: one row per estate once saved; five boolean switches,
  default true. The retired `anomalyScoreThreshold`, `serviceLeadDays`, `repairLeadDays` are
  nullable and unread, to be dropped in a later PR.
- `NotificationSweep (estateId, day)`: one row per estate per swept Singapore day; settings saves
  delete today's row.

## Example

```http
GET /notifications?page=0&size=20
```

```json
{ "items": [{ "id": "…", "type": "SERVICE_DUE", "estateName": "Harbour View",
  "assetReference": "P-1", "assetName": "Booster pump",
  "summary": "Service due in 30 days (on 20 Nov 2026)", "milestoneDays": 30,
  "createdAt": "2026-11-08T02:00:00Z", "resolvedAt": null, "read": false, "anomaly": null,
  "serviceDue": { "dueOn": "2026-11-20", "interval": { "value": 6, "unit": "MONTH" },
  "intervalSource": "CATEGORY" }, "repairPredicted": null }], "page": 0, "size": 20, "total": 1 }
```

## Check requested and check failed (equipment dispatch)

Two more types, documented in [equipment-dispatch.md](equipment-dispatch.md):
`CHECK_REQUESTED` ("Sent by <manager>", visible only to the one person sent,
while they can still record inspections) and `CHECK_FAILED` (the inspector's
note as `summary`, visible to managers). `NotificationResponse` gains
`inspectionResultId` (set only for `CHECK_FAILED`); neither type has a detail
object. Recording an inspection resolves the asset's open notifications of
both types.
