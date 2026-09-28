# Asset condition

**Status:** built
**Owner:** ID-48

## Problem

An asset's record says what was installed but not how it is performing. A
managing agent cannot record an inspection's outcome, see an asset's current
condition, or look back at how it changed and who assessed it.

## Behaviour

- An estate owner can record a condition assessment on an active asset in an active estate.
- An assessment has a condition, the date it was assessed, and supporting notes. All three are required.
- Conditions are Good, Needs attention and Faulty.
- The assessment date cannot be in the future, but can be in the past, for example when entering an inspection report later.
- The asset's current condition is the assessment with the latest assessment date. Among assessments on the same date, the one recorded last wins.
- An asset with no assessments shows "Not assessed yet".
- Assessments are never edited or deleted. Every one stays in the asset's history, newest first.
- Each assessment records who recorded it (their WorkOS user ID and their name at that moment) and when.
- A deactivated asset keeps its history visible, but rejects new assessments with 409.
- Editing an asset's details never touches its assessments, or any other record that references it.
- An unknown asset, or an estate the caller does not own, returns 404.

## Data

New Prisma model `AssetAssessment`: UUID ID, `estateId`, `assetId`,
`condition`, `assessedOn` (date), `notes`, `recordedByUserId`, nullable
`recordedByName`, and `createdAt`. It has no `updatedAt`, because rows are
never changed. The foreign key to `Asset` carries `estateId`, as `Device`'s
does. An index on `(assetId, assessedOn, createdAt)` serves the history
query. See decision 0017.

## API

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | /estates/{estateId}/assets/{assetId}/assessments | - | AssetAssessmentResponse[] (current first) | Owner |
| POST | /estates/{estateId}/assets/{assetId}/assessments | CreateAssetAssessmentRequest | 201 AssetAssessmentResponse | Owner |

Editing details stays `PATCH /estates/{estateId}/assets/{id}`, unchanged.

## Edge cases

- An assessment back-dated before the current one is added to history but does not become current.
- Two assessments on the same date: the later-recorded one is current.
- The recorder's name is looked up from WorkOS when the assessment is recorded. If WorkOS is unavailable, the assessment is still saved and shows "Unknown user". The user ID is always stored.
- A later name change in WorkOS does not rewrite history, because the name is a snapshot.
- Notes are trimmed, and blank notes are rejected. The limit is 2,000 characters.

## Out of scope

- Maintenance and cost records (ID-49, ID-50). "Without losing" them is satisfied structurally: they will be separate tables, and asset edits update only the asset's own row.
- Editing or deleting an assessment.
- Condition on the asset register or in search (ID-47).
- Letting estate users view assets and assessments. Assets are still owner-only.
