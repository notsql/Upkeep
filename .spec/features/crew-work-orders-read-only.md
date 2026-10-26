# Crew read-only work-order access

**Status:** built and verified (2026-10-26; agreed before implementation)
**Owner:** project team

## Problem

Work-order creation was extended to Crew by the inspection feature. The user
now requires Crew to have read-only access to work orders. The API and every
creation entry point must enforce that policy consistently.

This supersedes the Crew work-order creation policy in
[create-inspection-results.md](create-inspection-results.md) and the work-order
creation portion of decision 0037; see decision 0040.

## Behaviour

- Current estate-local Crew can list, search and view work orders and their
  existing progress/completion information.
- Crew cannot create work orders from any source, including manual entry,
  resident reports and failed inspections. Direct API requests return 403.
- Crew cannot update progress, complete work, correct completion records, or
  link/change/remove document associations. These writes remain Owner/Manager
  operations under their existing document and lifecycle checks.
- Access context returns `canViewWorkOrders: true`,
  `canCreateWorkOrders: false` and `canUpdateWorkOrders: false` for Crew.
- Work-order lists, report details, inspection history and inspection details
  show no work-order creation action for Crew. Direct visits to the new-order
  route cannot display an editable creation form or submit a work order.
- A failed inspection saved by Crew remains saved and returns to inspection
  history without opening work-order creation. An Owner/Manager can later
  convert that inspection through the existing form.
- Owner/Manager work-order creation and updates remain available under the
  existing rules. Crew inspection recording and other non-work-order
  permissions remain unchanged.
- Permitted Crew retain attachment and association-history reads, subject to
  `VIEW_DOCUMENTS`. Independent document upload/delete permissions do not grant
  work-order or document-association write authority.

## Data

No Prisma model, migration or generated jOOQ change is required. Existing
WorkOrder and inspection records, references, sources and audit history remain.

## API

No new endpoints or DTO fields. Existing generated types remain authoritative;
regenerate the contract if any controller annotation or signature changes.

| Method | Path | Request | Response | Auth |
| --- | --- | --- | --- | --- |
| GET | `/access/context` | Existing | Existing access DTO; Crew creation/update flags false | Existing authenticated identity |
| GET | `/estates/{estateId}/work-orders` | Existing filters/cursor | Existing work-order page | Current Owner/Manager/Crew |
| GET | `/estates/{estateId}/work-orders/{workOrderId}` | UUID path IDs | Existing detail | Current Owner/Manager/Crew |
| POST | `/estates/{estateId}/work-orders` | Existing CreateWorkOrderRequest | 201 existing detail; 403 for Crew | Active-estate Owner/Manager |
| GET | `/estates/{estateId}/work-order-assets` | Existing picker query | Existing picker page; 403 for Crew | Existing work-order creation authority, now Owner/Manager |
| PATCH | `/estates/{estateId}/work-orders/{workOrderId}/status` | Existing status/version request | Existing detail; 403 for Crew | Existing Owner/Manager authority |
| PUT/PATCH | `/estates/{estateId}/work-orders/{workOrderId}/completion` | Existing completion/correction DTO | Existing detail; 403 for Crew | Existing Owner/Manager authority |
| PUT | `/estates/{estateId}/documents/{documentId}/work-order` | Existing association request | Existing association DTO; 403 for Crew | Active Owner/Manager plus EDIT_DOCUMENTS |

## Edge cases

- Role checks use the requested estate. Crew in one estate can remain a Manager
  in another; the global role must not decide estate-local access.
- Manager-to-Crew demotion revokes creation/update authority immediately,
  including a form already open before the demotion; the server denies its save.
- Resident override, membership revocation and inaccessible-estate 404 behaviour
  remain enforced. Inactive estates retain permitted historical reads.
- Forged source IDs and direct creation URLs cannot bypass server permissions.
- Existing work orders created by Crew remain readable; changing the policy
  does not alter their creator or source inspection.

## Validation and documentation

- Start with failing API regressions for denied Crew creation from manual,
  report and inspection sources, the access flags and the creation asset picker.
- Update tests that explicitly asserted the former Crew creation policy as a
  requirement change, retaining coverage of Owner/Manager creation and Crew reads.
- Verify web creation controls, direct URLs and failed-inspection navigation
  using the returned capability flags; change screen code only where needed.
- Run work-order, document-association and inspection regressions, followed by
  `pnpm test`, `pnpm check-types` and `pnpm fix`.
- Update matching API/frontend docs and the inspection feature spec. Record a
  new decision superseding only the Crew creation portion of decision 0037.

## Out of scope

- Changes to Crew inspection recording, report relocation, document storage,
  role administration, database shape or historical records.

## Verification (2026-10-26)

- Before changing server behavior, the focused run executed 78 tests with 12
  expected failures: Crew creation returned 201 instead of 403, its picker
  returned 200 instead of 403, creation capability remained true, and a queued
  request still succeeded after Manager-to-Crew demotion.
- Before changing inspection navigation, the confirmed web run executed 52
  tests with one failure: a Crew-recorded Fail opened saved detail instead of
  the asset inspection-history table. Existing direct-URL guards already denied
  creation when the capability was false.
- After implementation, 91 focused server tests and 79 focused web tests passed.
  Existing tests asserting the previous Crew creation policy were revised to
  the new agreed requirements, retaining Owner/Manager and Crew-read coverage.
- Full `MAVEN_ARGS=-o NX_DAEMON=false pnpm test --skip-nx-cache --output-style=static`
  passed: 1,354 backend tests and 754 web tests (91 web files), no failures or
  skipped tests. `pnpm check-types`, `pnpm fix` and whitespace checks passed.
- No controller signature, DTO or database shape changed; the existing generated
  contract describes the same endpoints and capability fields.
