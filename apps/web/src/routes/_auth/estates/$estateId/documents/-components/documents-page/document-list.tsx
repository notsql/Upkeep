import { Button } from "@proj/ui/components/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/states/empty-state";
import type { DocumentFilters, EstateDocument } from "@/lib/documents";
import { useMobile } from "@/lib/use-mobile";
import type { DocumentRowProps } from "@/routes/_auth/estates/$estateId/documents/-components/document-actions";
import {
  DocumentItem,
  DocumentRow,
} from "@/routes/_auth/estates/$estateId/documents/-components/document-row";

export function DocumentList({
  items,
  failed,
  filename,
  documentType,
  renderAssets,
  onClearFilters,
  ...actions
}: Omit<DocumentRowProps, "document" | "assets" | "showSize"> & {
  items?: EstateDocument[];
  failed: boolean;
  filename?: string;
  documentType?: DocumentFilters["documentType"];
  renderAssets?: (document: EstateDocument) => ReactNode;
  onClearFilters?: () => void;
}) {
  const mobile = useMobile();
  if (failed || !items) {
    return null;
  }
  if (!items.length) {
    const filtered = !!(filename || documentType);
    if (filtered) {
      return (
        <EmptyState
          action={
            onClearFilters ? (
              <Button onClick={onClearFilters} variant="outline">
                Clear filters
              </Button>
            ) : undefined
          }
          description="Try other filters"
          fill
          icon={FileText}
          title="No matching documents"
        />
      );
    }
    return (
      <EmptyState
        description="Uploads appear here"
        fill
        icon={FileText}
        title="No documents yet"
      />
    );
  }
  if (mobile) {
    return (
      <ul aria-label="Documents" className="flex min-w-0 flex-col">
        {items.map((document, index) => (
          <DocumentItem
            assets={renderAssets?.(document)}
            document={document}
            first={index === 0}
            key={document.id}
            {...actions}
          />
        ))}
      </ul>
    );
  }
  return (
    <Table aria-label="Documents">
      <TableHeader>
        <TableRow>
          {[
            "Filename",
            "Type",
            "Uploaded",
            ...(renderAssets ? ["Asset"] : []),
            "Actions",
          ].map((label) => (
            <TableHead key={label}>{label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((document) => (
          <DocumentRow
            assets={renderAssets?.(document)}
            document={document}
            key={document.id}
            showSize={false}
            {...actions}
          />
        ))}
      </TableBody>
    </Table>
  );
}
