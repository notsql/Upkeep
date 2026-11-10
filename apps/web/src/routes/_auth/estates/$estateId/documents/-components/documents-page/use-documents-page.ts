import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useFilterPanel } from "@/components/filters/filter-bar";
import {
  type DocumentAsset,
  useAssetDocumentAccess,
} from "@/lib/asset-documents";
import {
  type DocumentFilters,
  type EstateDocument,
  useDeleteDocument,
  useDocumentAccess,
  useDocumentFeed,
  useDocuments,
  useDownloadDocument,
} from "@/lib/documents";
import { asPagedList } from "@/lib/infinite-list";
import { useMobile } from "@/lib/use-mobile";
import { useWorkOrderDocumentAccess } from "@/lib/work-order-documents";
import type { AssetDocumentSelection } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/asset-association-selection";
import { countDocumentFilters } from "@/routes/_auth/estates/$estateId/documents/-components/documents-page/document-filters";

export function useDocumentsPage(
  estateId: string,
  filters: DocumentFilters,
  onSearch: (filters: DocumentFilters) => void
) {
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
  const mobile = useMobile();
  const { cursor: _cursor, ...feedFilters } = filters;
  const page = useDocuments(estateId, filters, !mobile);
  const feed = asPagedList(useDocumentFeed(estateId, feedFilters, mobile));
  const documents = mobile ? feed : page;
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
  return {
    access,
    activeCount,
    assets,
    assetSelection,
    associationDocument,
    associations,
    chooseDeletion,
    clearFilters,
    close,
    closeAsset,
    closeAssociation,
    closeUpload,
    deletion,
    documents,
    download,
    downloadDocument,
    first,
    next,
    notice,
    openUpload,
    panel,
    remove,
    retry,
    selectAssetDocument,
    selected,
    setAssociationDocument,
    setNotice,
    uploading,
  };
}
