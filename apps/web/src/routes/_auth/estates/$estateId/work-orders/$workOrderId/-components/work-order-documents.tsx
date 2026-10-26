import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { useCallback, useState } from "react";
import { type EstateDocument, useDownloadDocument } from "@/lib/documents";
import {
  useWorkOrderDocumentAccess,
  useWorkOrderDocuments,
} from "@/lib/work-order-documents";

function AttachmentRow({
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
      <TableCell className="max-w-xs whitespace-normal break-words">
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
export function WorkOrderDocuments({
  estateId,
  workOrderId,
}: {
  estateId: string;
  workOrderId: string;
}) {
  const access = useWorkOrderDocumentAccess(estateId);
  const [cursor, setCursor] = useState<string>();
  const documents = useWorkOrderDocuments(estateId, workOrderId, cursor);
  const download = useDownloadDocument(estateId);
  const downloadDocument = useCallback(
    (document: EstateDocument) => download.mutate(document),
    [download.mutate]
  );
  const retry = useCallback(() => documents.refetch(), [documents.refetch]);
  const first = useCallback(() => setCursor(undefined), []);
  const next = useCallback(
    () => setCursor(documents.data?.nextCursor ?? undefined),
    [documents.data?.nextCursor]
  );
  if (!access.canRead) {
    return null;
  }
  return (
    <Card>
      <CardContent className="min-w-0 space-y-4">
        <h2 className="font-medium text-lg">Documents</h2>
        {documents.isPending ? <p role="status">Loading documents…</p> : null}
        {documents.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              Unable to load documents.{" "}
              <Button onClick={retry} variant="outline">
                Retry documents
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {download.isError ? <p role="alert">{download.error.message}</p> : null}
        {!documents.isError && documents.data?.items.length === 0 ? (
          <p>No documents linked to this work order.</p>
        ) : null}
        {!documents.isError && documents.data?.items.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>File</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.data.items.map((document) => (
                <AttachmentRow
                  document={document}
                  key={document.id}
                  onDownload={downloadDocument}
                  pending={download.isPending}
                />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {cursor ? (
            <Button onClick={first} variant="outline">
              First document page
            </Button>
          ) : null}
          {documents.data?.nextCursor ? (
            <Button onClick={next} variant="outline">
              Next documents
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
