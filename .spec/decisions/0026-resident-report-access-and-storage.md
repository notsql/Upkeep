# 0026 Resident report access and storage

## Decision

A WorkOS account has exactly one organization role. The existing role-update flow rejects zero or multiple roles. A `resident` role is allowed only the explicit `/resident` reporting endpoint list plus public infrastructure. The JWT subject identifies the submitter, and a manually provisioned `ResidentAssignment` identifies one active estate for new reports. Estate membership does not imply resident access. Historical reports remain readable by their submitter after assignment changes.

Prisma owns the three new tables and migration. The report location uses a composite foreign key to its estate. Images are decoded, bounded and re-encoded before upload to a private Cloudflare R2 bucket through the S3-compatible SDK. The report row is committed only after all selected objects upload; failed submissions delete staged objects. A bounded scheduled sweep removes unreferenced old objects left by interrupted requests. Object keys never appear in resident responses.

## Consequences

The current feature needs trusted manual assignment seeding. Assignment management, status transitions and staff access require later features. R2 credentials and a private bucket are required for image submission and retrieval. A resident can submit without images when storage is not configured.
