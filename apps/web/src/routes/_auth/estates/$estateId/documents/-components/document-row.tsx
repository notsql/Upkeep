import { Button } from "@proj/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@proj/ui/components/dropdown-menu";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemSeparator,
  ItemTitle,
} from "@proj/ui/components/item";
import { TableCell, TableRow } from "@proj/ui/components/table";
import { EllipsisVertical } from "lucide-react";
import { useCallback } from "react";

import { DocumentActions, type DocumentRowProps } from "./document-actions";

export function DocumentRow(props: DocumentRowProps) {
  const { document, assets, showSize = true } = props;
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
        <DocumentActions {...props} />
      </TableCell>
    </TableRow>
  );
}

function DocumentMenu({
  document,
  downloading,
  onDownload,
  onDelete,
  onAssociation,
  onUnlink,
}: DocumentRowProps) {
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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Actions for ${document.originalFilename}`}
            size="icon"
            variant="ghost"
          />
        }
      >
        <EllipsisVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onUnlink ? (
          <DropdownMenuItem onClick={unlink}>Unlink</DropdownMenuItem>
        ) : null}
        {onAssociation ? (
          <DropdownMenuItem onClick={association}>
            Work order link
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={downloading} onClick={download}>
          Download
        </DropdownMenuItem>
        {document.canDelete && onDelete ? (
          <DropdownMenuItem onClick={remove} variant="destructive">
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The phone view of one document (mobile list items). */
export function DocumentItem(props: DocumentRowProps & { first: boolean }) {
  const { document, assets, first, onUnlink, onAssociation, onDelete } = props;
  const several = Boolean(
    onUnlink || onAssociation || (document.canDelete && onDelete)
  );
  return (
    <li>
      {first ? null : <ItemSeparator className="my-0" />}
      <Item size="sm">
        <ItemContent className="min-w-0">
          <ItemTitle className="line-clamp-none [overflow-wrap:anywhere]">
            {document.originalFilename}
          </ItemTitle>
          <ItemDescription className="flex flex-wrap gap-x-1 text-xs">
            <span>
              {document.documentType === "INVOICE"
                ? "Invoice"
                : "Service report"}
            </span>
            {assets === undefined ? null : (
              <>
                <span aria-hidden="true">·</span>
                {assets}
              </>
            )}
          </ItemDescription>
          <ItemDescription className="text-xs">
            <time dateTime={document.createdAt}>
              {`Uploaded ${new Date(document.createdAt).toLocaleString()}`}
            </time>
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          {several ? (
            <DocumentMenu {...props} />
          ) : (
            <DocumentActions {...props} />
          )}
        </ItemActions>
      </Item>
    </li>
  );
}
