# Device monitoring (ID-68)

The flatline review, metric policies and maintenance pauses now live in
Assets › All sensors and the asset Overview (see [devices.md](devices.md) and
[assets.md](assets.md)). All API types come from the generated
`@proj/api/schema` contract. See [API behaviour](../api/flatlined-sensors.md)
and decision 0030.

## Routes

The `/sensors` pages are retired (asset-centric navigation phase 4). Both
route files keep only a `beforeLoad` redirect (`replace: true`); there is no
layout, component or sidebar item.

| File (under `routes/_auth/estates/$estateId/`) | URL | Redirects to |
| --- | --- | --- |
| `sensors/index.tsx` | `/estates/$estateId/sensors` | `/estates/$estateId/assets/devices` |
| `sensors/all/index.tsx` | `/estates/$estateId/sensors/all` | `/estates/$estateId/assets/devices` |

The `_auth` guard checks the destination (`canOpenAllDevices`, which includes
the old `canOpenSensors` audience: owners and same-estate MANAGER or COUNCIL
assignments). Backend checks remain authoritative on every request, and
policy/review `canManage` responses determine whether edit and pause controls
appear.

## Shared components

| File / component | Behaviour / shadcn components |
| --- | --- |
| `assets/devices/-components/metric-policy-settings/` / MetricPolicySettings (with the form, fields, name, status, summary, action and editor files) | Collapsible (optional `defaultExpanded`, used by the All sensors "When to warn" dialog) section with configured count, metric/unit, saved threshold/tolerance, Configured/Not set badge, and Edit/Set up buttons; table on desktop; below 768px a `ul aria-label="When to warn"` of shadcn `Item size="sm"` rows divided by `ItemSeparator` (title measurement name, muted summary line "Warn after", trailing Set/Not set badge then Edit/Set up); Edit/Set up (ghost) opens the editor Dialog, read-only for Council/inactive estates; Table, Badge, Button |
| metric-policy-form.tsx / MetricPolicyDialog; use-metric-policy-editor.ts / useMetricPolicyEditor | `MetricPolicyDialog`: the shared `FormDialog` (title "<Metric> policy", description the current threshold; fields Threshold, Time unit, Tolerance) with Cancel and "Save policy" ("Saving…" while pending, no dismissal); whole minutes/hours and nonnegative tolerance shared estate-wide; validation and save errors show as the dialog's `role="alert"` line. If management is lost mid-edit the draft stays, fields disable and saving is blocked with "Saving is paused until device metrics load"; FormDialog, Field, Input, Select |
| `components/sensors/pause-sensor-dialog.tsx` / PauseSensorDialog | `FormDialog` "Pause <device> <metric>": finite pause for one device/metric, seven-day maximum, automatic expiry/fresh-start explanation; fields Pause duration and Time unit; "Start pause" / "Starting pause…"; errors keep the chosen duration; FormDialog, Field, Input, Select |
| `components/sensors/sensor-line.tsx` / SensorLine | One device metric's flatline state badge and optional Pause button |
| `components/sensors/sensor-format.ts` | Metric/time labels and integer minutes/hours conversion with bounds/overflow validation |

The When to warn section starts collapsed. Its shadcn Button header retains the
title, estate-wide threshold/tolerance description and configured count. A chevron
indicates expansion; aria-expanded/aria-controls expose it to assistive technology,
and the subtitle/count describe the button. The header wraps the count below its
title on narrow screens. Hidden contents stay mounted to preserve the draft and
validation when collapsing/reopening; the header disables while saving.

Within the expanded section, Edit/Set up opens the editor in a modal Dialog named
"<Metric> policy" (one at a time, on mobile and desktop). Cancel, X or Escape
discards unsaved edits
without a request and returns focus to the summary action. A successful save invalidates the existing keys,
refreshes the summary and closes the editor; failures preserve input. While saving,
Cancel, X and Escape are blocked and duplicate submission is prevented. Polling updates saved
summaries without replacing the open draft. Draft/validation and mutation state live
above the responsive branches, so a switch between list/table layouts retains
entered values and an in-progress save. Council/inactive estates have no edit or pause actions. If
review access becomes unavailable while editing, preserve the draft in disabled
fields and remove Save until a successful retry restores the required capability.
Loading/errors never fabricate zero counts. Tolerance is labelled as a total range,
not a plus/minus deviation; detection, policies and maintenance rules are unchanged.

## Hooks (`apps/web/src/lib/flatlined-sensors.ts`)

Calls use the typed client/token bridge and explicitly throw estateError on API
failure. Queries pass React Query abort signals, wait for useAuthenticatedSession,
and use user-first keys. That session hook cancels/removes the old account's cache.

| Hook | Endpoint | Key / invalidation |
| --- | --- | --- |
| useFlatlinePolicies(estateId) | GET /estates/{estateId}/flatline-policies | [userId,"flatline",estateId,"policies"] |
| useFlatlineReview(estateId,view,page) | GET /estates/{estateId}/flatlined-sensors?view=&page=&size=25 | [userId,"flatline",estateId,"review",view,page,25] |
| useAllFlatlineReview(estateId,view) | Page 0, then pages 1..ceil(totalElements/size)-1 via `useQueries`; returns `{ sensors, canManage, isPending, error, refetch }` - entries concatenated and de-duplicated by `deviceId + metric`; `canManage` is the review's `canManage && estateActive`; `refetch` refetches every page of the view. Used by the asset Overview and Assets › All sensors (both `view="ALL"`) | same keys as useFlatlineReview, one per page |
| useSetFlatlinePolicy(estateId,metric) | PUT /estates/{estateId}/flatline-policies/{metric} | Success invalidates [userId,"flatline",estateId] |
| usePauseFlatlineSensor(estateId,sensor) | POST /estates/{estateId}/devices/{deviceId}/flatline-pauses/{metric} | Same prefix invalidation; success closes dialog |

Both queries refresh every 60 seconds while visible, on focus and after successful
mutations; no automatic retries. View changes reset to page zero. Every view/page
has its own cache entry. Successful policy/review canManage and estateActive flags
gate mutation controls. Backend validation and authorization repeat every check.

Device monitoring does not implement ML, gap alerts, asset-condition changes, raw history,
notifications, pause extension or early resume.
