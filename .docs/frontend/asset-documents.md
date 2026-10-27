# Asset document association

The Documents list and asset detail page share the generated
[asset-document API](../api/asset-documents.md). No new route is introduced.

## Routes and components

Under `apps/web/src/routes/_auth/estates/$estateId/`:

- `documents/index.tsx` renders `documents/-components/documents-page.tsx`.
  Each `document-row.tsx` has an Asset column rendered by `document-assets.tsx`.
  An unlinked document offers asset editors an “Associate Asset” button, whose
  accessible name is “Associate Asset for <filename>”. A linked document instead
  shows its asset reference/name as a link to `/estates/$estateId/assets/$assetId`.
  Editors see an “Unlink” button (accessible name “Unlink for <filename>”) that
  opens “Unlink document” confirmation directly. The dialog pins the association
  and version displayed when the button was clicked. Confirming unlinks; Cancel
  leaves the current link untouched. No intermediate management dialog appears.
  Association reads run for visible rows with asset-read authority; loading and
  Retry states never imply an absent link. Successful writes update the column
  through the existing association cache and estate-document invalidation.
- `documents/-components/document-asset-dialog.tsx` uses the title “Associate Asset”
  and displays the current link,
  explicit Save, or Unlink confirmation. Unlink identifies document and asset
  and explains that the file and work-order link are retained. Cancel sends no
  mutation. Moving an existing link requires unlinking first; no reason is needed.
- `documents/-components/document-asset-picker.tsx` shows the complete estate
  register, including selectable retired assets. It reuses `AssetFilterControls`
  from `assets/-components/asset-filters.tsx` for category, location, condition and
  status. Search and filters combine, clearing restores `status=ALL`, and the
  selected UUID/reference/name remain visible across filter changes. A labelled
  checkbox occupies the leftmost column, followed by reference, name, category
  label, location path and lifecycle status. Only one asset is checked at a time;
  unchecking it clears the selection and disables Save. The assessment/condition
  display column is omitted; the condition filter remains available.
- `documents/-components/use-document-asset-dialog.ts` owns the reviewed draft,
  in-flight guard and explicit conflict/network recovery.
- `assets/$assetId/index.tsx` renders `asset-details-page.tsx` and its route-local
  `-components/asset-documents-section.tsx`. The Documents card lists filename,
  type, size, upload date and Download, with Unlink for current asset editors.
  It loads the current association before showing unlink confirmation and pins
  that reviewed version. Attachment pagination uses opaque cursors.

The UI uses shared shadcn `Dialog`, `Alert`, `Button`, `Checkbox`, `Input`, `Field`,
`Select`, `Table`, `Card` and badges. Dialogs constrain height/width and allow table scrolling;
filenames wrap in the confirmation header. Inputs/selects are labelled, picker
selection uses checkboxes, and the modal supplies keyboard/focus behavior.

## Hooks, requests and cache

`apps/web/src/lib/asset-documents.ts` uses only the generated API client/types:

| Hook | Request | Query key / effect |
| --- | --- | --- |
| `useAssetDocumentAccess` | Existing access context and estate detail | Requires current `canViewAssets` plus document-read access for metadata; estate `owned` and activity determine mutations independently of upload permission and asset retirement |
| `useDocumentAsset` | GET `/estates/{estateId}/documents/{documentId}/asset` | `[userId, "documents", estateId, "asset-association", documentId]` |
| `useAssetDocuments` | GET `/estates/{estateId}/assets/{assetId}/documents`, optional cursor | `[userId, "documents", estateId, "asset-attachments", assetId, cursor]` |
| `useChangeDocumentAsset` | PUT `/estates/{estateId}/documents/{documentId}/asset` | Sends explicit nullable asset UUID and reviewed version; seeds the association and invalidates the estate document prefix |

The picker uses existing `useAssets` keys
`["estates", userId, "assets", estateId, "list", filters]`, `useLocations` and
`useAssetCategories`. Downloads reuse `useDownloadDocument` and the authenticated
document content endpoint, including its temporary object URL cleanup.

Successful writes invalidate `[userId, "documents", estateId]`, covering document
searches and former/new asset attachment pages. Deletion already invalidates that
prefix, so deleted uploads leave attachment views. Unrelated condition/cost
queries are not invalidated.

## Permissions, lifecycle and recovery

Document editing/upload rights alone expose no asset picker. Document-edit
permission is not an extra gate on asset association writes. Retired assets still
permit link/unlink; inactive estates show history/downloads without write controls.
Without document-read authority the asset page does not fetch or display private
attachment metadata. Revoked authority suppresses controls/data. Keys and keyed
dialog/list content isolate account, estate, asset and document changes.

Save remains disabled without a selection, during pending requests and after an
uncertain result. Mutation retries are disabled. A 400 retains the draft for
correction; conflicts/network failures require Refresh association and explicit
review before another save. Refresh does not replace the reviewed draft version
until the user confirms review. If the asset changed, review discards the old
intent so a pending unlink cannot silently target the new asset.

Read errors offer Retry without submitting a mutation. Loading, empty register,
no filter matches and no linked documents have separate states. Success announces
linked/unlinked through the existing toast system. Browser tests cover both routes,
including retired assets, pagination, account/estate isolation and conflict recovery.
