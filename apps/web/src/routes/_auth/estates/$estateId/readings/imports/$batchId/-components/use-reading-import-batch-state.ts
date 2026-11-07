import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useAppAccess } from "@/lib/access";
import {
  downloadImportReport,
  type ReadingImportOutcome,
  readingImportMessage,
  useReadingImport,
  useReadingImportRows,
  useRevertReadingImport,
} from "@/lib/reading-imports";

export function useReadingImportBatchState({
  estateId,
  batchId,
}: {
  estateId: string;
  batchId: string;
}) {
  const { user } = useAuth();
  const access = useAppAccess();
  const permission = access.data?.estates.find(
    (estate) => estate.estateId === estateId
  );
  const allowed = Boolean(
    permission?.canImportReadings ||
      permission?.canRevertReadingImports ||
      permission?.role === "MANAGER"
  );
  const detail = useReadingImport(estateId, batchId, allowed);
  const [page, setPage] = useState(0);
  const [outcome, setOutcome] = useState<ReadingImportOutcome>();
  const rows = useReadingImportRows(estateId, batchId, page, outcome, allowed);
  const rollback = useRevertReadingImport(estateId, batchId);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const report = useRef<AbortController | null>(null);
  const scope = `${user?.id}:${estateId}:${batchId}`;
  const current = useRef(scope);
  current.current = scope;
  const resetRollback = rollback.reset;
  useEffect(() => {
    if (current.current !== scope) {
      return;
    }
    resetRollback();
    setReason("");
    setDownloading(false);
    setPage(0);
    setOutcome(undefined);
    setOpen(false);
    setError("");
    return () => {
      controller.current?.abort();
      report.current?.abort();
      pending.current = false;
    };
  }, [scope, resetRollback]);
  useEffect(() => {
    if (!permission?.canRevertReadingImports) {
      controller.current?.abort();
      setOpen(false);
    }
  }, [permission?.canRevertReadingImports]);
  const batch = detail.data;
  const revert = useCallback(async () => {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    const blocked = pending.current || !permission?.canRevertReadingImports;
    if (blocked) {
      return;
    }
    const request = new AbortController();
    controller.current = request;
    pending.current = true;
    setError("");
    try {
      await rollback.mutateAsync({ reason, signal: request.signal });
      const live = current.current === scope && !request.signal.aborted;
      if (live) {
        setOpen(false);
        setReason("");
        toast.success("Import batch reverted.");
      }
    } catch (cause) {
      const live = current.current === scope && !request.signal.aborted;
      if (live) {
        setError(readingImportMessage(cause, "Unable to revert batch."));
      }
    } finally {
      if (controller.current === request) {
        pending.current = false;
        controller.current = null;
      }
    }
  }, [
    reason,
    permission?.canRevertReadingImports,
    rollback.mutateAsync,
    scope,
  ]);
  const download = useCallback(async () => {
    if (downloading) {
      return;
    }
    const request = new AbortController();
    report.current = request;
    setDownloading(true);
    setError("");
    try {
      await downloadImportReport(estateId, batchId, request.signal);
    } catch (cause) {
      if (!request.signal.aborted && current.current === scope) {
        setError(readingImportMessage(cause, "Unable to download report."));
      }
    } finally {
      if (current.current === scope) {
        setDownloading(false);
      }
    }
  }, [downloading, estateId, batchId, scope]);
  const retryDetail = useCallback(() => {
    detail.refetch();
  }, [detail.refetch]);
  const retryRows = useCallback(() => {
    rows.refetch();
  }, [rows.refetch]);
  const showRevert = useCallback(() => {
    setOpen(true);
  }, []);
  const hideRevert = useCallback(() => {
    setOpen(false);
  }, []);
  const changeReason = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setReason(event.target.value);
  }, []);
  const handleDownload = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      download();
    },
    [download]
  );
  const nextPage = useCallback(() => {
    setPage((value) => value + 1);
  }, []);
  const previousPage = useCallback(() => {
    setPage((value) => value - 1);
  }, []);
  const clearOutcome = useCallback(() => {
    setOutcome(undefined);
    setPage(0);
  }, []);
  const changeOutcome = useCallback((value: string | null) => {
    const selected =
      value === "IMPORTED" || value === "DUPLICATE" || value === "INVALID"
        ? value
        : undefined;
    setOutcome(selected);
    setPage(0);
  }, []);
  return {
    estateId,
    batchId,
    access,
    allowed,
    permission,
    batch,
    detail,
    rows,
    page,
    outcome,
    open,
    reason,
    error,
    downloading,
    rollback,
    retryDetail,
    retryRows,
    showRevert,
    hideRevert,
    changeReason,
    handleDownload,
    nextPage,
    previousPage,
    clearOutcome,
    changeOutcome,
    revert,
  };
}
