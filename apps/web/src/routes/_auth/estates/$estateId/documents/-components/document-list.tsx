import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@proj/ui/components/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import type { ReactNode } from "react";
import type { DocumentFilters, EstateDocument } from "@/lib/documents";
import { useMobile } from "@/lib/use-mobile";
import {
  DocumentActions,
  DocumentRow,
  type DocumentRowProps,
} from "./document-row";

export function DocumentList({
  items,
  failed,
  filename,
  documentType,
  renderAssets,
  ...actions
}: Omit<DocumentRowProps, "document" | "assets" | "showSize"> & {
  items?: EstateDocument[];
  failed: boolean;
  filename?: string;
  documentType?: DocumentFilters["documentType"];
  renderAssets?: (document: EstateDocument) => ReactNode;
}) {
  const mobile = useMobile();
  if (failed || !items) {
    return null;
  }
  if (!items.length) {
    return (
      <p>
        {filename || documentType
          ? "No files match your search"
          : "No documents uploaded"}
      </p>
    );
  }
  if (mobile) {
    return (
      <ul aria-label="Documents" className="grid min-w-0 gap-3">
        {items.map((document) => (
          <li className="min-w-0" key={document.id}>
            <Card
              className="min-w-0 rounded-xl [overflow-wrap:anywhere]"
              size="sm"
            >
              <CardHeader>
                <h2 className="font-medium text-sm">
                  {document.originalFilename}
                </h2>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-2">
                  <div>
                    <dt className="text-muted-foreground">Type</dt>
                    <dd>
                      {document.documentType === "INVOICE"
                        ? "Invoice"
                        : "Service report"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Uploaded</dt>
                    <dd>
                      <time dateTime={document.createdAt}>
                        {new Date(document.createdAt).toLocaleString()}
                      </time>
                    </dd>
                  </div>
                  {renderAssets ? (
                    <div>
                      <dt className="text-muted-foreground">Asset</dt>
                      <dd>{renderAssets(document)}</dd>
                    </div>
                  ) : null}
                </dl>
              </CardContent>
              <CardFooter>
                <DocumentActions document={document} {...actions} />
              </CardFooter>
            </Card>
          </li>
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
