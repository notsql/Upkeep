import { Button } from "@proj/ui/components/button";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { useCallback } from "react";
import type { EstateDocument } from "@/lib/documents";

export function DocumentRow({
  document,
  downloading,
  onDownload,
  onDelete,
  onAssociation,
}: {
  document: EstateDocument;
  downloading: boolean;
  onDownload: (document: EstateDocument) => void;
  onDelete: (document: EstateDocument) => void;
  onAssociation?: (document: EstateDocument) => void;
}) {
  const download = useCallback(
    () => onDownload(document),
    [document, onDownload]
  );
  const remove = useCallback(() => onDelete(document), [document, onDelete]);
  const association = useCallback(
    () => onAssociation?.(document),
    [document, onAssociation]
  );
  return (
    <TableRow>
      <TableCell>{document.originalFilename}</TableCell>
      <TableCell>
        {document.documentType === "INVOICE" ? "Invoice" : "Service report"}
      </TableCell>
      <TableCell>
        {new Intl.NumberFormat().format(document.sizeBytes)} bytes
      </TableCell>
      <TableCell>
        <time dateTime={document.createdAt}>
          {new Date(document.createdAt).toLocaleString()}
        </time>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2">
          {onAssociation ? (
            <Button
              aria-label={`Work-order link for ${document.originalFilename}`}
              onClick={association}
              variant="outline"
            >
              Work order
            </Button>
          ) : null}
          <Button
            aria-label={`Download ${document.originalFilename}`}
            disabled={downloading}
            onClick={download}
            variant="outline"
          >
            Download
          </Button>
          {document.canDelete ? (
            <Button
              aria-label={`Delete ${document.originalFilename}`}
              onClick={remove}
              variant="destructive"
            >
              Delete
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
