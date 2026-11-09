# Notifications (ID-100, ID-101, ID-103, ID-107) and notification settings

API: [notifications.md](../api/notifications.md).

## Header bell

`src/components/shell/notification-bell.tsx`, rendered by `components/shell/header.tsx` for signed-in
users before the theme toggle. Shown only when `useAppAccess()` lists an estate with role `MANAGER`
(owners report `MANAGER`). A ghost icon `Link` to `/notifications` named "Notifications" or
"Notifications, N unread", with a badge showing N (capped at "99+", hidden at 0).

## Route

`/notifications` - `src/routes/_auth/notifications/index.tsx` (title "Notifications") renders
`-components/notifications-page/notifications-page.tsx`:

- `PageLayout` + `PageHeader` with a **Mark all as read** outline `Button`, disabled when the unread
  count is 0 or while saving; a failure shows a destructive `Alert`.
- A `ul` named "Notifications" of `notification-item.tsx` rows: type `Badge` ("Anomaly",
  "Service due", "Repair predicted"; variant from `notificationTypeTone`: destructive, info, warning), "Unread" text for unread rows, relative time in a `time`
  element (absolute time on hover), the summary, then "Asset name (reference) · Estate name".
  Each row is a `Link` to `/estates/$estateId/assets/$assetId`; opening an unread row marks it read.
  Date-driven rows add a basis line under the summary:
  - Service due: "Interval-based, not a prediction · Every 6 months · Manufacturer interval for the
    category" (or "Set on this asset" for an override).
  - Repair predicted: "Prediction · 42% chance within 30 days · based on 3 recorded repairs" (or
    "based on typical pumps; no repairs recorded yet").
- `EmptyState` "No notifications yet" (`Bell` icon), `ErrorState` with Retry, `LoadingState` while pending.
- `Pagination` ("Notification pages", "Page N of M") when there are more than 20.

## Acknowledge and dismiss (ID-107)

Shared components in `src/components/notifications/`:

- `alert-response-actions.tsx` (`AlertResponseActions`): outline **Acknowledge** (only while the
  response is `NONE`) and **Dismiss** buttons. Nothing once dismissed. A `locked` reason disables
  both and is shown under them. An acknowledge failure shows a destructive `Alert`.
- `dismiss-alert-dialog.tsx`: a `FormDialog` "Dismiss alert" with a required "Reason" `Textarea`
  (max 500). Blank shows the `FieldError` "Enter a reason for dismissing this alert." Server errors
  show in the dialog.
- `alert-response-summary.tsx`: "Not yet acknowledged", or "Acknowledged/Dismissed by NAME on
  DATE: REASON".

Used by:

- the inbox rows: anomaly rows show the summary and the actions under the link;
- the asset page: `asset-overview/anomaly-alerts-section/anomaly-alerts-section.tsx`, a
  `SectionCard` "Anomaly alerts" on pumps for owners and Managers (`estate.owned ||
  canManageInvitationPermissions`), placed after the condition section. Each alert is a `Card`
  with `ConditionBadge`, an Open/Resolved `Badge`, scores, explanation, detected times, the
  summary and the actions. Actions are locked on an inactive estate or retired asset. The card
  renders only with at least one alert or on a load error (`ErrorState`); while loading or with
  no alerts it renders nothing.

## Notification settings

`/estates/$estateId/notification-settings` -
`src/routes/_auth/estates/$estateId/notification-settings/index.tsx` (title "Notification settings")
renders `-components/notification-settings-page/notification-settings-page.tsx` and
`notification-settings-form.tsx`.

- Entry: sidebar Administration › **Notification settings** (`BellRing`), between Asset categories
  and Estate settings. `canOpenNotificationSettings(permission)` (`role === "MANAGER"`, which
  includes owners) gates both the sidebar and the `_auth` route guard (`OWNER_GATED`).
- A `Card` form: "Anomaly score threshold" number input (0.51-1.00, two decimals), "Service reminder
  lead time (days)" number input (0-365), "Repair prediction lead time" `Select` (30/60/90 days),
  each with a `FieldDescription`; invalid values show a `FieldError` and set `aria-invalid`.
  **Save settings** shows "Settings saved." (`role="status"`); a refused save shows a destructive
  `Alert`. An inactive estate shows a warning `Alert` and disables the form.

## Data (`src/lib/notifications.ts`)

| Hook | Call | Query key / effect |
| --- | --- | --- |
| `useUnreadNotificationCount(enabled)` | GET `/notifications/unread-count` | `[userId, "notifications", "unread-count"]`; refetch every 60 s and on focus |
| `useNotifications(page)` | GET `/notifications?page&size=20` | `[userId, "notifications", "page", page]` |
| `useMarkNotificationRead()` | POST `/notifications/{notificationId}/read` | invalidates `[userId, "notifications"]` |
| `useMarkAllNotificationsRead()` | POST `/notifications/read-all` | invalidates `[userId, "notifications"]` |
| `useAssetAnomalyAlerts(estateId, assetId)` | GET `/estates/{estateId}/assets/{assetId}/anomaly-alerts` | `["estates", userId, "anomaly-alerts", estateId, assetId]` |
| `useAcknowledgeAlert()` | POST `/notifications/{notificationId}/acknowledge` | invalidates `[userId, "notifications"]` and `["estates", userId, "anomaly-alerts"]` |
| `useDismissAlert()` | POST `/notifications/{notificationId}/dismiss` | same as acknowledge |
| `useNotificationSettings(estateId)` | GET `/estates/{estateId}/notification-settings` | `["estates", userId, "notification-settings", estateId]` |
| `useSaveNotificationSettings(estateId)` | PUT `/estates/{estateId}/notification-settings` | invalidates the settings key |

All throw `estateError(...)`. The session comes from `useAuthenticatedSession` (`lib/access.ts`), which
drops a previous user's cached queries. `formatRelativeTime` formats "just now", "5 minutes ago",
"yesterday".
