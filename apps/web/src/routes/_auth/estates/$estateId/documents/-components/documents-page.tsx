import { Files } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState } from "@/components/error-state";
import { useFilterPanel } from "@/components/filter-bar";
import { ListPageHeader } from "@/components/list-page-header";
import { LoadingState } from "@/components/loading-state";
import { PageLayout } from "@/components/page-layout";
import { Pagination } from "@/components/pagination";
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
import {
  AssetAssociationSelection,
  type AssetDocumentSelection,
} from "./asset-association-selection";
import { DocumentAssets } from "./document-assets";
import { countDocumentFilters, DocumentFiltersForm } from "./document-filters";
import { DocumentList } from "./document-list";
import { DocumentWorkOrderDialog } from "./document-work-order-dialog";
import { UploadDocumentForm } from "./upload-document-form";

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
  const renderAssets = useCallback(
    (document: EstateDocument) =>
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
      ),
    [
      assets.canRead,
      assets.canWrite,
      assets.userId,
      estateId,
      selectAssetDocument,
    ]
  );
  const [associationDocument, setAssociationDocument] =
    useState<EstateDocument>();
  const documents = useDocuments(estateId, filters);
  const deletion = useDeleteDocument(estateId);
  const download = useDownloadDocument(estateId);
  const [selected, setSelected] = useState<EstateDocument>();
  const [notice, setNotice] = useState<string>();
  const [uploading, setUploading] = useState(false);
  const openUpload = useCallback(() => setUploading(true), []);
  const closeUpload = useCallback(() => setUploading(false), []);
  const activeCount = countDocumentFilters(filters);
  const panel = useFilterPanel(activeCount);
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
  const clearFilters = useCallback(() => onSearch({}), [onSearch]);
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
  const remove = useCallback(() => {
    if (!selected || deletion.isPending) {
      return;
    }
    deletion.mutate(selected.id, {
      onSuccess: () => {
        const message = `"${selected.originalFilename}" removed`;
        setNotice(message);
        toast.success(message);
        setSelected(undefined);
      },
    });
  }, [selected, deletion.isPending, deletion.mutate]);
  if (access.pending) {
    return <LoadingState label="Loading access…" rows={2} />;
  }
  if (!access.canView) {
    return <p role="alert">Documents are unavailable.</p>;
  }
  const canUpload = !!access.permission?.canUploadDocuments;
  return (
    <PageLayout className="space-y-6">
      <ListPageHeader
        create={canUpload ? { onClick: openUpload } : undefined}
        filters={{ activeCount, ...panel.toggleProps }}
        icon={Files}
        title="Documents"
      />
      {canUpload ? (
        <UploadDocumentForm
          estateId={estateId}
          onClose={closeUpload}
          onUploaded={setNotice}
          open={uploading}
        />
      ) : null}
      <DocumentFiltersForm
        filters={filters}
        key={filters.filename ?? ""}
        onSearch={onSearch}
        {...panel.barProps}
      />
      {notice ? <p role="status">{notice}</p> : null}
      {documents.isPending ? (
        <LoadingState label="Loading documents…" variant="table" />
      ) : null}
      {documents.isError ? (
        <ErrorState message={documents.error.message} onRetry={retry} />
      ) : null}
      {download.isError ? <p role="alert">{download.error.message}</p> : null}
      <DocumentList
        documentType={filters.documentType}
        downloading={download.isPending}
        failed={documents.isError}
        filename={filters.filename}
        items={documents.data?.items}
        onAssociation={
          associations.canRead ? setAssociationDocument : undefined
        }
        onClearFilters={clearFilters}
        onDelete={chooseDeletion}
        onDownload={downloadDocument}
        renderAssets={renderAssets}
      />
      {documents.data && !documents.isError ? (
        <Pagination
          canNext={!!documents.data.nextCursor}
          canPrevious={!!filters.cursor}
          label="Document pages"
          onNext={next}
          onPrevious={first}
        />
      ) : null}
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
      <ConfirmDialog
        confirmLabel="Delete file"
        description={`${selected?.originalFilename ?? ""} will be removed from the estate documents. This cannot be undone.`}
        error={deletion.isError ? deletion.error.message : undefined}
        onCancel={close}
        onConfirm={remove}
        open={!!selected}
        pending={deletion.isPending}
        pendingLabel="Deleting…"
        title="Delete file"
      />
    </PageLayout>
  );
}
