# Restore existing management endpoints through Spring security

**Status:** built and verified on 2026-10-17
**Owner:** unassigned

## Problem

The 2026-10-17 verification passed `pnpm fix` and `pnpm check-types`, but
`pnpm test` executed 370 Java tests with 72 failures and no errors. All failures
received HTTP 403 instead of their existing expected responses.

| Test class | Failures |
| --- | ---: |
| `AnomalyCheckControllerTests` | 35 |
| `AssetEventIntegrationTests` | 21 |
| `FailureRiskIntegrationTests` | 10 |
| `CatalogueIntegrationTests` | 5 |
| `AssetCategoryIntegrationTests` | 1 |

`SecurityConfig` explicitly permits known method/path combinations before
`.anyRequest().denyAll()`. Eight existing operations are missing. A sampled
anomaly failure reports `Handler: Type = null` and HTTP 403 with bearer
`insufficient_scope`, consistent with rejection before controller dispatch.
The existing controllers and API documentation confirm that these operations
should be available to authenticated callers, subject to their estate checks.

## Behaviour

- Each operation in the API table passes the security filter for an
  authenticated caller and reaches its existing controller/service checks.
- With JWT authentication configured, missing or invalid authentication returns
  401 for these operations.
- Shared catalogue reads remain available to any authenticated user, including
  unassigned users and residents; they expose no estate data.
- Asset events, anomaly checks and failure-risk reads remain owner-only.
  MEMBER/COUNCIL membership alone does not grant access; foreign or unknown
  estates/assets retain the existing 404 behaviour.
- A target-estate RESIDENT membership prevents management access even when
  the same account is also recorded as that estate's owner.
- Residency in estate A does not prevent an owner from using these operations
  in estate B. WorkOS role claims do not replace database estate permissions.
- Existing validation, inactive-resource, ML-failure and response-body
  expectations remain intact, including 400, 409 and 503 responses.
- Unsupported methods and unknown actions remain denied for authenticated
  callers, including platform admins.

## Data

No schema or migration changes. Existing `Estate` and `EstateUser` rows remain
the authority for estate access. No dependency changes or installations.

## API

Restore these existing operations to the method-specific authenticated matchers
in `apps/server/src/main/java/com/proj/server/config/SecurityConfig.java`:

| Method | Path | Request | Success response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/asset-categories` | None | 200 `AssetCategoryResponse[]` | Any authenticated user |
| GET | `/manufacturers` | Optional `query` | 200 `ManufacturerResponse[]` | Any authenticated user |
| GET | `/manufacturers/{manufacturerId}/models` | Manufacturer UUID, required `category`, optional `query` | 200 `AssetModelResponse[]` | Any authenticated user |
| GET | `/estates/{estateId}/assets/{assetId}/events` | Estate/asset UUIDs | 200 `AssetEventResponse[]` | Authenticated estate owner |
| POST | `/estates/{estateId}/assets/{assetId}/events` | `CreateAssetEventRequest` | 201 `AssetEventResponse` | Authenticated estate owner |
| GET | `/estates/{estateId}/assets/{assetId}/failure-risk` | Estate/asset UUIDs | 200 `FailureRiskResponse` | Authenticated estate owner |
| GET | `/estates/{estateId}/failure-risk` | Estate UUID | 200 `FailureRiskResponse[]` | Authenticated estate owner |
| POST | `/estates/{estateId}/assets/{assetId}/readings/anomaly-check` | `AnomalyCheckRequest` | 200 `AnomalyCheckResponse` | Authenticated estate owner |

`packages/api/openapi.json` remains the DTO source of truth. This fix adds no
endpoint or DTO and changes no existing business response contract.

## Implementation plan

1. **Reproduce against current compiled sources.** Run the five affected test
   classes through the server Nx test target with Maven offline and caching
   disabled. Confirm the 403 rejection before implementation. If compiled
   classes disagree with source, follow `.spec/testing.md`'s clean/reset
   procedure before interpreting the results. Do not count cached compilation
   or a run saying "No tests to run" as evidence.
2. **Add focused regression tests first.** Extend `SecurityConfigTests` with
   parameterized cases for all eight method/path combinations: authenticated
   callers reach a test handler and anonymous callers receive 401. Add cases
   proving unsupported methods/unknown nested paths still return 403. Run and
   observe the missing-route tests fail. Keep existing assertions unchanged.
3. **Restore the missing matchers.** Add the six GET and two POST paths to the
   existing authenticated matcher groups. Preserve public paths, CORS,
   platform-admin rules and the final deny-by-default rule. Leave business
   authorization in the existing services and `EstateRepository.findOwned`.
4. **Verify estate boundaries through real endpoints.** Extend
   `EstateRoleAuthorizationIntegrationTests` for the restored estate routes:
   resident/owner conflicts, resident-in-A plus owner-in-B, MEMBER/COUNCIL
   without ownership, and mismatched estate/asset IDs. Check that denied
   mutations create no events or assessments and do not invoke inference.
   Run new coverage before any additional production correction; only make a
   further change if a regression demonstrates it is needed.
5. **Update documentation.** Update `.docs/api/access.md` to identify the
   restored operations and catalogue exception. Reconcile the affected
   `catalogue.md`, `asset-events.md`, `failure-risk.md` and `anomaly-check.md`
   auth descriptions if incomplete. No frontend changes are expected. If a
   controller annotation must change, regenerate the API contract using
   `pnpm api:generate` and include its generated changes.
6. **Verify completion.** Run the focused security and affected integration
   tests, then `pnpm fix && pnpm check-types && pnpm test`. Force actual full
   test execution once using the cache-bypass workflow documented in
   `.spec/testing.md` (`MAVEN_ARGS=-o UV_NO_SYNC=1 pnpm test --skip-nx-cache`).
   Confirm fresh Surefire reports contain zero failures/errors, no skipped
   affected tests, and all original 370 Java cases plus the new cases execute.
   Web and ML must also pass. Docker must be available for Testcontainers.

## Edge cases

- Use the exact HTTP method for each matcher; adding GET must not admit POST,
  PUT, PATCH or DELETE for the same path.
- Do not add a broad `/estates/**` or catalogue-prefix allow rule.
- Catalogue queries must still reach validation for unknown manufacturer or
  category values rather than being rejected at the security boundary.
- Unknown estate and asset UUIDs must reach existing 404 handling for an
  otherwise authenticated caller.
- Inactive estates and deactivated assets retain each operation's existing
  read/write policy.
- Preserve the issuer-unconfigured local development mode; the regression is
  in the JWT-enabled branch.
- Preserve all existing staged, unstaged and untracked work in this workspace.

## Out of scope

- Broadening management rights for MEMBER/COUNCIL accounts.
- Changing resident reporting, platform-admin permissions or account onboarding.
- Changes to inference, event recording, catalogue normalization or forecasts.
- Database changes, dependency upgrades, UI changes or unrelated refactoring.

## Acceptance

All 72 existing failures pass with their original assertions. New tests protect
the eight restored operations and authorization boundaries. Full tests, type
checks and formatting pass with current source and actual test execution.

## Verification on 2026-10-17

- The starting workspace had changed the catch-all to `authenticated()`.
  The first regression run caught 10 failures for unlisted actions/methods.
- Restoring `denyAll()` reproduced 23 focused failures: eight missing-route
  cases and 15 estate-boundary cases blocked before their services.
- Adding the eight explicit entries passed all 73 focused cases without
  changing existing assertions or estate business logic.
- `pnpm fix` and `pnpm check-types` passed. The full
  `MAVEN_ARGS=-o UV_NO_SYNC=1 pnpm test --skip-nx-cache` run passed server, web,
  ML and the Maven aggregator. Fresh Surefire reports show 418 Java cases,
  zero failures, zero errors and zero skips, including the original 370 cases
  and 48 added regression cases.
- No controller, DTO, dependency or schema changes were needed.
