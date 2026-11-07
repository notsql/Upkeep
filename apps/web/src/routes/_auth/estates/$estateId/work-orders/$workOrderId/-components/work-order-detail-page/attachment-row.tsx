import { Button } from "@proj/ui/components/button";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { useCallback } from "react";
import type { EstateDocument } from "@/lib/documents";

export function AttachmentRow({
  document,
  pending,
  onDownload,
}: {
  document: EstateDocument;
  pending: boolean;
  onDownload: (document: EstateDocument) => void;
}) {
  const download = useCallback(
    () => onDownload(document),
    [document, onDownload]
  );
  return (
    <TableRow>
      <TableCell className="max-w-xs break-words whitespace-normal">
        {document.originalFilename}
      </TableCell>
      <TableCell>
        {document.documentType === "INVOICE" ? "Invoice" : "Service report"}
      </TableCell>
      <TableCell>{new Date(document.createdAt).toLocaleString()}</TableCell>
      <TableCell>
        <Button
          aria-label={`Download ${document.originalFilename}`}
          disabled={pending}
          onClick={download}
          variant="outline"
        >
          Download
        </Button>
      </TableCell>
    </TableRow>
  );
}
