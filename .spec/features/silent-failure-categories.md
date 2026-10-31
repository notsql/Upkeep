# Silent-failure asset categories (ID-83)

**Status:** built
**Owner:** Yan Hein Latt

## Problem

Some equipment fails without anyone noticing. Common-area lighting goes dark
at 3 a.m., and nobody reports it. A Manager has no way to mark those asset
classes, so they can't single them out for spot checks. ID-81 (service
intervals), ID-84 (the monthly inspection list) and ID-86 (overdue
inspections) all build on knowing which classes these are.

"Asset class" in the story is what the app calls an **asset category**
(`AssetCategory`: Lighting, Pump and so on). Categories are a global
catalogue that only migrations change, so the flag is an **estate setting**
on top of that catalogue. That way one estate's choice never changes
another's.

## Behaviour

### Who

- The estate owner and the estate's assigned Managers can read and change the
  flags. This is the same check as ID-44's estate device list
  (`findManaged`).
- A same-estate Resident gets 403. Any other estate, or one the user doesn't
  manage, gets 404.
- Changing a flag in an inactive estate gets 409. Reading still works.

### Flags

- Every estate sees every asset category, each with a `failsSilently` flag.
- Until a flag has been changed in that estate, it takes its default:
  `LIGHTING` is flagged, every other category isn't. The response says
  whether each flag is still the default.
- Setting a flag records who changed it (user ID, plus a WorkOS display-name
  snapshot) and when. Changes are append-only history, and the current flag
  is the latest change.
- Setting a flag to the value it already has is a no-op. It returns the
  current state and records nothing, so the history only shows real changes.
- An unknown category code gets 404.

### Listing

- The list shows each category's label, its flag, whether that flag is the
  default, the number of **active** assets of that category in the estate
  (retired assets aren't counted), and the latest change (who and when), or
  none.
- Flagged categories come first, then the rest, each group ordered by label.

### Screen

- The estate details page gains an **Asset categories** link, shown only to
  users who can manage the estate, next to Devices.
- The page `/estates/$estateId/asset-categories` shows a table: Category,
  Assets, Fails silently (a labelled checkbox), Last changed. Above it, a
  summary reads "N categories flagged as failing silently".
- A category still on its default shows "Default" in Last changed. Otherwise
  it shows the name and date.
- Ticking or unticking saves at once, shows a toast and refreshes the list.
  If saving fails, the checkbox goes back and an error is shown.
- In an inactive estate the checkboxes are disabled and a note explains why.

## Data

Expand-only. This adds one new table:

```prisma
// Append-only history of an estate's silent-failure flag per asset category (ID-83).
// The current flag is the latest row; with no rows, LIGHTING defaults to flagged.
model AssetCategoryFlagChange {
  id               String   @id @default(uuid()) @db.Uuid
  estateId         String   @db.Uuid
  category         String   @db.VarChar(30)
  failsSilently    Boolean
  changedByUserId  String   @db.VarChar(255)
  changedByName    String?  @db.VarChar(255)
  changedAt        DateTime @default(now()) @db.Timestamptz(6)

  estate        Estate        @relation(fields: [estateId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  assetCategory AssetCategory @relation(fields: [category], references: [code], onDelete: Restrict, onUpdate: Restrict)

  @@index([estateId, category, changedAt])
}
```

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/estates/{estateId}/asset-categories` | - | `EstateAssetCategoriesResponse { estateActive: boolean, categories: EstateAssetCategoryResponse[] }` | Owner or assigned Manager |
| PUT | `/estates/{estateId}/asset-categories/{category}/silent-failure` | `SetSilentFailureRequest { failsSilently: boolean }` | `EstateAssetCategoryResponse` | Owner or assigned Manager; active estate |

`EstateAssetCategoryResponse` has these fields:

- `code` and `label` (strings)
- `failsSilently` and `isDefault` (booleans)
- `activeAssetCount` (integer)
- `lastChange`: `{ failsSilently, changedByUserId, changedByName?, changedAt }`,
  or null

Both endpoints are added to the `SecurityConfig` allowlist.

## Edge cases

- Two Managers set the same flag at the same moment. Both changes are
  recorded, the latest `changedAt` (then `id`) wins, and the result is still
  consistent.
- Setting LIGHTING to flagged while it's on its default is a no-op, so it
  stays a default with no history row. Unflagging it and flagging it again
  records two changes, after which it's no longer a default.
- A category with no assets still appears, with a count of 0.
- A category added by a later migration appears unflagged (unless it's
  LIGHTING) with no extra work.
- A request without `failsSilently`, or with it as a string, gets 400.

## Out of scope

- Custom estate roles. No new permission code; only the owner and Managers,
  as with the device list.
- A screen showing a category's full change history. The history is stored;
  only the latest change is shown.
- Spot-check scheduling (ID-84), service intervals (ID-81) and overdue
  inspections (ID-86).
- Changing the global category catalogue.
