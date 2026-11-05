import { Files } from "lucide-react";
import { useCallback } from "react";
import { ListPageHeader } from "@/components/page/list-page-header";
import { PageLayout } from "@/components/page/page-layout";
import { LoadingState } from "@/components/states/loading-state";
import type { DocumentFilters, EstateDocument } from "@/lib/documents";
import { DocumentAssets } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/document-assets";
import { DocumentFiltersForm } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/document-filters";
import { DocumentsDialogs } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/documents-dialogs";
import { DocumentsResults } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/documents-results";
import { UploadDocumentForm } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/upload-document-form";
import { useDocumentsPage } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/use-documents-page";

export function DocumentsPage({
  estateId,
  filters,
  onSearch,
}: {
  estateId: string;
  filters: DocumentFilters;
  onSearch: (filters: DocumentFilters) => void;
}) {
  const page = useDocumentsPage(estateId, filters, onSearch);
  const { access, assets, selectAssetDocument } = page;
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
        create={canUpload ? { onClick: page.openUpload } : undefined}
        filters={{ activeCount: page.activeCount, ...page.panel.toggleProps }}
        icon={Files}
        title="Documents"
      />
      {canUpload ? (
        <UploadDocumentForm
          estateId={estateId}
          onClose={page.closeUpload}
          onUploaded={page.setNotice}
          open={page.uploading}
        />
      ) : null}
      <DocumentFiltersForm
        filters={filters}
        key={filters.filename ?? ""}
        onSearch={onSearch}
        {...page.panel.barProps}
      />
      <DocumentsResults
        documents={page.documents}
        download={page.download}
        filters={filters}
        notice={page.notice}
        onAssociation={
          page.associations.canRead ? page.setAssociationDocument : undefined
        }
        onClearFilters={page.clearFilters}
        onDelete={page.chooseDeletion}
        onDownload={page.downloadDocument}
        onFirst={page.first}
        onNext={page.next}
        onRetry={page.retry}
        renderAssets={renderAssets}
      />
      <DocumentsDialogs
        assetSelection={page.assetSelection}
        associationDocument={page.associationDocument}
        deletion={page.deletion}
        estateId={estateId}
        onCloseAsset={page.closeAsset}
        onCloseAssociation={page.closeAssociation}
        onCloseDeletion={page.close}
        onRemove={page.remove}
        selected={page.selected}
        userId={assets.userId}
      />
    </PageLayout>
  );
}
