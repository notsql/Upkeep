import { ItemGroup, ItemSeparator } from "@proj/ui/components/item";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { FileText } from "lucide-react";
import { Fragment, useCallback, useState } from "react";
import { PageSection } from "@/components/page/section-card";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { LoadMore } from "@/components/table/load-more";
import { Pagination } from "@/components/table/pagination";
import {
  useAssetDocumentFeed,
  useAssetDocuments,
  useDocumentAsset,
} from "@/lib/asset-documents";
import { type EstateDocument, useDownloadDocument } from "@/lib/documents";
import { asPagedList } from "@/lib/infinite-list";
import { useMobile } from "@/lib/use-mobile";
import { AssetDocumentItem } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-documents-section/asset-document-item";
import { DocumentAssetDialog } from "@/routes/_auth/estates/$estateId/documents/-components/document-asset-dialog/document-asset-dialog";
import { DocumentRow } from "@/routes/_auth/estates/$estateId/documents/-components/document-row";

export function AssetDocumentsContent({
  estateId,
  assetId,
  canWrite,
}: {
  estateId: string;
  assetId: string;
  canWrite: boolean;
}) {
  const mobile = useMobile();
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors.at(-1);
  const [selected, setSelected] = useState<EstateDocument>();
  const paged = useAssetDocuments(estateId, assetId, cursor, !mobile);
  const feed = asPagedList(useAssetDocumentFeed(estateId, assetId, mobile));
  const documents = mobile ? feed : paged;
  const association = useDocumentAsset(estateId, selected?.id ?? "");
  const download = useDownloadDocument(estateId);
  const close = useCallback(() => setSelected(undefined), []);
  const downloadDocument = useCallback(
    (document: EstateDocument) => download.mutate(document),
    [download.mutate]
  );
  const retry = useCallback(() => documents.refetch(), [documents.refetch]);
  const nextCursor = documents.data?.nextCursor;
  const next = useCallback(() => {
    if (nextCursor) {
      setCursors((current) => [...current, nextCursor]);
    }
  }, [nextCursor]);
  const previous = useCallback(
    () =>
      setCursors((current) =>
        current.length > 1 ? current.slice(0, -1) : current
      ),
    []
  );
  const retryAssociation = useCallback(
    () => association.refetch(),
    [association.refetch]
  );
  return (
    <PageSection icon={FileText} title="Documents">
      <div className="min-w-0 space-y-4">
        {documents.isPending ? (
          <LoadingState label="Loading documents…" rows={2} />
        ) : null}
        {documents.isError ? (
          <ErrorState
            message={documents.error?.message ?? "Couldn't load documents."}
            onRetry={retry}
            retryLabel="Retry documents"
          />
        ) : null}
        {download.isError ? <p role="alert">{download.error.message}</p> : null}
        {documents.data?.items.length === 0 ? (
          <EmptyState
            description="Linked documents appear here"
            icon={FileText}
            title="No documents yet"
          />
        ) : null}
        {mobile && documents.data?.items.length ? (
          <>
            <ItemGroup aria-label="Documents" className="gap-0">
              {documents.data.items.map((document, index) => (
                <Fragment key={document.id}>
                  {index > 0 ? <ItemSeparator className="my-0" /> : null}
                  <AssetDocumentItem
                    document={document}
                    downloading={download.isPending}
                    onDownload={downloadDocument}
                    onUnlink={canWrite ? setSelected : undefined}
                  />
                </Fragment>
              ))}
            </ItemGroup>
            <LoadMore {...feed.more} />
          </>
        ) : null}
        {!mobile && documents.data?.items.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.data.items.map((document) => (
                <DocumentRow
                  document={document}
                  downloading={download.isPending}
                  key={document.id}
                  onDownload={downloadDocument}
                  onUnlink={canWrite ? setSelected : undefined}
                />
              ))}
            </TableBody>
          </Table>
        ) : null}
        {!mobile && (nextCursor || cursors.length > 1) ? (
          <Pagination
            canNext={Boolean(nextCursor)}
            canPrevious={cursors.length > 1}
            disabled={documents.isFetching}
            label="Document pages"
            onNext={next}
            onPrevious={previous}
          />
        ) : null}
        {selected && association.isPending ? (
          <LoadingState label="Loading document link…" rows={2} />
        ) : null}
        {selected && association.isError ? (
          <ErrorState
            message={association.error.message}
            onRetry={retryAssociation}
            retryLabel="Retry association"
          />
        ) : null}
        {selected && association.data && canWrite ? (
          <DocumentAssetDialog
            document={selected}
            estateId={estateId}
            initialAssociation={association.data}
            initialUnlink
            key={selected.id}
            onClose={close}
          />
        ) : null}
      </div>
    </PageSection>
  );
}
