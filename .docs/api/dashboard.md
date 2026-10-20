# Portfolio dashboard API

Source of truth: `packages/api/openapi.json`. No database migration is required.

## Endpoint and access

`GET /dashboard/summary` takes no path/query parameters or request body.
It requires a signed-in JWT with a nonblank subject and returns 200
`DashboardSummaryResponse`. Accessible estates are owned estates or estates
with a current `EstateUser` membership. Ownership plus membership does not
count an estate twice. Invitations alone do not grant access.

Estate totals include active and inactive accessible estates. Asset and
condition totals include only active assets in active estates **owned** by
this subject, matching the existing asset register's owner-only permission.
Shared membership, invitation delegation and global admin status do not expand
that asset scope. This endpoint grants no new read or write capabilities.

Council members are distinct EstateUser user IDs across active owned estates.
Pending invitations, caller memberships, inactive estates and shared-only access
do not contribute. Multiple memberships for one person count once; no WorkOS
identity lookup is required. It counts current membership grants, matching the
Council members page, including existing administrative access grants; it does
not count invitation history. The count shares the asset totals' SQL snapshot.

## Response DTOs

All fields below are required and counts are nonnegative integers.

`DashboardSummaryResponse`:

| Field | Type | Meaning |
| --- | --- | --- |
| accessibleEstateCount | int32 | All accessible estates |
| activeEstateCount | int32 | Active accessible estates |
| inactiveEstateCount | int32 | Inactive accessible estates |
| activeOwnedEstateCount | int32 | Active estates owned by caller; asset-summary scope |
| councilMemberCount | int64 | Unique accepted members in active owned estates, excluding caller |
| totalActiveAssets | int64 | Active assets within that scope |
| conditionCounts | DashboardConditionCounts | Latest condition totals |
| affectedEstateCount | int32 | All scoped estates with Needs attention or Faulty assets |
| estatesNeedingAttention | DashboardEstateSummary[] | First five affected estates in ranked order |

`DashboardConditionCounts`: `good`, `needsAttention`, `faulty`, `unassessed`
(all int64). They sum to `totalActiveAssets`. Attention needed combines
`needsAttention + faulty`; missing assessments are counted as unassessed.

`DashboardEstateSummary`: `estateId: UUID`, `estateName: string`,
`estateCode: string`, `totalActiveAssets: int64`, `needsAttentionCount: int64`,
`faultyCount: int64`.

Each asset contributes once, using the assessment with greatest `assessedOn`,
then greatest `createdAt`, then smallest assessment UUID (the register's rule).
`DashboardRepository` builds its CTE, access filters, lateral latest-assessment
join and aggregates with generated jOOQ tables and typed fields. Result mapping
uses those fields directly, and aggregate counts use SQL `BIGINT` for Java `long`.
All totals use one SQL statement and one Postgres snapshot. Estates rank by
combined attention count descending, then faulty count descending, then estate
code and UUID ascending. Limiting rows to five does not limit overall counts.
Healthy or solely unassessed estates do not fill the attention list.

## Errors and example

401: missing/invalid authentication or blank JWT subject. Controller errors use
`EstateError { message: string }`; security-filter errors may omit a JSON body.
503: database access failure, with a safe EstateError message:
`Dashboard summary is temporarily unavailable. Please try again.`
No raw SQL or database details are returned by this controller's advice.

Example authenticated response for one active owned estate containing three
active assets (one Good, one Faulty, one without assessments):

```json
{
  "accessibleEstateCount": 1,
  "activeEstateCount": 1,
  "inactiveEstateCount": 0,
  "activeOwnedEstateCount": 1,
  "councilMemberCount": 2,
  "totalActiveAssets": 3,
  "conditionCounts": { "good": 1, "needsAttention": 0, "faulty": 1, "unassessed": 1 },
  "affectedEstateCount": 1,
  "estatesNeedingAttention": [{
    "estateId": "fa1ec2a3-d887-43a9-a073-6b8daa127da3",
    "estateName": "Maple Grove",
    "estateCode": "MG-001",
    "totalActiveAssets": 3,
    "needsAttentionCount": 0,
    "faultyCount": 1
  }]
}
```

Estate access excludes RESIDENT memberships and same-estate resident/owner conflicts. Only ownership or current MEMBER/COUNCIL memberships contribute estate counts. Council-member counts omit resident rows. A mixed account sees only the estates where it holds management access.
