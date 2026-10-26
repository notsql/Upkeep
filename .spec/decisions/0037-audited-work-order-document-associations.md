# 0037 Audited work-order document associations

## Decision

Extend ID-22's shared Document with a nullable same-estate work-order foreign key
and independent workOrderAssociationVersion. Store initial/change/remove events
in feature-specific append-only DocumentWorkOrderEvent records, with estate-safe
foreign keys, previous/new targets, actor/time and correction reason. Preserve
work-order completion, costs, source and state/version when linking documents.

Read attachments/association history only with the intersection of work-order read
access and VIEW_DOCUMENTS. Link/change/remove additionally require active-estate
Owner/Manager authority and EDIT_DOCUMENTS; document upload/delete rights alone
do not grant work-order association writes. Crew can read permitted attachments;
document-only Council/custom users do not gain work-order access.

Writes lock estate then document, matching ID-22 deletion. Require an explicit
nullable workOrderId key and the reviewed association version. Stale versions
conflict; an unchanged target with the current version does not append an event.
Initial links need no reason; reassignment/removal require one. Relation/version/
audit update transactionally. An ambiguous response is reconciled by reading the
saved link, with explicit review before retrying and no automatic mutation retry.

ID-22's authorized soft deletion remains allowed for linked files. Hide deleted
files from current attachment/content/association reads while retaining internal
row/link/audit. Its physical R2 cleanup remains independent. UI query keys share
ID-22's document prefix so deletion invalidates all attachment representations.

## Consequences

The feature can build on the published ID-22 dependency before its merge. It adds
one migration after ID-22's migration; it neither rewrites that migration nor
creates a competing document/upload system. ID-26 owns its association version,
events and endpoints, so ID-22 needs no generic document-version/history feature.

The association UI lives on the existing Documents list and work-order detail.
Stored uploads can link without OCR/verification. Actual extracted/reviewed data
and the document-asset mismatch check integrate later when ID-23/24/25 provide
those fields; this change does not fabricate them or import invoice costs.
