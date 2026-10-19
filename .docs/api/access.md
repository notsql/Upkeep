# Access projection and admin estate grants

The generated `packages/api/openapi.json` is authoritative. JWTs prove identity; Spring reads current estate memberships on every request. Only WorkOS platform administration uses the admin authority. An unassigned account cannot create estates or submit reports. Its own historical reports remain readable.

| Method/path | Request | Response | Status/auth |
| --- | --- | --- | --- |
| `GET /access/context` | None | `AppAccessResponse` | 200; authenticated JWT subject; 401 missing/invalid identity, 503 database lookup unavailable. `Cache-Control: private, no-store`. |
| `GET /api/admin/users/{userId}/estates` | User subject path | `EstateUserResponse[]` for all estates | 200; platform admin only; 401/403 |
| `PUT /api/admin/users/{userId}/estates/{estateId}` | User subject, estate UUID paths; no body | Empty | 204; platform admin; 401/403, 404 unknown estate, 409 resident row requires explicit conversion |
| `DELETE /api/admin/users/{userId}/estates/{estateId}` | Same paths; no body | Empty | 204; platform admin; 401/403, 409 resident row protected |

`AppAccessResponse` fields: `canEnterWorkspace: boolean`, `canCreateEstate: boolean`, `canAccessPlatformAdmin: boolean`, `hasResidentMembership: boolean`, `canSubmitReport: boolean`, `residentEstate: { id: UUID, name: string } | null`, `estates: EstateAccessResponse[]`.

`EstateAccessResponse`: `estateId: UUID`, `role: OWNER | MEMBER | COUNCIL | RESIDENT`, `canViewManagement: boolean`, `canManageEstate: boolean`, `canViewAssets: boolean`, `canInviteMembers: boolean`, `canManageInvitationPermissions: boolean`. OWNER is derived from `Estate.ownerUserId`. MEMBER/COUNCIL retain management reads; assets and mutations remain owner-only. RESIDENT takes precedence over conflicting ownership in the same estate and grants no management capability. Active resident membership enables submission; deactivation disables it. Residency elsewhere does not remove management/platform admin permissions.

`EstateUserResponse`: `estateId: UUID`, `name: string`, `code: string`, `active: boolean`, `owner: boolean`, `granted: boolean`, `membershipRole: MEMBER | COUNCIL | RESIDENT | null`, `canManageGrant: boolean`. `granted` means a management grant. Resident rows are read-only in this API; trusted manual provisioning handles assignment, moves and deletion.

Example access response for an unassigned caller:

```json
{"canEnterWorkspace":false,"canCreateEstate":false,"canAccessPlatformAdmin":false,"hasResidentMembership":false,"canSubmitReport":false,"residentEstate":null,"estates":[]}
```

Estate-specific management reads reject resident rows with 403 and unrelated estates with 404. Queries filter unknown membership roles out of management grants. Unknown business routes/actions are denied at Spring's security boundary. Report reads remain submitter-only, regardless of estate ownership or platform administration.

Spring Security explicitly admits the following existing operations for authenticated callers; the estate services still enforce owner-only access through `EstateRepository.findOwned`:

| Method | Path | Access |
| --- | --- | --- |
| GET | `/asset-categories` | Any authenticated user |
| GET | `/manufacturers` | Any authenticated user |
| GET | `/manufacturers/{manufacturerId}/models` | Any authenticated user |
| GET / POST | `/estates/{estateId}/assets/{assetId}/events` | Estate owner |
| GET | `/estates/{estateId}/assets/{assetId}/failure-risk` | Estate owner |
| GET | `/estates/{estateId}/failure-risk` | Estate owner |
| POST | `/estates/{estateId}/assets/{assetId}/readings/anomaly-check` | Estate owner |
| POST | `/estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential` | Estate owner; issue or replace a device key |

Catalogue lookups contain no estate data, so resident and unassigned accounts may read them. Estate operations reject a same-estate resident membership even when ownership conflicts, while residency elsewhere does not block legitimate ownership. MEMBER/COUNCIL membership and platform-admin authority alone do not grant access to these owner-only operations. The matchers are method-specific; unsupported methods and unknown nested actions remain denied by the final `denyAll()` rule. Missing or invalid authentication returns 401 when JWT authentication is configured.
