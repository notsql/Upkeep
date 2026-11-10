import { Button } from "@proj/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemSeparator,
  ItemTitle,
} from "@proj/ui/components/item";
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

/** The phone view of one linked document (mobile list items). */
export function AttachmentItem({
  document,
  first,
  pending,
  onDownload,
}: {
  document: EstateDocument;
  first: boolean;
  pending: boolean;
  onDownload: (document: EstateDocument) => void;
}) {
  const download = useCallback(
    () => onDownload(document),
    [document, onDownload]
  );
  const type =
    document.documentType === "INVOICE" ? "Invoice" : "Service report";
  const size = `${new Intl.NumberFormat().format(document.sizeBytes)} bytes`;
  return (
    <li>
      {first ? null : <ItemSeparator className="my-0" />}
      <Item size="sm">
        <ItemContent className="min-w-0">
          <ItemTitle className="line-clamp-none [overflow-wrap:anywhere]">
            {document.originalFilename}
          </ItemTitle>
          <ItemDescription className="text-xs">{`${type} · ${size}`}</ItemDescription>
          <ItemDescription className="text-xs">
            <time dateTime={document.createdAt}>
              {`Uploaded ${new Date(document.createdAt).toLocaleString()}`}
            </time>
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            aria-label={`Download ${document.originalFilename}`}
            disabled={pending}
            onClick={download}
            size="sm"
            variant="outline"
          >
            Download
          </Button>
        </ItemActions>
      </Item>
    </li>
  );
}
