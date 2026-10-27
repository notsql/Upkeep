# Report routing and contractor email API (ID-70)

Source of truth: `packages/api/openapi.json`. Spec:
`.spec/features/equipment-fault-work-orders.md`. Decisions 0041 and 0042.
Implementation: `com.proj.server.routing`, plus hooks in
`com.proj.server.workorder` (see [work-orders.md](work-orders.md)).

## Authority

Every operation requires a JWT subject. Writes and contractor settings use
ID-36's work-order creation check (`WorkOrderService.authorize(create=true)`):
active estate owner or Manager. Crew, Council, Member, Resident and custom
roles get 403; strangers get 404; an inactive estate gets 409. Sending a report
additionally needs Manager or Crew membership, ID-36's rule for report sources.
Reading a work order's dispatch uses ID-36's read check (owner, Manager or
Crew). Routing on estate reports is read through the existing estate report
endpoints. Errors are `EstateError { message }`; responses are
`Cache-Control: private, no-store`.

## How a report is routed

1. `POST /resident/reports` inserts `ReportRouting(state=CLASSIFYING)` in the
   submission transaction. Reports from before ID-70 have no row and are never
   classified.
2. `ReportClassificationJob` (every 15 s, first run after 30 s;
   `app.routing.poll-interval`, `app.routing.initial-delay`) claims a due row
   with `FOR UPDATE SKIP LOCKED` and a 3-minute lease. It reads the photos from
   R2 and calls `FaultClassifier` (Claude `claude-haiku-5-5`). The model sees
   the title, description, location label and photos, never the submitter.
3. Writing the result locks the estate, then the routing row (lease checked).
   Each valid answer is stored in `ReportClassification`.
4. **Automatic routing** needs `EQUIPMENT_FAULT`, a type, `confidence >= 0.80`
   and an `EquipmentProviderRoute` for the type. It then:
   - creates an ID-36 work order through `WorkOrderService.createFromRoutedReport`
     (`EQUIPMENT_FAULT`, `MEDIUM`, `RESIDENT_REPORT` with `sourceReportId`, the
     report's location, the resident's description verbatim, no asset, creator
     `system:report-routing`);
   - moves it `OPEN` → `ASSIGNED` with a `WorkOrderStatusEvent` (version 1);
   - creates a `WorkOrderDispatch` (`PENDING`, no `approvedByUserId`);
   - sets routing to `WORK_ORDER` with `workOrderId`.
5. Anything else goes to `NEEDS_REVIEW` with a reason. The reason is the
   model's own for `INCONCLUSIVE` and `NOT_EQUIPMENT`, or one of: `Confidence
   below threshold`, `No <TYPE> contractor configured`, `The report's location
   is inactive` (ID-36's rules refused the order), `Estate is inactive`, or
   `Automatic classification unavailable` (no API key, or 3 failed attempts
   retried after 30 s and 2 min).
6. `DispatchDeliveryJob` emails `PENDING` dispatches. On success the dispatch
   is `SENT` with `sentAt`. On failure it retries with backoff (30 s × 4ⁿ, at
   most 1 h) and becomes `FAILED` after 5 attempts. `lastErrorCode` is internal:
   `MAIL_NOT_CONFIGURED`, `SMTP_AUTH`, `MESSAGE_TOO_LARGE`, `SMTP_ERROR`,
   `MESSAGE_INVALID`, `IMAGE_STORAGE` or `UNEXPECTED`. Sending never changes the
   work order's status. Delivery is at least once.

Creating a work order from a report through ID-36's
`POST /estates/{estateId}/work-orders` while the report is `NEEDS_REVIEW` moves
its routing to `WORK_ORDER` with that order and the creator. No dispatch is
made; a Manager can email it later.

## Endpoints

| Method and path | Request | Success | Other statuses |
| --- | --- | --- | --- |
| GET `/estates/{estateId}/contractors` | — | 200 `EquipmentContractorResponse[]` in PUMP, LIFT, GATE, LIGHT order; types without a route are absent | 400, 401, 403, 404 |
| PUT `/estates/{estateId}/contractors/{equipmentType}` | `EquipmentContractorRequest` | 200 `EquipmentContractorResponse` | 400 unknown type or invalid name/email (control characters included), 401, 403, 404, 409 inactive estate |
| DELETE `/estates/{estateId}/contractors/{equipmentType}` | — | 204, also when there was none; the provider is kept | 400, 401, 403, 404 |
| POST `/estates/{estateId}/reports/{reportId}/work-order` | `SendToContractorRequest { equipmentType, priority }` | 201 `ReportRoutingResponse` (`WORK_ORDER`, order `ASSIGNED`, dispatch `MANAGER`) | 400, 401, 403, 404 report not in estate, 409 not `NEEDS_REVIEW`, no route for the type, or ID-36 rule (inactive location or estate) |
| POST `/estates/{estateId}/reports/{reportId}/dismiss` | — | 200 `ReportRoutingResponse` (`DISMISSED`) | 400, 401, 403, 404, 409 not `NEEDS_REVIEW` |
| GET `/estates/{estateId}/work-orders/{workOrderId}/dispatch` | — | 200 `WorkOrderDispatchStatusResponse { dispatch: WorkOrderDispatchResponse \| null }` | 400, 401, 403, 404 order not in estate |
| POST `/estates/{estateId}/work-orders/{workOrderId}/dispatch` | `DispatchRequest { equipmentType }` | 201 `WorkOrderDispatchResponse`; order becomes `ASSIGNED` | 400, 401, 403, 404, 409 not an `EQUIPMENT_FAULT` order from a resident report, already emailed, not `OPEN`, or no route for the type |
| POST `/estates/{estateId}/work-orders/{workOrderId}/dispatch/retry` | — | 200 `WorkOrderDispatchResponse` (`PENDING`, attempts reset) | 400, 401, 403, 404 no dispatch in this estate, 409 not `FAILED` |

## DTOs

| DTO | Fields |
| --- | --- |
| `EquipmentContractorRequest` | `name` (1–200 after trimming), `email` (valid, ≤ 254) |
| `EquipmentContractorResponse` | `equipmentType: PUMP \| LIFT \| GATE \| LIGHT`, `name`, `email`, `updatedAt` (the provider's) |
| `SendToContractorRequest` | `equipmentType`, `priority: LOW \| MEDIUM \| HIGH \| URGENT` |
| `DispatchRequest` | `equipmentType` |
| `WorkOrderDispatchResponse` | `equipmentType`, `contractorName`, `contractorEmail` (copied at dispatch), `approval: AUTOMATIC \| MANAGER`, `status: PENDING \| SENT \| FAILED`, `sentAt \| null`, `createdAt` |
| `ReportRoutingResponse` | `state: CLASSIFYING \| NEEDS_REVIEW \| WORK_ORDER \| DISMISSED`, `reason \| null`, `classification \| null`, `workOrder: { id, reference, status, dispatch \| null } \| null`, `decidedAt \| null` |
| `ClassificationResponse` | `outcome: EQUIPMENT_FAULT \| INCONCLUSIVE \| NOT_EQUIPMENT`, `equipmentType \| null`, `confidence` (0–1, two places), `reason`, `createdAt` |

The estate report DTOs carry `routing` (see [estate-reports.md](estate-reports.md)).

Example:

```text
POST /estates/<estate-uuid>/reports/<report-uuid>/work-order
{"equipmentType":"LIFT","priority":"HIGH"}

201 {"state":"WORK_ORDER","reason":"…","classification":{…},
     "workOrder":{"id":"…","reference":"MG-W0042","status":"ASSIGNED",
       "dispatch":{"equipmentType":"LIFT","contractorName":"Acme Lifts",
         "contractorEmail":"faults@acmelifts.example","approval":"MANAGER",
         "status":"PENDING","sentAt":null,"createdAt":"…"}},
     "decidedAt":"…"}
```

## The email

Plain text to the copied address. The subject is `Work order <ID-36
reference>: <Pump|Lift|Gate|Common-area light> fault at <estate name>`, with
control characters replaced. The body has the contractor name, reference,
equipment, estate name and address, location label, submission time (UTC),
the resident's title and description verbatim, and the photo count. Photos are
attached as `photo-N.jpg|png` with their stored bytes. The email never includes
the resident's identity, the model's judgement or storage keys.

## Data

Migration `20261026155915_report_routing_and_dispatch` only adds tables:

- `ServiceProvider`: unique `(estateId, email)`. ID-37 extends it.
- `EquipmentProviderRoute`: primary key `(estateId, equipmentType)`.
- `ReportRouting`: primary key `reportId`, plus `estateId` and an optional
  `workOrderId`, both with composite keys.
- `ReportClassification`: append-only.
- `WorkOrderDispatch`: unique `workOrderId`, with `providerId` (the
  assignment).

Prisma generated the migration and jOOQ was regenerated against disposable
Postgres. **It is not yet applied to Neon `dev`.** Until it is, resident report
submission fails on this branch against Neon, because it inserts the routing
row.

## Configuration

| Setting | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Enables classification; unset sends everything to review. |
| `app.routing.model` | `claude-haiku-5-5`. |
| `SPRING_MAIL_HOST` (`smtp.gmail.com`), `SPRING_MAIL_PORT` (587), `SPRING_MAIL_USERNAME` (the `csd.upkeep` Gmail address), `SPRING_MAIL_PASSWORD` (a Google app password) | Gmail SMTP with STARTTLS required. Without a host there is no sender, and dispatches fail with `MAIL_NOT_CONFIGURED`. |
| `APP_MAIL_FROM`, `APP_MAIL_REPLY_TO` | Optional; blank means the SMTP account and no Reply-To. |
