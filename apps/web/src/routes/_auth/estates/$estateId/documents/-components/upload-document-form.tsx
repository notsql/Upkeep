import { Button } from "@proj/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@proj/ui/components/card";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useRef,
  useState,
} from "react";
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

export function UploadDocumentForm({ estateId }: { estateId: string }) {
  const upload = useUploadDocument(estateId);
  const [documentType, setDocumentType] = useState<DocumentType | "">("");
  const [file, setFile] = useState<File>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
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
  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (upload.isPending) {
        return;
      }
      setSuccess(undefined);
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
        setSuccess(message);
        toast.success(message);
        setFile(undefined);
        setDocumentType("");
        if (input.current) {
          input.current.value = "";
        }
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to upload. Check the document list before retrying."
        );
      }
    },
    [documentType, file, upload.isPending, upload.mutateAsync]
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a document</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={submit}>
          <p id="document-formats">
            PDF, JPEG or PNG. One file per upload, up to 5 MB.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="document-type">Document type</Label>
            <Select
              disabled={upload.isPending}
              onValueChange={changeType}
              value={documentType}
            >
              <SelectTrigger id="document-type">
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
              ref={input}
              type="file"
            />
          </div>
          {error ? <p role="alert">{error}</p> : null}
          {success ? <p role="status">{success}</p> : null}
          {upload.isPending ? <p role="status">Uploading…</p> : null}
          <Button className="w-fit" disabled={upload.isPending} type="submit">
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
