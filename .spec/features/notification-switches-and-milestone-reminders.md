# Notification switches and milestone reminders

**Status:** agreed
**Owner:** Ong Zheng Kai

Changes the estate notification settings from `.spec/features/notifications.md`
(settings, anomaly alert and daily sweep sections). Depends on
`.spec/features/work-order-assignment.md` for the sixth switch only.

## Problem

Estate managers cannot make sense of the Notification settings screen today.

- "How sure before we warn you (%)" asks lay estate staff to pick a model
  confidence between 51 and 100. They have no basis for choosing a number, and
  a wrong choice silently hides real faults. The model already has a tuned
  decision threshold (`AnomalyModel.DECISION_THRESHOLD = 0.51`); every other
  screen uses it, so the notification bell can disagree with the asset page.
- A manager's real question is "do I want this kind of message at all?" A
  number field cannot say "off", and there is no way to turn off check or
  repair messages.
- "Days of notice before a service is due" and "Notice before an expected
  repair" raise a single notification once, at one lead time. A service due in
  90 days gets one early message and then silence until it is overdue. Fixed
  reminders at 90, 60, 30 and 14 days do this better and need no setting.

## Behaviour

### Settings

- Each estate has one on/off switch per notification type: Unusual readings
  (`ANOMALY`), Service due (`SERVICE_DUE`), Expected repair
  (`REPAIR_PREDICTED`), Check requested (`CHECK_REQUESTED`), Check failed
  (`CHECK_FAILED`), and Work order assigned (`WORK_ORDER_ASSIGNED`, only once
  `work-order-assignment.md` is built; until then it is not in the DTO or on
  screen).
- An estate with no settings row has every switch on.
- A new estate has every switch on.
- `GET /estates/{estateId}/notification-settings` returns every switch as a
  boolean.
- `PUT` requires every switch, each a boolean; a missing or null switch is
  `400`. Unknown fields are ignored (Jackson default).
- `PUT` no longer accepts or returns `anomalyScoreThreshold`,
  `serviceLeadDays` or `repairLeadDays`.
- GET and PUT stay MANAGER-only; PUT on an inactive estate is still `409`.
- Saving clears today's sweep marker (`forgetSweep`), so the next read of
  notifications re-sweeps with the new switches, as today.
- Two managers saving at once: the last write wins, as today.

### Effect of a switch

- When a type's switch is off, no new notification of that type is created
  for the estate. This applies to the sweep (`SERVICE_DUE`,
  `REPAIR_PREDICTED`), the anomaly alert (`ANOMALY`) and the event-driven
  inserts (`CHECK_REQUESTED` in `InspectionListRepository.notifyAssignee`,
  `CHECK_FAILED` in `notifyFailed`, and `WORK_ORDER_ASSIGNED` in its spec).
- Turning a switch off does not hide, delete or resolve existing
  notifications of that type. They stay visible and resolve exactly as they do
  today. (Decision: hiding them would make the unread count jump and lose
  information a manager may still act on.)
- While `SERVICE_DUE` or `REPAIR_PREDICTED` is off, the sweep still runs its
  resolve step for that type, so open ones close when the asset stops
  qualifying (serviced, forecast cleared). Only the insert is skipped.
- Turning a switch on again: the next sweep or event creates notifications as
  normal. A milestone passed while the switch was off is not back-filled; the
  sweep raises only the current milestone (see below).
- Turning off Check requested stops the in-app message only. The check is
  still assigned and still appears on the assignee's inspection list.

### Unusual readings

- An anomaly alert is raised when the run's median score is at or above
  `AnomalyModel.DECISION_THRESHOLD` (0.51) and the run is not suspect, and the
  switch is on. No estate setting changes the threshold.
- `AnomalyAlerts.abnormal()` stops reading `NotificationSettings`' threshold;
  it reads only the `anomalyEnabled` switch.

### Email for a new unusual-readings alert

Depends on `.spec/features/transactional-email-via-resend.md` for the
`EmailSender` port (`void send(OutboundEmail)`; `OutboundEmail` has one `to`,
`subject`, `text`, optional `replyTo`; the `ResendEmailSender` bean exists only
when Resend is configured).

- When `AnomalyAlerts.abnormal()` inserts a NEW open `ANOMALY` notification
  (`insertAnomaly` returns true) and the estate's `anomalyEnabled` switch is
  on, one email per recipient is sent for that alert.
- No email when the alert is updated (`updateAnomaly`), resolved, or lost the
  insert race to another check.
- No email when the switch is off (no notification is created either).
- No email, and no error, when no `EmailSender` bean exists (mail not
  configured). The listener takes `ObjectProvider<EmailSender>` and returns if
  it is absent.
- Recipients: the estate owner (`Estate.ownerUserId`) and every current
  MANAGER, as listed by `CouncilRepository.members(estateId)` (which already
  adds the owner as MANAGER). Each address is sent once even if listed twice.
- Where addresses come from: nowhere in our database. `EstateUser` holds only
  `userId`; `EstateInvitation.email` is the invited address, not a reliable
  current one. Addresses are resolved at send time through
  `CouncilIdentity.user(userId).email()` (implemented by
  `workos/WorkOSService`), the same call member listings use. No email cache
  is added.
- A recipient whose lookup fails, whose email is blank or unverified
  (`Person.verified == false`) is skipped and logged at WARN; the others still
  get the email.
- A send failure is logged at WARN with the notification ID and is not
  retried.
- Email never blocks or fails the anomaly check: it runs after commit, off
  the scoring thread.
- Mechanism: `AnomalyAlerts` publishes `AnomalyAlertRaised(notificationId,
  estateId, assetId)` inside the transaction; a `@TransactionalEventListener`
  (default `AFTER_COMMIT`) hands it to a `TaskExecutor`, the same pattern as
  `AnomalyScoringScheduler.readingsStored`. If the transaction rolls back, no
  email. Chosen over an outbox: the only outbox (`WorkOrderDispatch` /
  `DispatchDeliveryJob`) is specific to work orders and records contractor
  delivery; a general one would be a new table, status machine and job for a
  best-effort alert whose in-app notification is already the record. Cost
  accepted: an email lost to a crash between commit and send is not re-sent.
- Copy (plain English, no scores or codes):
  - Subject: `Unusual readings: <asset name> at <estate name>`
  - Body:
    ```
    Hello,

    The readings from <asset name> at <estate name> look unusual. It may need
    a check.

    See the asset: <web origin>/estates/<estateId>/assets/<assetId>

    You are getting this because you manage <estate name>. A manager can turn
    these messages off under the estate's Notification settings.
    ```
- The web origin is the first entry of the existing `app.cors.allowed-origins`
  property (env `CORS_ALLOWED_ORIGINS`, default `http://localhost:3001`). No
  new property or secret is added; the human has confirmed the first CORS
  origin is the web app's public address in every environment.

### Service due milestones

- Milestones are fixed: 90, 60, 30 and 14 days before `dueOn`. Not
  configurable.
- On a sweep, for each active asset with a due date and no open work order,
  `daysLeft = dueOn - today`. The current milestone is the smallest of
  {90, 60, 30, 14} that is `>= daysLeft`. If `daysLeft > 90` there is no
  milestone and nothing is raised.
- Overdue (`daysLeft < 0`) counts as the 14-day milestone; the summary reads
  "Service overdue since ..." as today. No separate overdue milestone.
- A notification is raised for the current milestone only if no notification
  (open or resolved) exists for the same asset, type, `dueOn` and
  `milestoneDays`. So each milestone fires at most once per due date per asset.
- When a later milestone is reached and the earlier one is still open, the
  sweep resolves the earlier one and inserts the new one in the same savepoint.
  This keeps the existing "one open per asset and type" unique index
  (`Notification_one_open_per_asset_type`) and makes the reminder show as
  unread again.
- Only the nearest applicable milestone fires. An asset first swept with 20
  days left gets the 30-day reminder once, then the 14-day one; it never gets
  the 90 or 60.
- When the asset is serviced, `dueOn` moves to the next date. The open
  notification resolves (asset no longer qualifies, or is replaced), and
  because the dedupe key includes `dueOn`, milestones for the new date start
  again from 90.
- A service-due summary names the milestone in plain words: "Service due in
  30 days (on 12 Dec 2026)"; at 14 days or fewer, "Service due on 12 Dec 2026";
  overdue, "Service overdue since 12 Dec 2026".

### Expected repair milestones (finding)

The breakdown forecast has **no predicted date**. `Forecast` carries only a
`recommendedTimeframe` (`WITHIN_30_DAYS`, `WITHIN_60_DAYS`, `WITHIN_90_DAYS`,
`BEYOND_90_DAYS`) and the three probabilities; `windowDays()` maps these to
30/60/90 (`expectedEndOfLife` is an end-of-life date, not a repair date). So
"14 days before the expected repair" cannot be computed, and "90 days before"
means "the forecast says within 90 days".

- Repair milestones are the forecast windows: 90, 60, 30. There is no 14-day
  repair reminder. (Adding one would need the failure-risk feature to produce
  a date or a 14-day probability; out of scope here.)
- The current milestone is `windowDays(forecast)`. `BEYOND_90_DAYS`, an
  unusable basis, or an open work order means no milestone; any open
  `REPAIR_PREDICTED` resolves, as today.
- A notification is raised for the current milestone only if none exists for
  the same asset, type and `milestoneDays` since the asset last stopped
  qualifying (that is, since the asset's most recent resolved
  `REPAIR_PREDICTED` that was resolved for not qualifying, or ever). Simplest
  rule that matches: dedupe against open notifications plus resolved ones
  created after the last time the asset had no open `REPAIR_PREDICTED` row.
  At build time this can be implemented as "dedupe against rows whose
  `resolvedAt` is null or was set by a milestone replacement"; see Open
  questions.
- Moving to a nearer window (90 -> 60 -> 30) resolves the old one and inserts
  the new one, as for service due.
- If the forecast moves away (30 -> 60), no new notification: the 30-day one
  stays open until the asset leaves all windows, and the 60-day milestone has
  already fired or is skipped. (Decision: a reminder should never step
  backwards.) The open row's summary is not rewritten.
- Summary unchanged in form: "Repair likely within 30 days (72% chance)".

## Data

All in `packages/db/prisma/schema/schema.prisma`. Expand now, contract later
(decision 0029).

### Expand (this feature)

`EstateNotificationSettings` gains five columns, `Boolean @default(true)`:
`anomalyEnabled`, `serviceDueEnabled`, `repairPredictedEnabled`,
`checkRequestedEnabled`, `checkFailedEnabled`. `work-order-assignment.md` adds
`workOrderAssignedEnabled` the same way.

- Columns, not a child table `EstateNotificationSwitch(estateId, type,
  enabled)`. The set of types is small, fixed and known at compile time; one
  row read per estate is what `NotificationSettingsService.forEstate` does
  today; a new type is one column, which it would be in a typed DTO anyway. A
  child table would only pay off with per-user or dynamic types (out of scope).
- `anomalyScoreThreshold`, `serviceLeadDays` and `repairLeadDays` become
  nullable in the same migration so new code can write rows without them, and
  old code still running during the deploy can read existing rows. New code
  never reads them.

`Notification` gains `milestoneDays Int?` (90, 60, 30 or 14; null for
types without milestones). A SQL check limits it to those values and to
`SERVICE_DUE`/`REPAIR_PREDICTED`. Existing open rows keep null; the first
sweep treats an open row with null milestone as "already notified at the
current milestone" (it backfills `milestoneDays` on that row) so the deploy
does not re-send every reminder.

- Dedupe is enforced by the sweep's lookup, as it is today (`openAssets`),
  not by a new unique index: the service-due key needs `dueOn` and the repair
  key needs the episode rule above, neither of which a plain unique index on
  `(assetId, type, milestoneDays)` expresses. The existing partial unique
  index still guarantees at most one open row per asset and type, and the
  per-estate-per-day sweep claim prevents two sweeps racing.
- Index `@@index([assetId, type, milestoneDays])` for the lookup.

### Contract (a later PR, after this is on `prd`)

Drop `anomalyScoreThreshold`, `serviceLeadDays`, `repairLeadDays` from
`EstateNotificationSettings`. Remove `NotificationSettings.DEFAULTS`' old
fields.

Until the expand migration is on Neon `dev`, every manager's notification read
(the sweep), every settings GET/PUT, every anomaly alert and every check
assignment/failure fails on the branch (rule 16).

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/notification-settings` | - | `NotificationSettingsResponse` | MANAGER of estate |
| PUT | `/estates/{estateId}/notification-settings` | `NotificationSettingsRequest` | `NotificationSettingsResponse` | MANAGER of estate |
| GET | (existing notification list endpoints) | - | `NotificationResponse` gains `milestoneDays` | unchanged |

`NotificationSettingsRequest` / `NotificationSettingsResponse`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `anomalyEnabled` | boolean | yes | |
| `serviceDueEnabled` | boolean | yes | |
| `repairPredictedEnabled` | boolean | yes | |
| `checkRequestedEnabled` | boolean | yes | |
| `checkFailedEnabled` | boolean | yes | |
| `workOrderAssignedEnabled` | boolean | yes | added by `work-order-assignment.md` |
| ~~`anomalyScoreThreshold`~~ | removed | | |
| ~~`serviceLeadDays`~~ | removed | | |
| ~~`repairLeadDays`~~ | removed | | |

The response keeps `updatedAt` / `updatedByUserId` if it carries them today.

`NotificationResponse.milestoneDays`: `integer | null`. The UI shows it in
words ("Service due in 30 days"), never the raw field.

Status codes unchanged: `200`, `400` (missing switch), `403`, `404`, `409`
(inactive estate on PUT). Regenerate with `pnpm api:generate`; update
`.docs/api/notifications.md`.

## Frontend

Route unchanged:
`apps/web/src/routes/_auth/estates/$estateId/notification-settings/`, reached
from the Notifications tab in `components/settings/estate-settings-views.tsx`,
MANAGER only.

- `notification-settings-form.tsx` loses the percent field, the service days
  field and the repair select (and `MIN_PERCENT`/`MAX_PERCENT`, the 30/60/90
  options).
- It shows one row per type: a `Label` and helper text, and a shadcn `Switch`
  (`@proj/ui/components/switch` already exists in `packages/ui`). The label is
  the switch's accessible name.
- Save button as today, via `useSaveNotificationSettings` in
  `apps/web/src/lib/notifications.ts`; query key and invalidation unchanged.
- Heading helper text: "Choose which messages this estate's team gets. All
  are on to start with."

| Switch | Label | Helper text |
| --- | --- | --- |
| `anomalyEnabled` | Unusual readings | Tell us when a sensor shows something out of the ordinary. |
| `serviceDueEnabled` | Service due | Remind us 90, 60, 30 and 14 days before a service is due. |
| `repairPredictedEnabled` | Expected repair | Warn us when something is likely to need repair in the next 90, 60 or 30 days. |
| `checkRequestedEnabled` | Check requested | Tell a staff member when they are asked to check something. |
| `checkFailedEnabled` | Check failed | Tell managers when a check finds a problem. |
| `workOrderAssignedEnabled` | Work order assigned | Tell a staff member when a job is given to them. (After work-order-assignment.) |

Notification list items: a `SERVICE_DUE` row shows its server summary; no new
client wording needed beyond the summary. Update
`.docs/frontend/notifications.md` (L60-93).

## Edge cases

- Due date fewer than 14 days away (or overdue) when first swept: one
  14-day reminder, once; no 90/60/30.
- Due date more than 90 days away: nothing until it reaches 90.
- Asset deactivated: not in `activeAssets`, so no new reminders; its open
  ones resolve via `resolveExcept`, as today.
- Asset with an open work order: skipped and its reminder resolves, as today.
  When the work order closes the current milestone fires if it has not
  already fired for this `dueOn`.
- Two sweeps the same day: the `NotificationSweep` claim lets only one run.
  After a settings save `forgetSweep` allows one more; dedupe stops repeats.
- A switch turned off between the claim and the insert (concurrent save):
  the sweep uses the settings it read at the start. At most one extra
  notification; the next save re-sweeps. Accepted.
- Sweeps skipped for days (no manager read): the next sweep raises only the
  current milestone; skipped ones are not back-filled.
- Interval changed so `dueOn` moves earlier or later: new `dueOn`, new
  milestone sequence; the old open row resolves or is replaced.
- Switch off then on with no change in date: a milestone that fired before
  is not resent (dedupe covers resolved rows).
- Anomaly email: WorkOS slow or down, so lookups fail. The alert is
  committed already; the email is skipped for those recipients and logged.
- Anomaly email: a manager removed between commit and send is not emailed,
  as membership is read at send time.
- Anomaly email: estate with no verified manager address: no email, logged.
- Existing rows with old thresholds: ignored; an estate that set 0.80 now gets
  alerts at 0.51. Say so in release notes.

## Out of scope

- Per-user notification preferences.
- Email for any type other than a new `ANOMALY` alert (follow-up: service
  due, expected repair, check failed, work order assigned).
- SMS or push delivery.
- Per-user email opt-out (the estate switch is the only control).
- Retries or an outbox for alert email.
- Caching member email addresses.
- Custom milestone lists or per-estate milestones.
- Quiet hours or digests.
- A 14-day repair reminder or a predicted repair date (needs failure-risk
  changes).
- Back-filling milestones missed while a switch was off.

## Open questions

1. Resolved: repair milestones are 90/60/30 only, reset when the asset
   leaves all windows.
2. Should overdue services get one more reminder (e.g. on the due day), or is
   the 14-day one, which stays open while overdue, enough?
3. Should managers be able to turn off Check requested for staff, given it is
   the only signal a staff member gets? (Proposal: yes, as asked; the check
   list still shows it.)
4. Do we show a one-time note to managers who had raised the confidence above
   51% that the setting is gone?

## Build notes

- A decision record is needed at build time (number assigned then; 0050 is
  reserved by the GCS spec): fixed threshold and fixed milestones replace
  per-estate tuning, and repair milestones follow forecast windows.
- Tests first: `NotificationSweeper` milestone tests (each milestone, nearest
  only, no repeat, reset on new `dueOn`, switch off skips insert but resolves),
  `AnomalyAlerts` fixed threshold, anomaly email listener (sent once on
  insert, not on update, not when switch off, not without a sender, skips
  failed lookups), check insert sites honour switches,
  settings controller 400 on missing switch, web form renders switches by
  label and saves.
