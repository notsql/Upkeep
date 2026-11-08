# Notifications (ID-100, ID-105, ID-106, ID-107, ID-103, ID-101)

**Status:** built (2026-11-08; open questions accepted as proposed)
**Owner:** Yan Hein Latt
**Jira:** [ID-100](https://notjira.atlassian.net/browse/ID-100) notification list,
[ID-105](https://notjira.atlassian.net/browse/ID-105) anomaly notification,
[ID-106](https://notjira.atlassian.net/browse/ID-106) one alert per ongoing anomaly,
[ID-107](https://notjira.atlassian.net/browse/ID-107) acknowledge or dismiss an anomaly alert,
[ID-103](https://notjira.atlassian.net/browse/ID-103) service interval due,
[ID-101](https://notjira.atlassian.net/browse/ID-101) predicted repair
(epics [ID-13](https://notjira.atlassian.net/browse/ID-13) and [ID-12](https://notjira.atlassian.net/browse/ID-12))
**Depends on:** anomaly check (decision 0021, 0028), failure-risk forecast
(ID-32, `failure-risk.md`), service intervals (ID-81, `service-intervals.md`),
inspection results (ID-85), work orders (ID-36/38/40)

## Problem

Managers only find out that something needs attention by opening the right
screen. An anomaly check can mark a pump as Needs attention, a forecast can say
a pump will probably break down within 30 days, and a service interval can come
due, but each fact sits on its own page. Nobody is told about it. A manager who
doesn't check every asset every day misses it until a resident complains.

These six stories share one inbox:

| Story | Adds |
| --- | --- |
| ID-100 | The in-app inbox: an unread count in the header, a newest-first list, open-and-mark-read, and mark all read. |
| ID-105 | A notification when an anomaly check finds a run whose score reaches the estate's threshold. |
| ID-106 | One notification per ongoing anomaly, updated rather than repeated, until the pump returns to normal. |
| ID-107 | Acknowledge or dismiss (with a reason) an anomaly alert, recorded on the asset. |
| ID-103 | A notification a configurable number of days before an asset's service-interval due date. |
| ID-101 | A notification when an asset's breakdown forecast enters a configurable lead window. |

**In-app only.** The repository has no transactional email service
(decision 0021-existing-accounts). WorkOS only sends its own account emails.

## Behaviour

### Who receives notifications

- A notification belongs to **one estate and one asset**. It is not addressed
  to a user.
- A user sees an estate's notifications while they **manage** that estate,
  meaning they own it or hold the Manager role and are not a resident there
  (`AccessService.managerEstates`). The ID-100/101/103/105 stories call this
  "estates they are authorised to manage".
- Members, Council, Crew, Residents and custom roles see no notifications, even
  with `EDIT_ESTATE`.
- Visibility is checked when notifications are read, not when they are created.
  A user promoted to Manager sees the estate's existing notifications. A user
  who loses the role stops seeing them.
- Read state is **per user**. One manager opening a notification does not mark
  it read for another.
- Acknowledge and dismiss (ID-107) are **per alert**. Every manager sees who
  acted.

### Notification types

| Type | Story | Raised when |
| --- | --- | --- |
| `ANOMALY` | ID-105/106 | An anomaly check finds a qualifying abnormal run. |
| `SERVICE_DUE` | ID-103 | An asset's service-interval due date is within the estate's service lead days. |
| `REPAIR_PREDICTED` | ID-101 | An asset's breakdown forecast falls inside the estate's repair lead window. |

- An asset has **at most one open notification of each type**. "Open" means not
  yet resolved. The database enforces this with a partial unique index.
- A notification is **resolved** when its condition stops holding. The pump
  returns to normal, the asset is serviced, or the forecast moves out of the
  window. A resolved notification stays in the list as history. It never
  reopens. If the condition holds again later, a **new** notification is raised.

### Inbox (ID-100)

- The app header shows a bell button to users who manage at least one estate.
  Its accessible name is "Notifications" or "Notifications, N unread".
- The unread count is the number of notifications visible to the user that
  they have not read. The bell shows no number at zero, and "99+" above 99.
- The count refreshes every 60 seconds and when the window regains focus.
- The bell links to `/notifications`.
- `/notifications` lists the user's visible notifications **newest first** by
  creation time, with ties broken by ID. It is paginated: `page` starts at 0,
  `size` defaults to 20 and is at most 100, and the response gives the total.
- Each row shows the type label, asset name and reference, estate name, a
  one-line summary and the relative time. Absolute times appear on hover.
  Unread rows are visually distinct and say "Unread" to screen readers.
- Type labels are "Anomaly", "Service due" and "Repair predicted".
- Clicking a row marks it read for this user and opens
  `/estates/{estateId}/assets/{assetId}`.
- Marking a notification read twice is not an error.
- "Mark all as read" marks read every notification visible to the user and
  created up to the moment of the request. A notification created during the
  request stays unread.
- "Mark all as read" is disabled when the unread count is 0.
- With no notifications at all, the page shows "No notifications yet".

### Notification settings

- Each estate has three settings. An estate without a saved row uses the
  defaults.

  | Setting | Story | Default | Allowed |
  | --- | --- | --- | --- |
  | `anomalyScoreThreshold` | ID-105 | 0.51 (the model's decision threshold) | 0.51 to 1.00, two decimal places |
  | `serviceLeadDays` | ID-103 | 14 | whole number 0 to 365 |
  | `repairLeadDays` | ID-101 | 30 | 30, 60 or 90 |

- Only users who manage the estate can read or change its settings.
- Saving settings applies to the next anomaly check and to the next sweep (see
  below). It also makes today's sweep run again on the next read.
- The settings are edited at `/estates/$estateId/notification-settings`. The
  estate details page links there for users who manage the estate.

### Anomaly alerts (ID-105, ID-106)

These rules run inside the existing `POST .../readings/anomaly-check`, after
scoring. They run in the same transaction as any assessment it records.

- A batch's longest abnormal run **qualifies** when it is at least
  `MIN_ABNORMAL_RUN` (10) readings long, **and** its median score is at least
  the estate's `anomalyScoreThreshold`, **and** no reading in the run is out of
  its metric's valid range (`DeviceMetric` ranges, the same rule as the
  suspect-reading `OUT_OF_RANGE` flag).
- A batch is **normal** when its longest abnormal run is shorter than
  `MIN_ABNORMAL_RUN`.
- A batch that is neither qualifying nor normal leaves alerts unchanged. For
  example, the run is abnormal but below the estate's threshold, or contains an
  out-of-range reading.
- A qualifying batch with no open `ANOMALY` notification for the asset creates
  one. It is unread for everyone.
- A qualifying batch with an open `ANOMALY` notification **updates** it.
  - The latest median and maximum scores, the explanation and the last-detected
    time change.
  - Nothing else changes, and **no** read state is reset (ID-106).
  - The notification's creation time does not change, so it does not jump to
    the top of the list.
- A normal batch resolves the asset's open `ANOMALY` notification, if any.
- The notification records:
  - the condition the run maps to (`NEEDS_ATTENTION` or `FAULTY`, using the
    same median rule as the assessment);
  - the run's median score and maximum score;
  - the time of the first reading in the run (first detected) and of its last
    reading (last detected);
  - the explanation, which is the sentence the assessment uses ("10
    consecutive abnormal readings from … to …. Median score 0.74, maximum
    0.91.").
- The model is multivariate, so an alert covers the **pump**, not one metric.
  ID-106's "same asset and metric" becomes "same asset".
- A notification is raised whether or not the check records a new assessment.
  The assessment is still only recorded when the condition changes (decision
  0021).
- A failed check (400, 404, 409 or 503) creates, updates and resolves nothing.

### Acknowledge or dismiss (ID-107)

- An open or resolved `ANOMALY` notification starts with response `NONE`.
- A user who manages the estate can **acknowledge** it, which records
  `ACKNOWLEDGED`, who and when. A reason is optional, up to 500 characters.
- They can **dismiss** it, which records `DISMISSED`, who and when. A reason is
  required: 1 to 500 characters after trimming.
- An acknowledged alert can still be dismissed. A dismissed alert cannot be
  acknowledged or dismissed again (409).
- Acting on an alert also marks it read for the acting user.
- Acting on a non-anomaly notification returns 409.
- Acknowledging or dismissing does not resolve the alert. Later qualifying
  batches keep updating it silently, and a normal batch still resolves it.
  This way a dismissed false alarm stays quiet until the pump genuinely
  recovers and drifts again.
- Both actions are available from the notification row and from the asset
  page.
- The asset page has an **Anomaly alerts** section, visible on pumps to the
  estate's owner and Managers (see Decision 10). It lists that asset's `ANOMALY` notifications newest first.
  Each entry shows:
  - the condition, scores and explanation;
  - first and last detected times;
  - open or resolved;
  - the response, with who, when and the reason.

  This is the asset history that ID-107 asks for.
- Only users who manage the estate see the Acknowledge and Dismiss buttons.
  The buttons are disabled with the reason shown on a retired asset or an
  inactive estate.

### Due notifications: the daily sweep (ID-103, ID-101)

Service-due dates and forecasts are derived on read (decision 0027-device-status,
failure-risk spec). Nothing in the system changes when a date simply arrives,
so these notifications come from a **sweep**.

- A sweep evaluates one estate for one Singapore calendar day, the same day
  the inspection list uses.
- When a user reads their unread count or their notification list, each estate
  they manage that has **not** been swept today is swept first, in the same
  request.
- Each estate is swept at most once per day. Concurrent reads of the same
  estate sweep it once. A sweep record keyed by `(estateId, day)` is inserted
  first, and only the request that inserts it sweeps.
- An inactive estate is not swept.
- A sweep looks at the estate's active, non-retired assets. For each type
  below:
  - if the asset qualifies and has no open notification of that type, it
    creates one;
  - if the asset no longer qualifies, it resolves the open one;
  - otherwise it does nothing.
- A sweep that fails rolls back its sweep record, so the next read tries again.
  The read itself still answers from existing notifications. A sweep failure
  never fails the request.

**`SERVICE_DUE` (ID-103)**

- The due date is the asset's last inspection date, or its `installedOn` when
  it has never been inspected, plus its effective service interval (ID-81).
  This is the same clock as the inspection list (`DueDates`).
- An asset qualifies when:
  - it has an effective interval and a base date;
  - today is on or after `dueOn − serviceLeadDays`;
  - it has **no open work order** (status `OPEN`, `ASSIGNED` or
    `IN_PROGRESS`).
- An overdue asset qualifies, and its summary says "overdue since …".
- The notification records the due date, the interval and its source.
  - It is labelled "Interval-based, not a prediction".
  - The source is shown as "Manufacturer interval (Pump category)" for
    `CATEGORY` and "Set on this asset" for `ASSET`.
- Recording an inspection moves the due date out of the window. The next sweep
  resolves the notification.

**`REPAIR_PREDICTED` (ID-101)**

- Uses the same forecast as `GET /estates/{estateId}/failure-risk` (ID-32). It
  only covers silent-failure categories, currently pumps.
- An asset qualifies when:
  - its `recommendedTimeframe` is `WITHIN_30_DAYS`, `WITHIN_60_DAYS` or
    `WITHIN_90_DAYS`, and the window is within `repairLeadDays`;
  - it has **no open work order**.

  For example, with 30 lead days only `WITHIN_30_DAYS` qualifies. With 90 lead
  days all three do.
- An asset whose basis is `INSUFFICIENT_DATA` or `NOT_SUPPORTED` never
  qualifies.
- The notification records:
  - the window as the **estimate range** ("within 30 days");
  - that window's probability as the **confidence level** ("42% chance");
  - the forecast basis. It says "based on N recorded repairs" for
    `ASSET_HISTORY`, and "based on typical pumps; no repairs recorded yet" for
    `SERVICE_INTERVAL`.
- "At most one per asset per estimate crossing": the notification stays open
  while the asset remains in the window, even if it moves from 60 to 30 days.
  It resolves when the asset leaves the window, for example after a repair is
  recorded. A later re-entry is a new crossing.

## Data

New Prisma models in `packages/db/prisma/schema/schema.prisma`, in one
migration (`notifications`):

- **`Notification`**
  - `id` uuid PK
  - `estateId`, `assetId` with a composite FK to `Asset(id, estateId)`
  - `type`: `ANOMALY`, `SERVICE_DUE` or `REPAIR_PREDICTED`, as VarChar with a
    CHECK
  - `createdAt`, `updatedAt`, `resolvedAt?`
  - `summary` VarChar(300): the one-line text, written by the server
  - Anomaly columns (nullable, CHECK required when `type = 'ANOMALY'`):
    - `condition`
    - `medianScore`
    - `maxScore`
    - `firstDetectedAt`
    - `lastDetectedAt`
    - `explanation`
    - `response`: `NONE`, `ACKNOWLEDGED` or `DISMISSED`, default `NONE`
    - `respondedByUserId?`
    - `respondedByName?`
    - `respondedAt?`
    - `responseReason?` VarChar(500)
  - Service-due columns: `dueOn`, `intervalValue`, `intervalUnit`,
    `intervalSource`
  - Predicted-repair columns: `recommendedTimeframe`, `probability`, `basis`,
    `failuresObserved`
  - Partial unique index: one row per `(assetId, type)` where
    `resolvedAt IS NULL`
  - Index `(estateId, createdAt DESC, id)`
- **`NotificationRead`**
  - `(notificationId, userId)` PK
  - `readAt`
  - Cascades on notification delete. Notifications are never deleted in this
    spec.
- **`EstateNotificationSettings`**
  - `estateId` PK and FK
  - `anomalyScoreThreshold` Decimal(3,2)
  - `serviceLeadDays` Int
  - `repairLeadDays` Int
  - `updatedAt`, `updatedByUserId`
  - CHECKs for the allowed ranges
- **`NotificationSweep`**
  - `(estateId, day)` PK
  - `sweptAt`

No existing model changes. Then `pnpm db:generate` regenerates the jOOQ
classes.

## API

Paths are as they will appear in `packages/api/openapi.json`. Every endpoint
needs a signed-in user (401 otherwise) and is added to `SecurityConfig`'s
allowlist.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/notifications/unread-count` | - | `200 NotificationCountResponse { unread: int }` | any user; counts estates they manage, after sweeping (ID-100) |
| GET | `/notifications` | query `page` (≥0, default 0), `size` (1-100, default 20) | `200 NotificationPageResponse { items: NotificationResponse[], page, size, total }` | any user; estates they manage, after sweeping; 400 on bad paging |
| POST | `/notifications/{notificationId}/read` | - | `204` | manages the notification's estate; otherwise 404 |
| POST | `/notifications/read-all` | - | `200 NotificationCountResponse` (unread after, normally 0) | any user |
| POST | `/notifications/{notificationId}/acknowledge` | `AcknowledgeAlertRequest { reason?: string ≤500 }` | `200 NotificationResponse` | manages the estate; 404 otherwise; 409 not an anomaly, already dismissed, retired asset or inactive estate; 400 reason too long |
| POST | `/notifications/{notificationId}/dismiss` | `DismissAlertRequest { reason: string 1-500 }` | `200 NotificationResponse` | as acknowledge; 400 when reason blank or too long |
| GET | `/estates/{estateId}/assets/{assetId}/anomaly-alerts` | - | `200 NotificationResponse[]` (type `ANOMALY` only, newest first) | manages the estate (`findManaged`); 403 resident; 404 otherwise or unknown asset |
| GET | `/estates/{estateId}/notification-settings` | - | `200 NotificationSettingsResponse { anomalyScoreThreshold: number, serviceLeadDays: int, repairLeadDays: 30\|60\|90 }` | manages the estate; 404 otherwise |
| PUT | `/estates/{estateId}/notification-settings` | `NotificationSettingsRequest` (same three fields, all required) | `200 NotificationSettingsResponse` | manages the estate; 404 otherwise; 400 out of range; 409 inactive estate |

`NotificationResponse`:

- **Common:** `id`, `type`, `estateId`, `estateName`, `assetId`,
  `assetReference`, `assetName`, `summary`, `createdAt`, `updatedAt`,
  `resolvedAt?`, `read: boolean`
- **`anomaly?`** (non-null only for `ANOMALY`): `condition`, `medianScore`,
  `maxScore`, `firstDetectedAt`, `lastDetectedAt`, `explanation`, `response`,
  `respondedByName?`, `respondedAt?`, `responseReason?`
- **`serviceDue?`**: `dueOn`, `interval: ServiceInterval`, `intervalSource`
  (`ASSET` or `CATEGORY`)
- **`repairPredicted?`**: `recommendedTimeframe`, `probability`, `basis`,
  `failuresObserved`

Nullable `$ref` properties use the existing nullable-ref `OpenApiCustomizer`
pattern.

The existing `POST /estates/{estateId}/assets/{assetId}/readings/anomaly-check`
keeps its request and response unchanged. Raising alerts is a side effect.

### Web

- `apps/web/src/lib/notifications.ts`:
  - `useUnreadNotificationCount`
  - `useNotifications(page)`
  - `useMarkNotificationRead`
  - `useMarkAllNotificationsRead`
  - `useAcknowledgeAlert`, `useDismissAlert`
  - `useAssetAnomalyAlerts`
  - `useNotificationSettings`, `useSaveNotificationSettings`

  Keys start with the user ID. Mutations invalidate the count, the list and
  the asset's alerts.
- **Header:** a bell `Button` linking to `/notifications`, with a `Badge`
  showing the count.
- **Routes:**
  - `routes/_auth/notifications/index.tsx` with `-components/` (list rows,
    dismiss `Dialog` with `Textarea`);
  - `routes/_auth/estates/$estateId/notification-settings/index.tsx`.
- **Asset page:** an `anomaly-alerts-section` under the asset-details
  `-components`.

## Edge cases

- **Two managers mark all as read at once.** Read rows are per user, so the
  two requests never conflict. Insert with `ON CONFLICT DO NOTHING`.
- **Two anomaly checks for the same pump at once.** The partial unique index
  allows one open alert. The second insert conflicts and becomes an update.
  Each check locks the open alert row (`FOR UPDATE`) before updating or
  resolving it.
- **A sweep and an anomaly check at once.** They touch different types, so
  they don't conflict.
- **Out-of-order batches.** A batch older than the alert's `lastDetectedAt`
  still updates scores, but `lastDetectedAt` only moves forward. A normal
  batch resolves the alert regardless of order. This is accepted, because
  batches cannot span each other (decision 0021).
- **Asset retired or estate deactivated while an alert is open.** The next
  sweep resolves open `SERVICE_DUE` and `REPAIR_PREDICTED` notifications for
  retired assets. An open `ANOMALY` alert stays open, because no more checks
  can run on a retired asset. It shows "Asset retired" and cannot be acted on.
- **A user's estate list is empty** (resident, member or crew). The count is 0,
  the list is empty, and no sweep runs. The bell is hidden.
- **The user manages many estates.** The first read of the day sweeps each one.
  This is accepted for the current portfolio sizes. See Open questions.
- **Settings saved mid-day with a shorter lead.** Today's sweep runs again on
  the next read. Notifications that no longer qualify resolve. None are
  deleted.
- **The threshold is raised while an alert is open.** The alert stays open. A
  later batch below the new threshold but still abnormal leaves it unchanged.
  Only a normal batch resolves it.
- **The interval is removed (ID-81) while `SERVICE_DUE` is open.** The asset no
  longer qualifies, so the next sweep resolves it.
- **A work order is created for an asset with an open `SERVICE_DUE` or
  `REPAIR_PREDICTED`.** The next sweep resolves it. A new one can only come
  after the work order closes and the asset still qualifies.
- **The asset has no `installedOn` and was never inspected.** There is no due
  date, so no `SERVICE_DUE`. The inspection list still shows it as "never
  inspected".
- **Read endpoint on another user's estate, or an unknown ID.** 404. Same for
  acknowledge and dismiss.
- **Dismiss reason of only spaces.** 400, "Enter a reason for dismissing this
  alert."
- **Paging past the end.** Returns an empty `items` list with the real
  `total`.

## Out of scope

- **Email, push or SMS.** No transactional email provider exists. Adding one
  is its own story and decision.
- Per-user notification preferences, muting, or choosing which types to
  receive. Settings are per estate.
- Deleting or archiving notifications, and retention or cleanup.
- Real-time push (WebSocket or SSE). The count polls every 60 seconds.
- Running anomaly checks automatically when device readings arrive. Alerts
  come only from the existing anomaly-check endpoint (decision 0021). Wiring
  stored readings into checks is separate.
- Per-metric anomaly alerts. The model scores the pump as a whole.
- A background scheduler for sweeps. See Decisions.
- Changing the asset's condition when an alert is dismissed. A manager who
  thinks it was a false alarm records a new assessment as today.
- Notification types for fault reports, work orders, invitations or flatlined
  sensors.
- Cost stories ID-33 and ID-34. These are separate specs, after this one.

## Decisions

1. **In-app only.**
   - Chosen because no email provider exists, and adding one means a new
     dependency, secrets and templates.
   - The alternative was email through Resend or SES.
   - To revisit, add a delivery step after the notification insert.
2. **Notifications belong to estates, read state belongs to users.**
   - One row per estate event, plus a `NotificationRead` row per user who has
     read it.
   - The alternative was one row per recipient. That needs fan-out on create,
     misses managers added later, and keeps showing estates a user no longer
     manages.
   - To change it, look at `Notification` and `NotificationRead`.
3. **The sweep runs on read, once per estate per day.**
   - Cloud Run scales to zero (decision 0029), so a Spring `@Scheduled` job
     would not run while nobody is using the app.
   - The first alternative was Cloud Scheduler calling a protected endpoint.
     It needs infrastructure and a service credential.
   - The second alternative was `@Scheduled` alone. It is unreliable at zero
     instances.
   - To change it, replace the trigger in the sweep service. The sweep logic
     stays the same.
4. **One open notification per asset and type**, resolved when the condition
   stops holding.
   - This gives ID-106's "notify again only after it returns to normal" and
     ID-101's "one per estimate crossing" with one rule and one index.
   - The alternative was a unique key per due date or per forecast value. It
     re-notifies whenever the date shifts.
5. **Anomaly alerts are per pump, not per metric.**
   - The ONNX model scores all five metrics together and gives no per-metric
     score.
6. **"Suspect" for an anomaly batch means out of range.**
   - Batch readings are not stored, and the endpoint already rejects
     duplicate timestamps and gaps over 2 s. So `OUT_OF_RANGE` is the only
     suspect-reading flag that can apply.
7. **Service due counts from the last inspection,** the same clock as ID-84
   (`monthly-inspection-list.md` decision). The alternative was counting from
   the last maintenance event.
8. **ID-101 uses the ID-32 forecast as the "remaining-life estimate".**
   - ID-79 is marked Done in Jira, but the code has no separate remaining-life
     range or confidence.
   - The forecast's window is the range, and its probability is the
     confidence.
   - To change it, replace the qualifying rule in the sweep once a dedicated
     estimate exists.
9. **The bell links to a page rather than opening a popover.**
   - This gives one list implementation and works the same on mobile.
   - The alternative was a `Popover` preview of the latest 10.

10. **The asset's alert history is for owners and Managers.**
    - Found while building: asset history endpoints (assessments, `canViewAssets`) are owner-only,
      which would hide alerts from the Managers who receive and act on them.
    - The alternative was the owner-only asset rule.
    - To change it, look at `NotificationService.assetAlerts` and the `manages` check in
      `asset-overview.tsx`.

## Implementation phases

Build in this order, test-first. Notifications come before cost stories.

- [x] **1. Data:** add the four models and the migration, apply it on your own
  Neon branch, then run `pnpm db:generate`.
- [x] **2. ID-100 inbox, server:**
  - list, count, read and read-all endpoints;
  - visibility rules;
  - integration tests seeding notifications directly.
- [x] **3. ID-100 inbox, web:**
  - header bell with count;
  - `/notifications` page;
  - mark read on click, mark all read;
  - `.docs` for both sides.
- [x] **4. Settings:**
  - GET and PUT endpoints;
  - settings page;
  - link from estate details.
- [x] **5. ID-105/106 anomaly alerts:**
  - raise, update and resolve inside the anomaly check;
  - threshold and out-of-range rules.
- [x] **6. ID-107:**
  - acknowledge and dismiss endpoints;
  - row actions and dismiss dialog;
  - asset page Anomaly alerts section.
- [x] **7. Sweep plus ID-103 service due:**
  - sweep record and once-per-day rule;
  - `SERVICE_DUE` qualify and resolve;
  - open work order exclusion.
- [x] **8. ID-101 predicted repair:** `REPAIR_PREDICTED` qualify and resolve,
  lead window and basis text.
- [x] **9. Wrap-up:**
  - `pnpm api:generate`, `pnpm check-types`, `pnpm test`, `pnpm fix`;
  - `.docs/api/notifications.md`, `.docs/frontend/notifications.md` and the
    README index;
  - set this spec's status.

## Open questions

1. **Who receives notifications.**
   - Proposed: owner and Manager only, matching "authorised to manage".
   - Should Council members also see them? They can view the estate but don't
     manage it.
2. **Default lead times.**
   - Proposed: 14 days for service due, and 30 days for predicted repair.
   - Fine, or does the team want other defaults?
3. **ID-101's "estimate range and confidence level".**
   - Proposed: forecast window plus probability (Decision 8).
   - Zheng Kai (ID-32, ID-79 owner) should confirm this is what ID-79
     intended, since there is no separate remaining-life range in the code.
4. **ID-103's "manufacturer or estate default" source.**
   - The code has category intervals (manufacturer, ID-81) and per-asset
     overrides. There is no estate-wide default.
   - Proposed: show "Set on this asset" for an override. Is that acceptable,
     or is an estate default expected?
5. **Sweep cost.**
   - Sweeping on the first read each day is fine for a handful of estates.
   - If a user ever manages dozens of large estates, move the sweep to Cloud
     Scheduler (Decision 3).
6. **Anomaly checks are manual today.**
   - Nothing calls `anomaly-check` automatically, so ID-105 only fires when
     someone or a device integration posts a batch.
   - Is that acceptable for the demo, or does the team expect device readings
     to trigger checks? If so, that is a separate story.
