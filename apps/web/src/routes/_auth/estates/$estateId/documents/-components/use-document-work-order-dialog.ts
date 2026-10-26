import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import type { EstateDocument } from "@/lib/documents";
import {
  DocumentAssociationError,
  useChangeDocumentAssociation,
  useDocumentAssociation,
  useDocumentAssociationHistory,
  useWorkOrderDocumentAccess,
} from "@/lib/work-order-documents";
import type { WorkOrder } from "@/lib/work-orders";
export interface AssociationDraft {
  previousId?: string | null;
  reason: string;
  removing: boolean;
  selected?: WorkOrder;
  version: number;
}
export function useDocumentWorkOrderDialog({
  estateId,
  document,
  onClose,
}: {
  estateId: string;
  document: EstateDocument;
  onClose: () => void;
}) {
  const access = useWorkOrderDocumentAccess(estateId);
  const association = useDocumentAssociation(estateId, document.id);
  const [historyCursor, setHistoryCursor] = useState<string>();
  const history = useDocumentAssociationHistory(
    estateId,
    document.id,
    historyCursor
  );
  const mutation = useChangeDocumentAssociation(estateId, document.id);
  const [draft, setDraft] = useState<AssociationDraft>();
  const [blocked, setBlocked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();
  const inFlight = useRef(false);
  const latest = association.data;
  const denied =
    association.error instanceof DocumentAssociationError &&
    [401, 403, 404].includes(association.error.status);
  const editing = access.canWrite && (!latest?.workOrderId || !!draft);
  const removing = draft?.removing === true;
  const correction = !!draft?.previousId;
  const start = useCallback(
    (removal: boolean) => {
      if (!latest) {
        return;
      }
      mutation.reset();
      setDraft({
        removing: removal,
        version: latest.associationVersion,
        previousId: latest.workOrderId,
        reason: "",
      });
    },
    [latest, mutation.reset]
  );
  const select = useCallback(
    (order: WorkOrder) => {
      if (!latest) {
        return;
      }
      setDraft((previous) =>
        previous
          ? { ...previous, selected: order, removing: false }
          : {
              selected: order,
              removing: false,
              version: latest.associationVersion,
              previousId: latest.workOrderId,
              reason: "",
            }
      );
    },
    [latest]
  );
  const save = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (
        !(draft && access.canWrite) ||
        blocked ||
        inFlight.current ||
        !(removing || draft.selected)
      ) {
        return;
      }
      inFlight.current = true;
      mutation.mutate(
        {
          body: {
            workOrderId: removing ? null : (draft.selected?.id ?? null),
            expectedAssociationVersion: draft.version,
            correctionReason: draft.reason.trim() || undefined,
          },
          previousWorkOrderId: draft.previousId,
        },
        {
          onSuccess: () => {
            setDraft(undefined);
            setBlocked(false);
            setReviewing(false);
            setHistoryCursor(undefined);
          },
          onError: (error) => {
            setBlocked(
              !(error instanceof DocumentAssociationError) ||
                error.status !== 400
            );
            setReviewing(false);
          },
          onSettled: () => {
            inFlight.current = false;
          },
        }
      );
    },
    [draft, access.canWrite, blocked, removing, mutation.mutate]
  );
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(undefined);
    try {
      await Promise.all([
        association.refetch({ throwOnError: true }),
        history.refetch({ throwOnError: true }),
      ]);
      setReviewing(true);
    } catch {
      setRefreshError(
        "Unable to refresh the document link and history. Please retry."
      );
    } finally {
      setRefreshing(false);
    }
  }, [association.refetch, history.refetch]);
  const review = useCallback(() => {
    if (!latest) {
      return;
    }
    setDraft((previous) =>
      previous
        ? {
            ...previous,
            version: latest.associationVersion,
            previousId: latest.workOrderId,
          }
        : previous
    );
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
  const change = useCallback(() => start(false), [start]);
  const remove = useCallback(() => start(true), [start]);
  const cancel = useCallback(() => {
    setDraft(undefined);
    mutation.reset();
    setBlocked(false);
    setReviewing(false);
  }, [mutation.reset]);
  const changeReason = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const { value } = event.target;
      setDraft((previous) =>
        previous ? { ...previous, reason: value } : previous
      );
    },
    []
  );
  const retryAssociation = useCallback(
    () => association.refetch(),
    [association.refetch]
  );
  const retryHistory = useCallback(() => history.refetch(), [history.refetch]);
  const firstHistory = useCallback(() => setHistoryCursor(undefined), []);
  const nextHistory = useCallback(
    () => setHistoryCursor(history.data?.nextCursor ?? undefined),
    [history.data?.nextCursor]
  );
  const saveDisabled =
    blocked ||
    refreshing ||
    association.isError ||
    mutation.isPending ||
    !(removing || draft?.selected);
  return {
    access,
    association,
    latest,
    denied,
    editing,
    removing,
    correction,
    draft,
    history,
    historyCursor,
    mutation,
    blocked,
    refreshing,
    reviewing,
    refreshError,
    select,
    save,
    refresh,
    review,
    close,
    change,
    remove,
    cancel,
    changeReason,
    retryAssociation,
    retryHistory,
    firstHistory,
    nextHistory,
    saveDisabled,
  };
}
export type AssociationDialogState = ReturnType<
  typeof useDocumentWorkOrderDialog
>;
