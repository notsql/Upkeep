import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { type ChangeEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/form-dialog";
import { type DocumentType, useUploadDocument } from "@/lib/documents";

function validateFile(file: File | undefined): string | undefined {
  if (!file) {
    return "Choose a file to upload.";
  }
  if (!file.size) {
    return "Choose a non-empty file containing at least one byte.";
  }
  if (file.size > 5_000_000) {
    return "Choose a file no larger than 5 MB.";
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  const supported =
    (extension === "pdf" && file.type === "application/pdf") ||
    ((extension === "jpg" || extension === "jpeg") &&
      file.type === "image/jpeg") ||
    (extension === "png" && file.type === "image/png");
  if (!supported) {
    return "Use a PDF, JPEG or PNG file with a matching extension and type.";
  }
  return undefined;
}

/** The upload task, opened by the page's Create button. */
export function UploadDocumentForm({
  estateId,
  open,
  onClose,
  onUploaded,
}: {
  estateId: string;
  open: boolean;
  onClose: () => void;
  onUploaded: (message: string) => void;
}) {
  const upload = useUploadDocument(estateId);
  const [documentType, setDocumentType] = useState<DocumentType | "">("");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState<string>();
  const close = useCallback(() => {
    if (upload.isPending) {
      return;
    }
    setError(undefined);
    setFile(undefined);
    setDocumentType("");
    onClose();
  }, [upload.isPending, onClose]);
  const changeType = useCallback(
    (value: string | null) =>
      setDocumentType(
        value === "INVOICE" || value === "SERVICE_REPORT" ? value : ""
      ),
    []
  );
  const changeFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0]),
    []
  );
  const submit = useCallback(async () => {
    if (upload.isPending) {
      return;
    }
    const invalid =
      validateFile(file) ??
      (documentType ? undefined : "Choose Invoice or Service report.");
    setError(invalid);
    if (invalid || !file || !documentType) {
      return;
    }
    try {
      await upload.mutateAsync({ file, documentType });
      const message = `"${file.name}" uploaded successfully.`;
      onUploaded(message);
      toast.success(message);
      setFile(undefined);
      setDocumentType("");
      onClose();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to upload. Check the document list before retrying."
      );
    }
  }, [
    documentType,
    file,
    onClose,
    onUploaded,
    upload.isPending,
    upload.mutateAsync,
  ]);
  return (
    <FormDialog
      description={
        <span id="document-formats">
          PDF, JPEG or PNG. One file per upload, up to 5 MB.
        </span>
      }
      error={error}
      onClose={close}
      onSubmit={submit}
      open={open}
      pending={upload.isPending}
      pendingLabel="Uploading…"
      submitLabel="Upload"
      title="Upload a document"
    >
      <div className="grid gap-2">
        <Label htmlFor="document-type">Document type</Label>
        <Select
          disabled={upload.isPending}
          onValueChange={changeType}
          value={documentType}
        >
          <SelectTrigger className="w-full" id="document-type">
            <SelectValue placeholder="Choose document type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INVOICE">Invoice</SelectItem>
            <SelectItem value="SERVICE_REPORT">Service report</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="document-file">File to upload</Label>
        <Input
          accept=".pdf,.jpg,.jpeg,.png"
          aria-describedby="document-formats"
          disabled={upload.isPending}
          id="document-file"
          onChange={changeFile}
          type="file"
        />
      </div>
      {upload.isPending ? (
        <p className="sr-only" role="status">
          Uploading…
        </p>
      ) : null}
    </FormDialog>
  );
}
