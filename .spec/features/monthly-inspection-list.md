# Monthly inspection list and overdue checks (ID-84, ID-86)

**Status:** built (2026-11-01; open questions accepted as proposed)
**Owner:** Yan Hein Latt
**Depends on:** ID-83 (silent-failure flags), ID-81 (service intervals), ID-85
(inspection results), ID-32 (failure-risk forecast), the location registry
(ID-6)

## Problem

Equipment that fails silently, such as common-area lighting, is only caught
when someone goes and looks. Managers can now flag those categories (ID-83)
and record how often they should be serviced (ID-81). Technicians can record
an inspection result (ID-85). But nothing tells anyone **which assets are due
for a check this month**, groups them into an efficient walking round, or
remembers checks that were missed:

- **ID-84:** generate a monthly list of due checks for flagged categories,
  using a prediction where one exists and the service interval otherwise,
  grouped by block and level, without duplicating checks when regenerated.
- **ID-86:** carry missed checks into the next month, count them, and show
  them apart from newly due ones.

ID-85's spec left this story to "define the generated-check lifecycle and how
a technician opens the result form from a due check". This spec does that.

## Behaviour

### Who

- The estate owner and assigned Managers can read the list and generate it
  (`findManaged`, as in ID-81 and ID-83). A same-estate Resident gets 403. Any
  other estate, or one the user doesn't manage, gets 404.
- Generating in an inactive estate gets 409. Reading still works.
- Recording a result from the list uses ID-85's existing form and permissions,
  unchanged.

### Which assets are checked

- An asset is **eligible** when it is active (not deactivated or retired) and
  its category is flagged as failing silently in the estate (ID-83).
- An eligible asset's **due date** is worked out from its last inspection:
  - The **last inspection** is the latest ID-85 result for the asset (Pass or
    Fail) by `inspectedOn`. If there is none, the asset's installation date
    stands in for it.
  - **Never inspected:** with no result and no installation date, the asset is
    due on the first day of the month, with basis `NEVER_INSPECTED`.
  - **Interval:** otherwise, if the asset has an effective service interval
    (ID-81), the due date is the last inspection plus that interval, using
    calendar arithmetic on its unit. Basis `INTERVAL`.
  - **Prediction:** if the asset has a failure-risk forecast (ID-32, currently
    pumps with enough data), its predicted due date is the **start** of its
    recommended window: today for "within 30 days", 30 days ahead for "within
    60 days", 60 days ahead for "within 90 days", and none for "beyond 90
    days". (The draft said the window's end. That would push a pump at risk
    within 30 days into next month's list, so it was changed during the
    build.) When both a predicted and an interval date exist, the **earlier**
    wins and its basis is recorded (`PREDICTION` or `INTERVAL`). See open
    question 1.
  - **Not scheduled:** an asset that has been inspected (or installed) but has
    neither an interval nor a prediction gets no due date. It is listed
    separately as needing an interval.
- An eligible asset is **due this month** when its due date is on or before
  the last day of the current month (Singapore time). A date earlier in the
  month, or in an earlier month, still counts as due.

### Generating the list

- **Generate** creates one **check** for each asset that is due this month and
  has **no open check**. It records the month, due date, basis, the interval
  used (value, unit and source, when there is one), who generated it and when.
- Every generation is recorded (who, when, how many checks it added) as a
  list run, so a month counts as generated even when nothing was due.
- Generating again (**regenerating**) never duplicates a check. It only adds
  checks for assets that have become due since, or that have no open check.
  The response says how many checks were added; adding none is not an error.
- An asset has **at most one open check** at any time, and at most one check
  per month. Both are enforced in the database as well as in the service.
- Generation works on the **current month only**. There is no generating
  ahead for future months or back for past ones.
- Two Managers generating at the same moment produce one set of checks: the
  estate row is locked while generating.

### Completing a check

- A check is **open** until an ID-85 inspection result is recorded for its
  asset. The first result recorded for that asset after the check was
  generated **completes** the check, whatever the outcome. The check stores a
  link to that result and when it was completed.
- A result recorded when the asset has no open check completes nothing, as
  today.
- A failed result still follows ID-85's work-order flow. The check is done
  because the inspection happened; any follow-up is the work order's job.

### Overdue checks (ID-86)

- A check is **Overdue** when it is still open and was generated for an
  earlier month. It is **Due** when it is open and was generated this month,
  and **Done** once completed.
- This month's list always includes every Overdue check, whether or not this
  month's list has been generated yet. Overdue checks are never duplicated:
  the asset's open check is carried over rather than a new one created.
- A check generated in November and still open in December shows as Overdue in
  December and stays Overdue until completed.
- Done checks are listed only in the month they were generated for.
- Checks for assets that have since been retired or deactivated are hidden
  from the list and the counts. They reappear if the asset is restored.

### API reads

- The list response gives, for the current month:
  - the month, whether it has been generated, and when and by whom it was
    last generated;
  - the counts of Overdue, Due and Done checks;
  - every Overdue check, plus every check generated for this month;
  - the eligible assets that are not scheduled (no interval or prediction).
- Each check includes the asset's reference, name and category label, its
  **block** and **level** (from its current location), the due date, basis,
  interval used, status, and, when Done, the result's ID, outcome and date.
- Checks are ordered by block name, then level order (assets with no level
  first, as "Block-wide"), then status (Overdue, Due, Done), then due date,
  then asset reference.

### Screen: Inspections page

- The estate details page gains an **Inspections** link for owners and
  Managers, next to Asset categories.
- `/estates/$estateId/inspections`, titled "Inspections", with the month as
  the description ("November 2026").
- **Summary cards** in the same style as the Asset categories page:
  - **Overdue**: the count, in a warning style when above 0, with "Missed in
    an earlier month".
  - **Due this month**: the count of Due checks.
  - **Done this month**: the count of Done checks.
  - **Not scheduled**: the count of unscheduled assets, with a link to the
    Asset categories page to set intervals. Shown only when above 0.
- A **Generate list** button (or **Regenerate list** once generated), with the
  note "Regenerating adds newly due checks and never duplicates them." It
  shows a toast: "Added N checks." or "No new checks are due."; it is disabled
  in an inactive estate. Until generated, a note reads "This month's list
  hasn't been generated yet."
- Checks are grouped by **block** (a heading per block), then by **level** (a
  subheading per level, with "Block-wide" for assets on the block or a
  block's common area). Each group is a table with these columns:
  - Asset: reference and name, linked to the asset.
  - Category.
  - Due: the due date.
  - Basis: "Every 6 months (asset)", "Every 1 year (category)", "Predicted"
    or "Never inspected".
  - Status: a badge. **Overdue** is red, **Due** blue, **Done** green with the
    outcome ("Done · Pass", "Done · Fail").
  - Action: **Record inspection** (ID-85's form for that asset, shown when the
    user may record), or **View result** for a Done check.
- A **Not scheduled assets** section lists unscheduled assets with their
  category. The Not scheduled card's **Set service intervals** link goes to
  the Asset categories page.
- With nothing Overdue, Due or Done, the page shows "No checks this month."

## Data

Expand-only. This adds two tables:

```prisma
// A spot check due for one asset (ID-84). Open until an inspection result completes
// it; an open check from an earlier month is overdue (ID-86). One open check per asset.
model InspectionCheck {
  id                  String    @id @default(uuid()) @db.Uuid
  estateId            String    @db.Uuid
  assetId             String    @db.Uuid
  month               DateTime  @db.Date // first day of the month it was generated for
  dueOn               DateTime  @db.Date
  dueBasis            String    @db.VarChar(15) // PREDICTION | INTERVAL | NEVER_INSPECTED
  intervalValue       Int?
  intervalUnit        String?   @db.VarChar(5)
  intervalSource      String?   @db.VarChar(8) // ASSET | CATEGORY
  generatedByUserId   String    @db.VarChar(255)
  generatedByName     String?   @db.VarChar(255) // WorkOS snapshot
  generatedAt         DateTime  @default(now()) @db.Timestamptz(6)
  completedByResultId String?   @unique @db.Uuid
  completedAt         DateTime? @db.Timestamptz(6)

  estate      Estate                 @relation(fields: [estateId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  asset       Asset                  @relation(fields: [assetId, estateId], references: [id, estateId], onDelete: Restrict, onUpdate: Restrict)
  completedBy AssetInspectionResult? @relation(fields: [completedByResultId], references: [id], onDelete: Restrict, onUpdate: Restrict)

  @@unique([assetId, month])
  @@index([estateId, month])
}
```

```prisma
// Append-only record of each generation of an estate's monthly inspection list (ID-84),
// so a run that added nothing still counts as generated.
model InspectionListRun {
  id                String   @id @default(uuid()) @db.Uuid
  estateId          String   @db.Uuid
  month             DateTime @db.Date
  added             Int
  generatedByUserId String   @db.VarChar(255)
  generatedByName   String?  @db.VarChar(255)
  generatedAt       DateTime @default(now()) @db.Timestamptz(6)

  estate Estate @relation(fields: [estateId], references: [id], onDelete: Restrict, onUpdate: Restrict)

  @@index([estateId, month, generatedAt])
}
```

`Estate`, `Asset` and `AssetInspectionResult` gain back-relations. The
migration adds two things by hand that Prisma can't express:

- A partial unique index, so an asset can have only one open check:
  `CREATE UNIQUE INDEX "InspectionCheck_one_open_per_asset" ON
  "InspectionCheck" ("assetId") WHERE "completedByResultId" IS NULL`.
- `CHECK` constraints:
  - `dueBasis` is one of the three values.
  - The interval columns are all null or all set, with the same limits as
    ID-81.
  - `month` is the first day of a month.
  - `completedAt` is set exactly when `completedByResultId` is.

**Change to ID-85's code:** `InspectionService.create` completes the asset's
open check, if there is one, in the same transaction as saving the result.
ID-85's request, response and screens don't change.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/inspection-list` | - | `InspectionListResponse` | Owner or assigned Manager |
| POST | `/estates/{estateId}/inspection-list/generate` | - | `GenerateInspectionListResponse { added: integer, list: InspectionListResponse }` | Owner or assigned Manager; active estate |

The response types:

- `InspectionListResponse`:
  - `month`: date, the first day of the current month
  - `estateActive`: boolean
  - `generatedAt`: date-time or null, the latest generation this month
  - `generatedByName`: string or null
  - `overdueCount`, `dueCount`, `doneCount`: integers
  - `checks`: `InspectionCheckResponse[]`
  - `unscheduled`: `UnscheduledAssetResponse[]`
- `InspectionCheckResponse`:
  - `id`
  - `assetId`, `assetReference`, `assetName`, `categoryLabel`
  - `block` (`{ id, name }`) and `level` (`{ id, name }` or null)
  - `dueOn`: date
  - `dueBasis`: `"PREDICTION" | "INTERVAL" | "NEVER_INSPECTED"`
  - `interval`: `ServiceInterval` or null
  - `intervalSource`: `"ASSET" | "CATEGORY"` or null
  - `status`: `"OVERDUE" | "DUE" | "DONE"`
  - `result`: `{ id, outcome: "PASS" | "FAIL", inspectedOn }` or null
- `UnscheduledAssetResponse`: `assetId`, `assetReference`, `assetName`,
  `categoryLabel`.

Both endpoints are added to the `SecurityConfig` allowlist. Nullable object
fields are emitted as `oneOf` with null, as in ID-81.

## Edge cases

- **Last inspection after the due date.** It completes the open check, and
  next time the due date is counted from that inspection.
- **An inspection recorded before this month's generation.** It moves the due
  date, so the asset may not be due at all. No check is created.
- **The category is unflagged while a check is open.** The check stays and can
  still be completed. Regeneration adds no new checks for that category.
- **The interval changes while a check is open.** The open check keeps the
  due date and interval it was generated with. The change applies from the
  next check.
- **The asset moves location.** Grouping uses its current location. The check
  doesn't store a location.
- **An asset on a common area of a level** is grouped under that level. One on
  a block's common area, or directly on the block, goes under "Block-wide".
- **A deactivated location.** The asset is grouped by the location's name all
  the same. Location administration is out of scope.
- **Concurrent result and generation.** The estate row lock in generation, and
  the partial unique index, keep one open check per asset. A result committed
  first completes the old check before a new one can be created.
- **Month boundaries** use the Singapore calendar, as ID-85's dates do.
- **Two results for the asset on the same day.** Only the first completes the
  check. The second completes nothing.

## Out of scope

- Generating for future or past months, and browsing past months' lists.
- Assigning checks to a technician, or scheduling rounds by day.
- Cancelling or editing a check by hand.
- Notifications or reminders about due or overdue checks (ID-100 onwards).
- Changing the failure-risk model, or which categories it supports (ID-80,
  ID-32).
- Crew or Council access to the list (see open question 2).
- Exporting or printing the list.

## Decisions

Recorded on 2026-11-01. The draft's three open questions were accepted as
proposed (1–3); the rest were made during the build or in review with the
owner. Each says where to change it.

1. **Prediction and interval: the earlier wins.** Even when a forecast exists,
   the interval stays a backstop if the model is confident for a long time.
   *Alternative:* a prediction always replaces the interval. *Change in:*
   `DueDates.due` (`apps/server/.../inspectionlist/DueDates.java`) and
   `DueDatesTests`.
2. **Owners and Managers only.** Crew record inspections but can't see the
   list. *Alternative:* read-only for Crew. *Change in:*
   `InspectionListService.managed` (`findManaged`), the estate details link
   condition, and the access tests.
3. **Never inspected, no installation date: due immediately**
   (`NEVER_INSPECTED`), so every flagged asset gets a first check.
   *Alternative:* treat it as Not scheduled. *Change in:* `DueDates.due`.
4. **The clock counts from the last inspection, not the last service.**
   *Last inspection* means the latest ID-85 inspection result (Pass or Fail),
   else the installation date. Maintenance events in the asset history
   (ID-49's Record event, such as a routine service or repair) do **not**
   reset it. For example, with "every 6 months", an inspection on 1 May and a
   logged service on 1 Aug still give a due date of 1 Nov. Chosen because the
   list is about checks, and inspection results are what close checks.
   Discussed with the owner and kept as is, to revisit if needed.
   *Alternative:* count from the later of the last inspection and the last
   maintenance or repair event (not breakdown reports), so a recently serviced
   asset isn't re-checked. *Change in:* `InspectionListRepository.lastInspections`
   (add the latest qualifying `AssetEvent.occurredOn`) or the base date in
   `DueDates.due`, plus new tests.
5. **A prediction is due at the start of its window:** today for "within 30
   days", +30 days for 60, +60 days for 90, and none for "beyond 90 days". The
   draft said the end of the window, which would push an at-risk pump into
   next month. *Change in:* `DueDates.predicted`.
6. **Any recorded result completes the open check**, Pass or Fail. A Fail
   follows ID-85's work-order flow, and the check is not reopened.
   *Alternative:* only a Pass completes it. *Change in:* the
   `checks.complete(...)` call in `InspectionService.create` (ID-85's code)
   and `InspectionListRepository.complete`.
7. **One open check per asset, and one check per asset per month.** Enforced
   by a partial unique index and `@@unique([assetId, month])`. A 7-day
   interval therefore still means at most one check a month. *Change in:* the
   migration's indexes and `InspectionListRepository.checked`.
8. **Every generation is recorded** (`InspectionListRun`), so "generated" and
   "last generated by" work even when nothing was added. Added during the
   build.
9. **Grouping uses the asset's current location**, not one stored on the
   check. A moved asset moves group. *Change in:*
   `InspectionListService.place`.
10. **Current month only.** No generating ahead and no browsing past months
    (see Out of scope). *Change in:* `InspectionListService.generate` and
    `list`, plus a month parameter on the API.
11. **"Flagged" means the ID-83 category flag in the estate** (Lighting by
    default). Known inconsistency: ID-32's failure-risk dashboard hardcodes
    Pump as its silent-failure category
    (`FailureRiskConstants.SILENT_FAILURE_CATEGORIES`) instead of reading
    ID-83. That code belongs to another owner and was left unchanged.
12. **Changes outside this story:**
    - `InspectionService.create` (ID-85) gained the completion call.
    - `SummaryCard` moved to `apps/web/src/components/summary-card.tsx`,
      shared with the Asset categories page.
    - Six web tests got `as never` on their `api.POST` error mocks (council
      page, custom-role invitations, custom-role acceptance, estate editor,
      invitation acceptance, pending invitations). The new POST endpoint
      pushed the union of POST response types past what TypeScript can match
      against an uncast mock. Their assertions are unchanged.

## Implementation phases

- [x] 1. Migration and jOOQ: `InspectionCheck`, the partial unique index and
      the checks, on the developer's own Neon branch.
- [x] 2. Server, tests first:
  - due-date rules (interval, prediction, never inspected, not scheduled);
  - generation and regeneration;
  - completion from ID-85's create;
  - status and overdue carry-over;
  - grouping order;
  - access.
- [x] 3. Contract: `pnpm api:generate`, with the nullability customizer.
- [x] 4. Web, tests first: hooks, the Inspections page (cards, generate,
      grouped tables, not scheduled) and the estate details link.
- [x] 5. `.docs` for the API and frontend, and the README links.
