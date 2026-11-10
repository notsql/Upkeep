import type { components } from "@proj/api/schema";
import type { ReactNode } from "react";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { LoadMore } from "@/components/table/load-more";
import { Pagination } from "@/components/table/pagination";
import type {
  DocumentFilters,
  EstateDocument,
  useDownloadDocument,
} from "@/lib/documents";
import type { PagedList } from "@/lib/infinite-list";
import { DocumentList } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/document-list";

export function DocumentsResults({
  documents,
  download,
  filters,
  notice,
  onAssociation,
  onClearFilters,
  onDelete,
  onDownload,
  onFirst,
  onNext,
  onRetry,
  renderAssets,
}: {
  documents: PagedList<components["schemas"]["DocumentPageResponse"]>;
  download: ReturnType<typeof useDownloadDocument>;
  filters: DocumentFilters;
  notice: string | undefined;
  onAssociation: ((document: EstateDocument) => void) | undefined;
  onClearFilters: () => void;
  onDelete: (document: EstateDocument) => void;
  onDownload: (document: EstateDocument) => void;
  onFirst: () => void;
  onNext: () => void;
  onRetry: () => void;
  renderAssets: (document: EstateDocument) => ReactNode;
}) {
  return (
    <>
      {notice ? <p role="status">{notice}</p> : null}
      {documents.isPending ? (
        <LoadingState label="Loading documents…" variant="table" />
      ) : null}
      {documents.isError ? (
        <ErrorState
          message={documents.error?.message ?? "Couldn't load documents."}
          onRetry={onRetry}
        />
      ) : null}
      {download.isError ? <p role="alert">{download.error.message}</p> : null}
      <DocumentList
        documentType={filters.documentType}
        downloading={download.isPending}
        failed={documents.isError}
        filename={filters.filename}
        items={documents.data?.items}
        onAssociation={onAssociation}
        onClearFilters={onClearFilters}
        onDelete={onDelete}
        onDownload={onDownload}
        renderAssets={renderAssets}
      />
      {documents.data && !documents.isError && documents.more ? (
        <LoadMore {...documents.more} />
      ) : null}
      {documents.data && !documents.isError && !documents.more ? (
        <Pagination
          canNext={!!documents.data.nextCursor}
          canPrevious={!!filters.cursor}
          label="Document pages"
          onNext={onNext}
          onPrevious={onFirst}
        />
      ) : null}
    </>
  );
}
