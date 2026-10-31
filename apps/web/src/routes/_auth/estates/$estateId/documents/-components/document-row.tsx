import { Button } from "@proj/ui/components/button";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { type ReactNode, useCallback } from "react";
import type { EstateDocument } from "@/lib/documents";

export function DocumentRow({
  document,
  downloading,
  onDownload,
  onDelete,
  onAssociation,
  assets,
  onUnlink,
  showSize = true,
}: {
  document: EstateDocument;
  downloading: boolean;
  onDownload: (document: EstateDocument) => void;
  onDelete?: (document: EstateDocument) => void;
  onAssociation?: (document: EstateDocument) => void;
  assets?: ReactNode;
  onUnlink?: (document: EstateDocument) => void;
  showSize?: boolean;
}) {
  const download = useCallback(
    () => onDownload(document),
    [document, onDownload]
  );
  const remove = useCallback(() => onDelete?.(document), [document, onDelete]);
  const unlink = useCallback(() => onUnlink?.(document), [document, onUnlink]);
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
      {showSize ? (
        <TableCell>
          {new Intl.NumberFormat().format(document.sizeBytes)} bytes
        </TableCell>
      ) : null}
      <TableCell>
        <time dateTime={document.createdAt}>
          {new Date(document.createdAt).toLocaleString()}
        </time>
      </TableCell>
      {assets === undefined ? null : <TableCell>{assets}</TableCell>}
      <TableCell>
        <div className="flex flex-wrap gap-2">
          {onUnlink ? (
            <Button
              aria-label={`Unlink ${document.originalFilename}`}
              onClick={unlink}
              variant="outline"
            >
              Unlink
            </Button>
          ) : null}
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
          {document.canDelete && onDelete ? (
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
