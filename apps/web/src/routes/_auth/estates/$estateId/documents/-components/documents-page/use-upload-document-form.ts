import { type ChangeEvent, useCallback, useState } from "react";
import { toast } from "sonner";
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
export function useUploadDocumentForm(
  estateId: string,
  onClose: () => void,
  onUploaded: (message: string) => void
) {
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
          : "Couldn't upload. Check the document list before you try again."
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
  return { changeFile, changeType, close, documentType, error, submit, upload };
}
