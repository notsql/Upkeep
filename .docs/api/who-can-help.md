# Who can help API

Names the roles in an estate whose members can do the action a warning points
at, so a reader without the button can be told who to ask (spec
`.spec/features/plain-english-wording.md`, "Who can help"). Role names only,
never member names. `packages/api/openapi.json` is the source of truth.

## GET `/estates/{estateId}/who-can-help`

`operationId: whoCanHelp`. Bearer token required (401 without one).

| Query | Type | Notes |
| --- | --- | --- |
| `action` | `HelpAction` (required) | `REPLACE_SENSOR`, `PAUSE_SENSOR_WARNINGS`, `GENERATE_CONNECTION_KEY`, `RECORD_CONDITION`, `ACKNOWLEDGE_ALERT`, `REVIEW_DUPLICATE`, `SEND_CREW`, `SEND_CONTRACTOR` |

200 `WhoCanHelpResponse`:

| Field | Type | Notes |
| --- | --- | --- |
| `action` | `HelpAction` | Echoes the request |
| `roles` | string[] | Display names, each once: `Manager`, `Crew`, `Council`, `Member`, `Resident` (preset order), then custom role names A-Z, then `estate owner` last. Empty when nobody can. |

| Status | When |
| --- | --- |
| 400 | Unknown `action` |
| 404 | Estate missing, or the caller is neither its owner nor one of its members (any role, residents included) |

```json
GET /estates/5f0c…/who-can-help?action=SEND_CONTRACTOR
200 { "action": "SEND_CONTRACTOR", "roles": ["Manager", "estate owner"] }
```

## How the answer is worked out

`WhoCanHelpService` (package `com.proj.server.help`) asks, for the owner and
every `EstateUser` row, the same permission check the action's endpoint uses.
There is no second table of who may do what:

| Action | Check (the endpoint's own guard) |
| --- | --- |
| `REPLACE_SENSOR`, `GENERATE_CONNECTION_KEY`, `RECORD_CONDITION` | `EstateRepository.findOwned` (device replace/credential, assessments) |
| `PAUSE_SENSOR_WARNINGS` | `FlatlineService.canPause` (the write half of its `access`, platform admin ignored) |
| `ACKNOWLEDGE_ALERT`, `SEND_CREW` | `EstateRepository.findManaged` (notification visibility, inspection list and requests) |
| `REVIEW_DUPLICATE` | `EstateReportService.canReviewDuplicates` (a `MANAGER` membership; the owner alone is not enough) |
| `SEND_CONTRACTOR` | `WorkOrderService.canCreate` (owner or Manager) |

Only roles someone currently holds appear. The estate being inactive is not
part of the answer: every write is refused in an inactive estate anyway.
Nothing is cached server-side, so a custom-role change shows on the next call.
`WhoCanHelpIntegrationTests` holds the parity test: for each action, a member's
role is in the answer if and only if that member's request to the guarded
endpoint passes the permission check.
