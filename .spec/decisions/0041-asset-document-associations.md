# 0041 Asset document associations

## Decision

Add a nullable same-estate `Document.assetId` relation with a composite foreign
key and independent `assetAssociationVersion`. Preserve existing upload IDs,
storage, metadata and work-order associations. Record the latest real change's
actor/time atomically; this feature does not introduce a full association-history
UI or require a correction reason.

Reuse ordinary asset ownership authority for linking and unlinking, including
retired assets. Require active estates for writes and document-read permission
for metadata/downloads; do not add a separate document-edit gate to association
mutations. This does not broaden ordinary equipment-editing roles.

Serialize asset-link, work-order-link and deletion writes on the estate lock,
then document. Both association writes reject different non-null document/job
asset IDs. Use reviewed versions to reject stale requests, preserve no-ops and
require unlink/link when changing an asset. Linking touches no storage, equipment,
maintenance/cost or work-order completion state.

## Consequences

Asset Documents and document association views share user/estate-prefixed
document query keys and generated API types. Existing deletion invalidation
removes attachments from both views. Conflicts or ambiguous network outcomes
require refreshing and explicit review; a delayed unlink cannot retarget a newer
association. The additive migration is compatible with the prior application.
