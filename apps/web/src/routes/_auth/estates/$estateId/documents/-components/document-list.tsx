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
import type { EstateDocument } from "@/lib/documents";
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
  ...actions
}: Omit<DocumentRowProps, "document"> & {
  items?: EstateDocument[];
  failed: boolean;
  filename?: string;
}) {
  const mobile = useMobile();
  if (failed || !items) {
    return null;
  }
  if (!items.length) {
    return (
      <p>{filename ? "No files match your search" : "No documents uploaded"}</p>
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
                    <dt className="text-muted-foreground">Size</dt>
                    <dd>
                      {new Intl.NumberFormat().format(document.sizeBytes)} bytes
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
          {["Filename", "Type", "Size", "Uploaded", "Actions"].map((label) => (
            <TableHead key={label}>{label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((document) => (
          <DocumentRow document={document} key={document.id} {...actions} />
        ))}
      </TableBody>
    </Table>
  );
}
