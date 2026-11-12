# Report routing and contractor email API (ID-70)

Source of truth: `packages/api/openapi.json`. Specs:
`.spec/features/equipment-fault-work-orders.md` and
`.spec/features/fault-categories-and-report-page.md`. Decisions 0047 and 0048.
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
   with `FOR UPDATE SKIP LOCKED` and a 3-minute lease. It calls
   `FaultClassifier` (`OnnxFaultClassifier` over `FaultCategoryModel`: TF-IDF +
   logistic regression exported to ONNX, run in process by onnxruntime, version
   `fault-category-tfidf-v1`). The model reads text only: the title and
   description joined by a space, never the photos, location or submitter.
   Characters outside the Basic Multilingual Plane (emoji) and NUL become
   spaces first, because onnxruntime's Java strings cannot carry them; they
   are never part of a token anyway. The model loads once at startup and the
   application does not start without it. It returns a calibrated probability
   per category (see [Fault categories](#fault-categories)), mapped by
   `Classification.fromProbabilities`.
3. Writing the result locks the estate, then the routing row (lease checked).
   Each valid answer is stored in `ReportClassification`.
4. **Automatic routing** needs `EQUIPMENT_FAULT`, a type, `confidence >= 0.80`,
   a category not in `RoutingDecision.NEVER_AUTOMATIC` and an
   `EquipmentProviderRoute` for the type. It then:
   - creates an ID-36 work order through `WorkOrderService.createFromRoutedReport`
     (`EQUIPMENT_FAULT`, `MEDIUM`, `RESIDENT_REPORT` with `sourceReportId`, the
     report's location, the resident's description verbatim, no asset, creator
     `system:report-routing`);
   - moves it `OPEN` → `ASSIGNED` with a `WorkOrderStatusEvent` (version 1);
   - creates a `WorkOrderDispatch` (`PENDING`, no `approvedByUserId`);
   - sets routing to `WORK_ORDER` with `workOrderId`.
5. Anything else goes to `NEEDS_REVIEW` with a reason. The reason is the
   model's own for `INCONCLUSIVE` and `NOT_EQUIPMENT`, or one of: `Confidence
   below threshold`, `<Category label> reports are always checked by a person`, `No <TYPE> contractor configured`, `The report's location
   is inactive` (ID-36's rules refused the order), `Estate is inactive`, or
   `Automatic classification unavailable` (3 failed attempts, retried after
   30 s and 2 min).
6. `DispatchDeliveryJob` emails `PENDING` dispatches. On success the dispatch
   is `SENT` with `sentAt`. On failure it retries with backoff (30 s × 4ⁿ, at
   most 1 h) and becomes `FAILED` after 5 attempts. `lastErrorCode` is internal:
   `MAIL_NOT_CONFIGURED`, `AUTH`, `MESSAGE_TOO_LARGE`, `PROVIDER_ERROR`,
   `MESSAGE_INVALID`, `IMAGE_STORAGE` or `UNEXPECTED`. Sending never changes the
   work order's status. Delivery is at least once. Email goes through Resend's
   HTTP API (decision 0051): 401/403 → `AUTH`; 413, or a 422 saying an
   attachment or the payload is too large → `MESSAGE_TOO_LARGE`; other 422
   (bad address, unverified from domain) → `MESSAGE_INVALID`; 429, 5xx,
   timeouts and network failures → `PROVIDER_ERROR`. Rows written before 0051
   may still carry the old `SMTP_AUTH` and `SMTP_ERROR`.

Creating a work order from a report through ID-36's
`POST /estates/{estateId}/work-orders` while the report is `NEEDS_REVIEW` moves
its routing to `WORK_ORDER` with that order and the creator. No dispatch is
made; a Manager can email it later.

## Fault categories

Each classification carries a `FaultCategory`, declared in the model's output
order:

| Category | Shown as | Contractor type |
| --- | --- | --- |
| `BROKEN_LIGHT` | Broken light | `LIGHT` |
| `DRAINAGE` | Blocked drain | `PLUMBING` |
| `GRAFFITI` | Graffiti or vandalism | `REPAIRS` |
| `ILLEGAL_DUMPING` | Dumped items | `CLEANING` |
| `NOISE` | Noise | `SECURITY` |
| `OTHER` | Something else | none (always a Manager decision) |
| `PARKING` | Parking | `SECURITY` |
| `ROAD_DAMAGE` | Damaged road or path | `REPAIRS` |
| `RUBBISH` | Rubbish or litter | `CLEANING` |
| `WATER_LEAK` | Water leak | `PLUMBING` |

The top category's probability `p` decides the outcome: `p >= 0.80` with a
contractor type is `EQUIPMENT_FAULT` with that type; `p >= 0.80` without one
is `NOT_EQUIPMENT`; anything else is `INCONCLUSIVE` with the top category's
type (if any) as a suggestion. Confidence is `p` to two places. Reasons read
`Water leak, 94% sure.`, `Something else, 91% sure.` or `Probably noise (62%
sure). Needs a check.`

`RoutingDecision.NEVER_AUTOMATIC` = `{ILLEGAL_DUMPING}`: in
`fault-category-tfidf-v1` it reached 0.90 precision at 0.80 against a 0.95
target, so it always waits for a Manager.

**Changing the category.** `PUT .../reports/{reportId}/category` appends a
`ReportClassification` row with the chosen category, confidence `1.00`, model
`manual`, reason `<label>, chosen by hand.`, outcome and type derived as for a
confident answer, and `classifiedByUserId`. The newest row is current. It
never creates, changes or emails a work order and never moves the routing
state. Choosing the current category is a no-op (200, no row). Allowed in any
state except `CLASSIFYING`; reports from before routing (no routing row) get
409 too. Classifications written by the old water leak model have no category.

## Endpoints

| Method and path | Request | Success | Other statuses |
| --- | --- | --- | --- |
| GET `/estates/{estateId}/contractors` | — | 200 `ContractorDirectoryResponse { contractors: ContractorResponse[] }` by name; owner, Manager or Crew | 400, 401, 403, 404 |
| POST `/estates/{estateId}/contractors` | `ContractorRequest` | 201 `ContractorResponse` | 400 invalid name/email (control characters included), 401, 403, 404, 409 inactive estate or email already used in this estate (case-insensitive) |
| PUT `/estates/{estateId}/contractors/{contractorId}` | `ContractorRequest` | 200 `ContractorResponse` | 400, 401, 403, 404 contractor not in estate, 409 inactive estate or duplicate email |
| DELETE `/estates/{estateId}/contractors/{contractorId}` | — | 204; its defaults are cleared, closed orders and old emails keep the copied name but lose the link | 400, 401, 403, 404, 409 inactive estate or `"<name> still has N open jobs. Reassign them first."` |
| PUT `/estates/{estateId}/contractors/defaults/{equipmentType}` | `ContractorDefaultRequest { contractorId }` | 200 `ContractorResponse` (with its updated `defaultFor`) | 400 unknown type, 401, 403, 404 contractor not in estate, 409 inactive estate |
| DELETE `/estates/{estateId}/contractors/defaults/{equipmentType}` | — | 204, also when there was none | 400, 401, 403, 404, 409 inactive estate |
| POST `/estates/{estateId}/reports/{reportId}/work-order` | `SendToContractorRequest { equipmentType, priority }` | 201 `ReportRoutingResponse` (`WORK_ORDER`, order `ASSIGNED`, dispatch `MANAGER`) | 400, 401, 403, 404 report not in estate, 409 not `NEEDS_REVIEW`, no route for the type, or ID-36 rule (inactive location or estate) |
| PUT `/estates/{estateId}/reports/{reportId}/category` | `ChangeCategoryRequest { category: FaultCategory }` | 200 `ReportRoutingResponse` with the new classification; owner or Manager | 400 unknown category, 401, 403, 404 report not in estate, 409 still `CLASSIFYING`, no routing, or inactive estate |
| POST `/estates/{estateId}/reports/{reportId}/dismiss` | — | 200 `ReportRoutingResponse` (`DISMISSED`) | 400, 401, 403, 404, 409 not `NEEDS_REVIEW` |
| GET `/estates/{estateId}/work-orders/{workOrderId}/dispatch` | — | 200 `WorkOrderDispatchStatusResponse { dispatch: WorkOrderDispatchResponse \| null }` | 400, 401, 403, 404 order not in estate |
| POST `/estates/{estateId}/work-orders/{workOrderId}/dispatch` | `DispatchRequest { equipmentType }` | 201 `WorkOrderDispatchResponse`; order becomes `ASSIGNED` | 400, 401, 403, 404, 409 not an `EQUIPMENT_FAULT` order from a resident report, already emailed, not `OPEN`, or no route for the type |
| POST `/estates/{estateId}/work-orders/{workOrderId}/dispatch/retry` | — | 200 `WorkOrderDispatchResponse` (`PENDING`, attempts reset) | 400, 401, 403, 404 no dispatch in this estate, 409 latest email not `FAILED` or failed only because it was superseded |

Writes are owner/Manager only (`canCreateWorkOrders`). The old
`PUT/DELETE /contractors/{equipmentType}` paths moved under `/contractors/defaults/`
(work-order-assignment.md).

Every contractor email is now created by the work-order assign operation
(`WorkOrderAssignmentService`, see [work-orders.md](work-orders.md#assignment)):
automatic routing, "Send to contractor", the dispatch endpoint above and the
general Assign control. An order may have many `WorkOrderDispatch` rows (one
per contractor assignment); `GET .../dispatch` and retry act on the newest. When
an order is taken away from a contractor (reassigned or unassigned), that
contractor's `PENDING` emails not currently leased by a sender are set to
`FAILED` with `lastErrorCode = SUPERSEDED` and never go. A job that did not
come from a resident report (or has no equipment type) is emailed with the
subject `Work order <reference> at <estate>` and a body carrying the order's
location and description, without photos.

## DTOs

| DTO | Fields |
| --- | --- |
| `ContractorRequest` | `name` (1–200 after trimming), `email` (valid, ≤ 254) |
| `ContractorResponse` | `id`, `name`, `email`, `defaultFor: EquipmentType[]` (sorted) |
| `EquipmentType` | `PUMP \| LIFT \| GATE \| LIGHT \| PLUMBING \| CLEANING \| REPAIRS \| SECURITY` (labels: Pump, Lift, Gate, Common-area light, Plumbing, Cleaning, Painting and repairs, Security) |
| `ChangeCategoryRequest` | `category: FaultCategory` |
| `ContractorDirectoryResponse` | `contractors: ContractorResponse[]` |
| `ContractorDefaultRequest` | `contractorId` |
| `SendToContractorRequest` | `equipmentType`, `priority: LOW \| MEDIUM \| HIGH \| URGENT` |
| `DispatchRequest` | `equipmentType` |
| `WorkOrderDispatchResponse` | `equipmentType \| null` (null for a job not about equipment), `contractorName`, `contractorEmail` (copied at dispatch), `approval: AUTOMATIC \| MANAGER`, `status: PENDING \| SENT \| FAILED`, `sentAt \| null`, `createdAt` |
| `ReportRoutingResponse` | `state: CLASSIFYING \| NEEDS_REVIEW \| WORK_ORDER \| DISMISSED`, `reason \| null`, `classification \| null`, `workOrder: { id, reference, status, dispatch \| null } \| null`, `decidedAt \| null` |
| `ClassificationResponse` | The newest classification. `outcome: EQUIPMENT_FAULT \| INCONCLUSIVE \| NOT_EQUIPMENT`, `equipmentType \| null`, `category: FaultCategory \| null` (null before fault categories), `confidence` (0–1, two places), `reason`, `manual: boolean` (a person chose it), `classifiedByName: string \| null` (WorkOS display name of who chose it, resolved on read; null for the model), `createdAt` |

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
reference>: <category label> at <estate name>` (for example `Rubbish or litter
at ATTA`), using the report's current category and falling back to the
contractor type's label when it has none, with control characters replaced.
The body has the contractor name, reference, `Type of problem` (the same
label), estate name and address, location label, submission time (UTC),
the resident's title and description verbatim, and the photo count. Photos are
attached as `photo-N.jpg|png` with their stored bytes. The email never includes
the resident's identity, the model's judgement or storage keys.

## Data

Migration `20261109090000_report_routing_and_dispatch` only adds tables:

- `ServiceProvider`: unique `(estateId, email)`. ID-37 extends it.
- `EquipmentProviderRoute`: primary key `(estateId, equipmentType)`.
- `ReportRouting`: primary key `reportId`, plus `estateId` and an optional
  `workOrderId`, both with composite keys.
- `ReportClassification`: append-only. Migration
  `20261112112010_report_classification_category` added nullable `category`
  and `classifiedByUserId` (applied to Neon `dev`).
- `WorkOrderDispatch`: unique `workOrderId`, with `providerId` (the
  assignment).

Prisma generated the migration and jOOQ was regenerated against disposable
Postgres. **It is not yet applied to Neon `dev`.** Until it is, resident report
submission fails on this branch against Neon, because it inserts the routing
row.

## Configuration

| Setting | Purpose |
| --- | --- |
| `RESEND_API_KEY` (`app.mail.resend-api-key`) | Resend API key. Unset or blank means there is no sender, and dispatches fail with `MAIL_NOT_CONFIGURED`. |
| `APP_MAIL_FROM` | Required when `RESEND_API_KEY` is set (startup fails otherwise). An address on a Resend-verified domain, bare or `Name <address>`. |
| `APP_MAIL_REPLY_TO` | Optional; blank means no reply-to. |
