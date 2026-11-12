# Fault categories and the fault report page

**Status:** agreed (2026-11-12). Open questions settled as drafted: manual
reclassifying never routes by itself; the types and mapping are as tabled.
**Owner:** unassigned
**Revises:** [water-leak-classifier.md](water-leak-classifier.md) (the two-class
decision) and the estate fault report detail screen.

## Problem

1. The classifier only says "water leak" or "not a water leak". The
   [civic complaints dataset][kaggle] it is trained on labels every complaint
   with a type (garbage, pothole, water leak, graffiti, noise, illegal
   dumping, broken streetlight, parking...), but all of those are thrown away
   as `NOT_LEAK`. A Manager learns nothing about a report the model is sure is
   not a leak.
2. When the model is wrong, nobody can correct it. A Manager can only send the
   report to a contractor or dismiss it; the wrong label stays on screen.
3. The detail page (`/estates/$estateId/reports/$reportId`) reads as a stack of
   unrelated blocks: two edit buttons wedged between fields, a duplicate picker
   that is always open, and a "Routing" card using system words ("No PLUMBING
   contractor configured", "Model assessment", "SUBMITTED"). The thing a
   Manager has to do next is at the bottom of the page.

[kaggle]: https://www.kaggle.com/datasets/wajahattaj/civic-and-municipality-complaint-system-dataset

## Behaviour

### Fault categories

- A report has a **category**, one of a fixed list taken from the dataset's
  `issue_type` values. Spelling variants are merged (`water_leakage` and
  `water-leak` become one). Counted on
  the dataset (2026-11-12), 1,100 rows reduce to 369 distinct sentences, and
  no sentence carries two types:

  | Dataset type | Sentences | Category | Shown as | Contractor type it routes to |
  | --- | --- | --- | --- | --- |
  | `pothole` | 54 | `ROAD_DAMAGE` | Damaged road or path | Painting and repairs (new) |
  | `garbage` | 53 | `RUBBISH` | Rubbish or litter | Cleaning (new) |
  | `streetlight` | 52 | `BROKEN_LIGHT` | Broken light | Common-area light |
  | `water_leakage`, `water-leak` | 47 | `WATER_LEAK` | Water leak | Plumbing |
  | `noise` | 46 | `NOISE` | Noise | Security (new) |
  | `graffiti` | 26 | `GRAFFITI` | Graffiti or vandalism | Painting and repairs (new) |
  | `drainage` | 24 | `DRAINAGE` | Blocked drain | Plumbing |
  | `illegal-dumping` | 23 | `ILLEGAL_DUMPING` | Dumped items | Cleaning (new) |
  | `illegal_parking` | 22 | `PARKING` | Parking | Security (new) |
  | `other` | 22 | `OTHER` | Something else | - (always a Manager decision) |

  `DRAINAGE` matters: every false positive of the leak model was a drainage
  report. As its own category it no longer has to pass as "not a leak".

  Every category except `OTHER` can be sent to a contractor, automatically
  or by hand. `EquipmentType` gains `CLEANING`, `REPAIRS` and `SECURITY`, so
  the Contractors page lets an estate set a default contractor for each. The
  column is a string validated by Spring, so this needs no migration.

  Every type has at least 22 distinct sentences, so none is merged away.
  `OTHER` is also what a Manager picks for lifts, pumps and gates, which the
  dataset does not cover.
- The model outputs a calibrated probability per category. Spring maps the
  result onto the existing `Classification`:

  | Condition | Outcome | Equipment type | Confidence |
  | --- | --- | --- | --- |
  | top `p >= 0.80`, category has a contractor type | `EQUIPMENT_FAULT` | that type | `p` |
  | top `p >= 0.80`, category has none | `NOT_EQUIPMENT` | none | `p` |
  | otherwise | `INCONCLUSIVE` | the top category's type, if any | `p` |

  `RoutingDecision` is unchanged: any category with a contractor type routes
  automatically at `>= 0.80` when the estate has a default contractor for
  that type; otherwise it waits for a Manager.
- The reason Spring writes becomes "Water leak, 94% sure.", "Probably noise
  (62% sure). Needs a check." and so on.

### Changing the category (reclassifying)

- An estate owner or Manager can change a report's category from the detail
  page, in any routing state except `CLASSIFYING`.
- Changing it appends a `ReportClassification` row with the chosen category,
  confidence `1.00`, model `manual`, and the user's ID. The newest row is the
  report's current classification, so the history of model and manual labels
  is kept.
- It never creates, changes or emails a work order by itself. While the report
  is `NEEDS_REVIEW`, the "Send to contractor" dialog then suggests the new
  category's contractor type.
- Choosing the category it already has is a no-op (200, no new row).

### The detail page

Laid out around the question "what do I need to do with this report?":

```
Fault reports > water pipe leaked
water pipe leaked                                [Create work order]
Submitted · Medium urgency · Reported 12 Nov 2026, 2:58 pm

+-- Next step ----------------------------+  +-- Details ------------------+
| Waiting for you to decide               |  | Estate     ATTA             |
| No plumbing contractor is set up for    |  | Location   Block 10 > L5  ✎ |
| this estate. Set one up ->              |  | Urgency    Medium         ✎ |
|                                         |  | Type       Water leak     ✎ |
| [Send to contractor]  [Dismiss]         |  |            (sorted automatic-|
+-----------------------------------------+  |            ally, 99% sure)  |
+-- What was reported --------------------+  | Updated    12 Nov, 2:58 pm  |
| some issue                              |  +-----------------------------+
| Photos: none                            |  +-- Same problem as another? -+
+-----------------------------------------+  | [Mark as duplicate...]      |
                                             +-----------------------------+
```

- The page title is the report's own title. Status and urgency are badges
  under it, in plain words ("Submitted", not `SUBMITTED`).
- **Next step** card comes first and reflects the routing state: waiting for a
  decision (with the actions), sent to a contractor (work order link, email
  status, retry), dismissed, or "Sorting this report..." while classifying.
  "No `<TYPE>` contractor configured" is shown as "No plumbing contractor is
  set up for this estate" with a link to the Contractors page.
- **Details** card holds every editable field with its own edit button in the
  row: location, urgency and the new type (category). The automatic label and
  its confidence are shown under the type; after a manual change it reads
  "Changed by <name>, <date>".
- **Duplicate** becomes a compact card with one "Mark as duplicate" button
  that opens a dialog with the picker. An already-linked report shows the
  link and "Undo" as today.
- "Create work order" is hidden once the report has a work order; a "View work
  order" link replaces it.
- Two columns at `lg` and wider, one column below, with the Next step card
  first on phones.
- Built only from `packages/ui` shadcn components; the screen stays in its
  current folder route.

### Everything else that said "water leak"

No user-facing text may assume a report is a water leak:

- **Contractor email.** The subject becomes `Work order <reference>:
  <category shown as> at <estate>` (for example "Rubbish or litter at ATTA"),
  falling back to the contractor type's label when the report has no
  category. The body's "Equipment" line becomes "Type of problem".
- **Contractors page.** "Send new water-leak reports for ... to" and "When a
  resident reports a water leak..." become wording about any reported
  problem of that type, and the page lists the three new contractor types.
- **Fault reports list.** Each row shows the report's type badge.
- **Classification reasons** are written per category (see above).
- **In-app notifications** carry no classification today and are unchanged.

## Data

`ReportClassification` gains two nullable columns (expand-only, safe with the
code already running):

- `category String? @db.VarChar(40)` - null on rows written before this change.
- `classifiedByUserId String? @db.VarChar(255)` - set on manual rows only.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| PUT | `/estates/{estateId}/reports/{reportId}/category` | `ChangeCategoryRequest { category: FaultCategory }` | 200 `ReportRoutingResponse` | owner or Manager; 403 others, 404 not in estate, 409 still classifying or estate inactive |

`ClassificationResponse` gains `category: FaultCategory | null`, `manual:
boolean` and `classifiedByName: string | null`. `FaultCategory` is a new enum
in the contract. Then `pnpm api:generate`.

## Model (ml-research)

New notebooks `06-fault-category-classifier.ipynb` and
`07-fault-category-export.ipynb`, reusing `water_leak_data.py`'s template
stripping and sentence-level de-duplication (generalised, not copied).
The dataset lives in `ml-research/data/report-classifier/` (renamed from
`water-leak/`, since it now feeds every category).

- **Decision (2026-11-12): TF-IDF + logistic regression ships first**
  (`fault-category-tfidf-v1`, notebook 08, one ONNX file with a string
  input, no tokenizer in Java), for time. The MiniLM below is still trained
  and may replace it later.
- Same recipe as the leak model: `all-MiniLM-L6-v2`, fine-tuned with a
  multi-class head, square-root class weights, one temperature for
  calibration, int8 ONNX export.
- Five-fold cross-validation **by sentence**, stratified by category.
- Targets at 0.80: precision `>= 0.95` on every routable category (a false
  route emails a contractor for nothing) and macro F1 `>= 0.85` over all
  categories. A category that misses its precision target is shipped but
  marked never-automatic in `RoutingDecision` until it meets it. TF-IDF + logistic regression is the reference row.
- Ships as `routing/fault-category-model.onnx` + tokenizer, version
  `fault-category-minilm-v1`, replacing the leak model. New parity fixture
  and model note.

## Edge cases

- Reports classified by the leak model have no category: the page shows "Not
  sorted into a type yet" and the Manager can pick one.
- Reclassifying while the job is mid-classification is refused (409), so a
  model answer cannot land on top of a manual one.
- Reclassifying a report already sent to a contractor only changes its label.
- Two Managers changing the category at once: both rows are kept; the later
  one is current.
- The model has never seen lifts, pumps or gates. They should come out as low
  confidence and go to review; the evaluation checks a handful by hand and
  the result is written down, not assumed.

## Out of scope

- Re-running the model on a Manager's request, or retraining from manual
  labels.
- Categories for lifts, pumps or gates (no data).
- Filtering the fault reports list by category.
- Residents seeing or changing the category.

## Open questions

1. Is the category list above acceptable, given it comes from US street
   complaints rather than estates?
2. Should reclassifying while `NEEDS_REVIEW` route automatically when a
   contractor is set up, instead of only pre-filling the send dialog? (Draft
   says no.)
3. Are Cleaning, Painting and repairs, and Security the right new contractor
   types, and is the category-to-type mapping right?

## Implementation phases

- [x] Agree this spec.
- [ ] Data preparation and label review for all categories.
- [ ] Notebook: train, cross-validate to targets, export, parity fixture.
- [ ] Prisma migration, `pnpm db:generate`.
- [ ] Server red-green: probability mapping, parity test, category endpoint.
- [ ] `pnpm api:generate`.
- [ ] Web red-green: detail page layout, change-type dialog, duplicate dialog.
- [ ] `.docs` (api/report-routing, frontend/estate-reports, report-routing) and
  full checks.
