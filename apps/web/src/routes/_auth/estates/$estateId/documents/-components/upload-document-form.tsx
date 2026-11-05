import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@proj/ui/components/select";
import { FormDialog } from "@/components/form-dialog";
import { useUploadDocumentForm } from "./use-upload-document-form";

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
  const { changeFile, changeType, close, documentType, error, submit, upload } =
    useUploadDocumentForm(estateId, onClose, onUploaded);
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
