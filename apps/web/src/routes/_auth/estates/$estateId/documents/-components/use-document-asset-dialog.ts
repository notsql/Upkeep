import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AssetDocumentError,
  type DocumentAsset,
  useAssetDocumentAccess,
  useChangeDocumentAsset,
  useDocumentAsset,
} from "@/lib/asset-documents";
import type { Asset } from "@/lib/assets";
import type { EstateDocument } from "@/lib/documents";

interface AssetLinkDraft {
  association: DocumentAsset;
  removing: boolean;
  selected?: Asset;
  version: number;
}

export function useDocumentAssetDialog({
  estateId,
  document,
  initialUnlink,
  initialAssociation,
  onClose,
}: {
  estateId: string;
  document: EstateDocument;
  initialUnlink: boolean;
  initialAssociation?: DocumentAsset;
  onClose: () => void;
}) {
  const access = useAssetDocumentAccess(estateId);
  const association = useDocumentAsset(estateId, document.id);
  const mutation = useChangeDocumentAsset(estateId, document.id);
  const [draft, setDraft] = useState<AssetLinkDraft | undefined>(() => {
    const current = initialAssociation ?? association.data;
    return initialUnlink && current?.assetId
      ? {
          version: current.associationVersion,
          removing: true,
          association: current,
        }
      : undefined;
  });
  const [blocked, setBlocked] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();
  const inFlight = useRef(false);
  const latest = association.data;
  const select = useCallback(
    (asset?: Asset) => {
      if (!latest) {
        return;
      }
      setDraft((previous) => ({
        version: previous?.version ?? latest.associationVersion,
        association: previous?.association ?? latest,
        removing: false,
        selected: asset,
      }));
    },
    [latest]
  );
  const unlink = useCallback(() => {
    if (!latest) {
      return;
    }
    mutation.reset();
    setDraft({
      version: latest.associationVersion,
      removing: true,
      association: latest,
    });
  }, [latest, mutation.reset]);
  const save = useCallback(() => {
    if (
      !(draft && access.canWrite) ||
      blocked ||
      inFlight.current ||
      !(draft.removing || draft.selected)
    ) {
      return;
    }
    inFlight.current = true;
    mutation.mutate(
      {
        assetId: draft.removing ? null : (draft.selected?.id ?? null),
        expectedAssociationVersion: draft.version,
      },
      {
        onSuccess: () => {
          toast.success(
            draft.removing
              ? "Document unlinked. The file is retained."
              : "Document linked to asset."
          );
          onClose();
        },
        onError: (error) => {
          setBlocked(
            !(error instanceof AssetDocumentError) || error.status !== 400
          );
          setReviewing(false);
        },
        onSettled: () => {
          inFlight.current = false;
        },
      }
    );
  }, [draft, access.canWrite, blocked, mutation.mutate, onClose]);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(undefined);
    try {
      await association.refetch({ throwOnError: true });
      setReviewing(true);
    } catch {
      setRefreshError("Unable to refresh the asset link. Retry before saving.");
    } finally {
      setRefreshing(false);
    }
  }, [association.refetch]);
  const review = useCallback(() => {
    if (!latest) {
      return;
    }
    setDraft((previous) => {
      if (!previous || previous.association.assetId !== latest.assetId) {
        return;
      }
      return {
        ...previous,
        version: latest.associationVersion,
        association: latest,
      };
    });
    mutation.reset();
    setBlocked(false);
    setReviewing(false);
  }, [latest, mutation.reset]);
  const close = useCallback(
    (open: boolean) => {
      if (!(open || mutation.isPending)) {
        onClose();
      }
    },
    [mutation.isPending, onClose]
  );
  const retry = useCallback(() => association.refetch(), [association.refetch]);
  const removing = draft?.removing === true;
  const denied =
    mutation.error instanceof AssetDocumentError &&
    [401, 403, 404].includes(mutation.error.status);
  return {
    access,
    association,
    mutation,
    draft,
    blocked,
    reviewing,
    refreshing,
    refreshError,
    latest,
    removing,
    denied,
    select,
    unlink,
    save,
    refresh,
    review,
    close,
    retry,
    saveDisabled:
      blocked ||
      refreshing ||
      association.isError ||
      mutation.isPending ||
      !latest ||
      !(draft?.removing || draft?.selected),
  };
}

export type DocumentAssetDialogState = ReturnType<
  typeof useDocumentAssetDialog
>;
