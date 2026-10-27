import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import {
  type DocumentAsset,
  useAssetDocumentAccess,
} from "@/lib/asset-documents";
import {
  type DocumentFilters,
  type EstateDocument,
  useDeleteDocument,
  useDocumentAccess,
  useDocuments,
  useDownloadDocument,
} from "@/lib/documents";
import { useWorkOrderDocumentAccess } from "@/lib/work-order-documents";
import { DocumentAssetDialog } from "./document-asset-dialog";
import { DocumentAssets } from "./document-assets";
import { DocumentFiltersForm } from "./document-filters";
import { DocumentRow } from "./document-row";
import { DocumentWorkOrderDialog } from "./document-work-order-dialog";
import { UploadDocumentForm } from "./upload-document-form";

interface AssetDocumentSelection {
  association: DocumentAsset;
  document: EstateDocument;
}

export function DocumentsPage({
  estateId,
  filters,
  onSearch,
}: {
  estateId: string;
  filters: DocumentFilters;
  onSearch: (filters: DocumentFilters) => void;
}) {
  const access = useDocumentAccess(estateId);
  const associations = useWorkOrderDocumentAccess(estateId);
  const assets = useAssetDocumentAccess(estateId);
  const [assetSelection, setAssetSelection] =
    useState<AssetDocumentSelection>();
  const closeAsset = useCallback(() => setAssetSelection(undefined), []);
  const selectAssetDocument = useCallback(
    (document: EstateDocument, association: DocumentAsset) =>
      setAssetSelection({ document, association }),
    []
  );
  const [associationDocument, setAssociationDocument] =
    useState<EstateDocument>();
  const documents = useDocuments(estateId, filters);
  const deletion = useDeleteDocument(estateId);
  const download = useDownloadDocument(estateId);
  const [selected, setSelected] = useState<EstateDocument>();
  const [removed, setRemoved] = useState<string>();
  const chooseDeletion = useCallback(
    (document: EstateDocument) => {
      deletion.reset();
      setSelected(document);
    },
    [deletion.reset]
  );
  const downloadDocument = useCallback(
    (document: EstateDocument) => download.mutate(document),
    [download.mutate]
  );
  const retry = useCallback(() => documents.refetch(), [documents.refetch]);
  const first = useCallback(
    () =>
      onSearch({
        filename: filters.filename,
        documentType: filters.documentType,
      }),
    [filters.filename, filters.documentType, onSearch]
  );
  const next = useCallback(
    () =>
      onSearch({ ...filters, cursor: documents.data?.nextCursor ?? undefined }),
    [filters, documents.data?.nextCursor, onSearch]
  );
  const close = useCallback(() => setSelected(undefined), []);
  const closeAssociation = useCallback(
    () => setAssociationDocument(undefined),
    []
  );
  const changeDialog = useCallback(
    (open: boolean) => {
      if (!(open || deletion.isPending)) {
        setSelected(undefined);
      }
    },
    [deletion.isPending]
  );
  const remove = useCallback(() => {
    if (!selected || deletion.isPending) {
      return;
    }
    deletion.mutate(selected.id, {
      onSuccess: () => {
        const message = `"${selected.originalFilename}" removed`;
        setRemoved(message);
        toast.success(message);
        setSelected(undefined);
      },
    });
  }, [selected, deletion.isPending, deletion.mutate]);
  if (access.pending) {
    return <p role="status">Loading access…</p>;
  }
  if (!access.canView) {
    return <p role="alert">Documents are unavailable.</p>;
  }
  return (
    <main className="page-layout space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          { label: access.permission?.estateName ?? "Estate" },
          { label: "Documents" },
        ]}
        title="Documents"
      />
      {access.permission?.canUploadDocuments ? (
        <UploadDocumentForm estateId={estateId} />
      ) : null}
      <DocumentFiltersForm
        filters={filters}
        key={filters.filename ?? ""}
        onSearch={onSearch}
      />
      {removed ? <p role="status">{removed}</p> : null}
      {documents.isPending ? <p role="status">Loading documents…</p> : null}
      {documents.isError ? (
        <div role="alert">
          {documents.error.message}{" "}
          <Button onClick={retry} variant="outline">
            Retry
          </Button>
        </div>
      ) : null}
      {download.isError ? <p role="alert">{download.error.message}</p> : null}
      {!documents.isError && documents.data?.items.length === 0 ? (
        <DocumentEmptyState filters={filters} />
      ) : null}
      {!documents.isError && documents.data?.items.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Filename</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.data.items.map((document) => (
              <DocumentRow
                assets={
                  assets.canRead ? (
                    <DocumentAssets
                      canWrite={assets.canWrite}
                      document={document}
                      estateId={estateId}
                      key={`${assets.userId}:${estateId}:${document.id}`}
                      onManage={selectAssetDocument}
                    />
                  ) : (
                    <span>—</span>
                  )
                }
                document={document}
                downloading={download.isPending}
                key={document.id}
                onAssociation={
                  associations.canRead ? setAssociationDocument : undefined
                }
                onDelete={chooseDeletion}
                onDownload={downloadDocument}
                showSize={false}
              />
            ))}
          </TableBody>
        </Table>
      ) : null}
      <div className="flex gap-2">
        {filters.cursor ? (
          <Button onClick={first} variant="outline">
            First page
          </Button>
        ) : null}
        {documents.data?.nextCursor ? (
          <Button onClick={next} variant="outline">
            Next
          </Button>
        ) : null}
      </div>
      {associationDocument ? (
        <DocumentWorkOrderDialog
          document={associationDocument}
          estateId={estateId}
          key={`${estateId}:${associationDocument.id}`}
          onClose={closeAssociation}
        />
      ) : null}
      <AssetAssociationSelection
        estateId={estateId}
        onClose={closeAsset}
        selection={assetSelection}
        userId={assets.userId}
      />
      <Dialog onOpenChange={changeDialog} open={!!selected}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file</DialogTitle>
            <DialogDescription>
              {selected?.originalFilename} will be removed from the estate
              documents. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletion.isError ? (
            <p role="alert">{deletion.error.message}</p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={deletion.isPending}
              onClick={close}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={deletion.isPending}
              onClick={remove}
              variant="destructive"
            >
              {deletion.isPending ? "Deleting…" : "Delete file"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function DocumentEmptyState({ filters }: { filters: DocumentFilters }) {
  const filtered = !!(filters.filename || filters.documentType);
  return (
    <p>{filtered ? "No files match your search" : "No documents uploaded"}</p>
  );
}

function AssetAssociationSelection({
  selection,
  estateId,
  userId,
  onClose,
}: {
  selection?: AssetDocumentSelection;
  estateId: string;
  userId?: string;
  onClose: () => void;
}) {
  if (!selection) {
    return null;
  }
  return (
    <DocumentAssetDialog
      document={selection.document}
      estateId={estateId}
      initialAssociation={selection.association}
      initialUnlink={!!selection.association.assetId}
      key={`${userId}:${estateId}:${selection.document.id}`}
      onClose={onClose}
    />
  );
}
