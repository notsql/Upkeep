# 0052 - Notification switches and fixed milestone reminders

**Status:** accepted. Supersedes the settings, threshold and lead-time parts of
`.spec/features/notifications.md`. Spec:
`.spec/features/notification-switches-and-milestone-reminders.md`.

## Context

Estate managers could set a model confidence (51-100%), service lead days and
a repair lead window. Lay staff had no basis for choosing a confidence, a wrong
choice silently hid real faults and made the bell disagree with the asset page,
a number could not say "off", and a single lead time sent one early reminder
then silence until overdue.

## Decision

- **One on/off switch per notification type, per estate**, default on, stored
  as boolean columns on `EstateNotificationSettings` (not a child table: the
  set of types is small and fixed). Off stops new notifications of that type;
  existing ones stay and still resolve.
- **Anomaly alerts use the model's fixed `AnomalyModel.DECISION_THRESHOLD`**;
  no estate can change it.
- **Fixed milestones replace lead times:** service due at 90/60/30/14 days
  before `dueOn` (overdue counts as 14), once each per due date; expected
  repair follows the forecast windows 90/60/30, because the forecast has no
  date, and never steps backwards. A nearer milestone resolves the open
  reminder and raises a new one, keeping one open row per asset and type.
  Tracked in `Notification.milestoneDays`; dedupe stays in the sweep's lookup.
- **A new unusual-readings alert is emailed** to the owner and managers after
  commit, on a separate one-thread executor, with addresses looked up from
  WorkOS at send time. Best effort, no outbox: the in-app alert is the record.
- **Expand now, contract later:** the old three columns become nullable and
  unread; a later PR drops them.

Rejected: keeping a confidence setting (no basis for lay users); configurable
milestones (no demand); a general email outbox (new table and job for a
best-effort alert).
