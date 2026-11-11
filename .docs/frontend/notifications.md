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
  - Service due: "Based on the service schedule · Every 6 months · Manufacturer interval for the
    category" (or "Set on this asset" for an override).
  - Repair predicted: "Prediction · 42% chance within 30 days · based on 3 recorded repairs" (or
    "based on typical pumps; no repairs recorded yet").
- `EmptyState` "No notifications yet" (`Bell` icon), `ErrorState` with Retry, `LoadingState` while pending.
- `Pagination` ("Notification pages", "Page N of M") when there are more than 20.

## Acknowledge and dismiss (ID-107)

Shared components in `src/components/notifications/`:

- `alert-response-actions.tsx` (`AlertResponseActions`): outline **Mark as seen** (only while the
  response is `NONE`) and **Dismiss** buttons. Nothing once dismissed. A `locked` reason disables
  both and is shown under them. An acknowledge failure shows a destructive `Alert`.
- `dismiss-alert-dialog.tsx`: a `FormDialog` "Dismiss alert" with a required "Reason" `Textarea`
  (max 500). Blank shows the `FieldError` "Enter a reason for dismissing this alert." Server errors
  show in the dialog.
- `alert-response-summary.tsx`: "Not seen yet", or "Marked as seen/Dismissed by NAME on
  DATE: REASON".

Used by:

- the inbox rows: an anomaly row is headed "<asset name> may have a problem" with "Its readings have
  been unusual since <time>." and, while open and not responded to, "Have someone look at it. Mark as
  seen once it's being handled. Dismiss it if this was expected, for example during maintenance."
  Type badges: "Unusual readings", "Service due", "Repair expected"; the repair basis starts
  "Expected repair ·";
- the asset page: `asset-overview/anomaly-alerts-section/anomaly-alerts-section.tsx`, a
  `PageSection` "Unusual readings" (no outer card) on pumps for owners and Managers (`estate.owned ||
  canManageInvitationPermissions`), placed after the condition section. Each alert is a `Card`
  with `ConditionBadge`, an Open/Resolved `Badge`, the server's explanation, "Unusual from <t>
  to <t>", the next step (`UNUSUAL_READINGS_STEP`, while open and not yet responded to), the
  summary and the actions. No scores are shown. Actions are locked on an inactive estate or retired asset. The section
  renders only with at least one alert or on a load error (`ErrorState`); while loading or with
  no alerts it renders nothing.

## Notification settings

`/estates/$estateId/notification-settings` -
`src/routes/_auth/estates/$estateId/notification-settings/index.tsx` (title "Notification settings")
renders `-components/notification-settings-page/notification-settings-page.tsx` and
`notification-settings-form.tsx`.

- Entry: the **Notifications** tab of Estate settings (sidebar Administration › **Estate settings**,
  which links here for a Manager who cannot edit the estate). `canOpenNotificationSettings(permission)`
  (`role === "MANAGER"`, which includes owners) gates the tab, the sidebar entry and the `_auth`
  route guard (`OWNER_GATED`).
- `FormPage` titled "Estate settings" (`Building2`, no breadcrumbs, the notification description),
  then `EstateSettingsViews` (`components/settings/estate-settings-views.tsx`): a `SubNav`
  `nav aria-label="Settings views"` with **Details** (`/edit`, `canOpenEstateSettings`) and
  **Notifications** (this page), each shown only to those who can open it; hidden when empty.
- A form straight on the page (no card): the helper line "Choose which messages this estate's team
  gets. All are on to start with.", then a `FieldGroup` of one horizontal `Field` per type, each a
  `FieldLabel` and `FieldDescription` beside a shadcn `Switch` (`@proj/ui/components/switch`,
  `role="switch"`, named by its label via `aria-labelledby`, described by the helper text):

  | Switch (field) | Label | Helper text |
  | --- | --- | --- |
  | `anomalyEnabled` | Unusual readings | Tell us when a sensor shows something out of the ordinary. |
  | `serviceDueEnabled` | Service due | Remind us 90, 60, 30 and 14 days before a service is due. |
  | `repairPredictedEnabled` | Expected repair | Warn us when something is likely to need repair in the next 90, 60 or 30 days. |
  | `checkRequestedEnabled` | Check requested | Tell a staff member when they are asked to check something. |
  | `checkFailedEnabled` | Check failed | Tell managers when a check finds a problem. |

  **Save settings** sends every switch and shows "Settings saved." (`role="status"`); a refused save
  shows a destructive `Alert`. An inactive estate shows a warning `Alert` and disables the switches
  and the button. There is no confidence percentage and no lead-time field (decision 0052).
- Notification list items show the server `summary`, which already names the reminder milestone in
  words ("Service due in 30 days (on 12 Dec 2026)"); the raw `milestoneDays` is never shown.

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

## Send steps (equipment dispatch)

`CHECK_REQUESTED` rows read "Please inspect <equipment>" and open the Record
inspection page; `CHECK_FAILED` rows read "Crew found a problem with
<equipment>" with the note and a "Send a contractor" step; service-due and
repair-predicted rows get "Send crew to inspect". The header bell now also
shows for Crew. Type labels: "Please inspect", "Problem found". See
[equipment-dispatch.md](equipment-dispatch.md).

## Phones: infinite scroll

Below `md` the paged lists here scroll instead of paging: the shared `LoadMore` sentinel (see design-system.md) appends the next page of Notification pages (`useNotificationFeed`, offset pages, key `[...notificationsQueryKey(userId), "feed"]`).
