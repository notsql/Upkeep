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
  ItemTitle,
} from "@proj/ui/components/item";
import { MoreHorizontal } from "lucide-react";
import { useCallback } from "react";
import type { EstateDocument } from "@/lib/documents";
import { DocumentActions } from "@/routes/_auth/estates/$estateId/documents/-components/document-actions";

/** Phone view of one linked document. */
export function AssetDocumentItem({
  document,
  downloading,
  onDownload,
  onUnlink,
}: {
  document: EstateDocument;
  downloading: boolean;
  onDownload: (document: EstateDocument) => void;
  onUnlink?: (document: EstateDocument) => void;
}) {
  const download = useCallback(
    () => onDownload(document),
    [document, onDownload]
  );
  const unlink = useCallback(() => onUnlink?.(document), [document, onUnlink]);
  return (
    <Item className="flex-nowrap items-start" role="listitem" size="sm">
      <ItemContent className="min-w-0">
        <ItemTitle className="line-clamp-none [overflow-wrap:anywhere]">
          {document.originalFilename}
        </ItemTitle>
        <ItemDescription className="text-xs">
          <span>
            {document.documentType === "INVOICE" ? "Invoice" : "Service report"}
          </span>{" "}
          ·{" "}
          <span>
            {new Intl.NumberFormat().format(document.sizeBytes)} bytes
          </span>{" "}
          ·{" "}
          <time dateTime={document.createdAt}>
            {new Date(document.createdAt).toLocaleString()}
          </time>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        {onUnlink ? (
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
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={downloading} onClick={download}>
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={unlink}>Unlink</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <DocumentActions
            document={document}
            downloading={downloading}
            onDownload={onDownload}
          />
        )}
      </ItemActions>
    </Item>
  );
}
