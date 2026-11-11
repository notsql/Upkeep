import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { useCallback, useRef, useState } from "react";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import {
  type HistoryDocument,
  historyDate,
  useHistoryDocument,
} from "@/lib/asset-history";
import { useDownloadDocument } from "@/lib/documents";

export function HistoryDocumentDialog({
  estateId,
  assetId,
  document,
  trigger,
  onClose,
}: {
  estateId: string;
  assetId: string;
  document: HistoryDocument;
  trigger: HTMLButtonElement;
  onClose: () => void;
}) {
  const file = useHistoryDocument(estateId, assetId, document.id);
  const download = useDownloadDocument(estateId);
  const title = useRef<HTMLHeadingElement>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const preview = useRef<Element | null>(null);
  const failPreview = useCallback(() => setPreviewFailed(true), []);
  const attachPreview = useCallback(
    (element: Element | null) => {
      preview.current?.removeEventListener("error", failPreview);
      element?.addEventListener("error", failPreview);
      preview.current = element;
    },
    [failPreview]
  );
  const changeOpen = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
    [onClose]
  );
  const returnFocus = useCallback(() => trigger, [trigger]);
  const retry = useCallback(() => {
    setPreviewFailed(false);
    file.refetch();
  }, [file.refetch]);
  const save = useCallback(
    () => download.mutate(document),
    [download.mutate, document]
  );
  const url = file.isError ? undefined : file.data?.url;
  const pdf =
    document.contentType === "application/pdf" &&
    navigator.pdfViewerEnabled !== false;
  const image = ["image/png", "image/jpeg"].includes(document.contentType);
  const type =
    document.documentType === "INVOICE" ? "Invoice" : "Service report";
  return (
    <Dialog onOpenChange={changeOpen} open>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"
        finalFocus={returnFocus}
        initialFocus={title}
      >
        <DialogHeader>
          <DialogTitle className="pr-8 break-words" ref={title} tabIndex={-1}>
            {type}: {document.originalFilename}
          </DialogTitle>
          <DialogDescription>
            {type} · Uploaded {historyDate(document.createdAt)}. This is the
            upload date.
          </DialogDescription>
        </DialogHeader>
        {file.isPending ? (
          <LoadingState label="Loading document…" rows={3} />
        ) : null}
        {file.error ? (
          <ErrorState message={file.error.message} onRetry={retry} />
        ) : null}
        {url && !previewFailed && pdf ? (
          <object
            aria-label={`Preview ${document.originalFilename}`}
            className="h-[60dvh] w-full rounded-md border"
            data={url}
            ref={attachPreview}
            title={`Preview ${document.originalFilename}`}
            type="application/pdf"
          >
            <p>Use Download if the PDF is not displayed.</p>
          </object>
        ) : null}
        {url && !previewFailed && image ? (
          <img
            alt={`Preview ${document.originalFilename}`}
            className="max-h-[60dvh] w-full object-contain"
            height={900}
            ref={attachPreview}
            src={url}
            width={1200}
          />
        ) : null}
        {url && (previewFailed || !(pdf || image)) ? (
          <p role="status">
            Preview unavailable. Download the original file to read it.
          </p>
        ) : null}
        {download.error ? <p role="alert">{download.error.message}</p> : null}
        <DialogFooter>
          {url && !previewFailed && pdf ? (
            <Button onClick={failPreview} variant="ghost">
              Preview not working?
            </Button>
          ) : null}
          <Button
            disabled={download.isPending}
            onClick={save}
            variant="outline"
          >
            {download.isPending ? "Downloading…" : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
