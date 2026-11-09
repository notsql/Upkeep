import { Button } from "@proj/ui/components/button";
import { Card, CardContent } from "@proj/ui/components/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { Files, FileText } from "lucide-react";
import { useCallback, useState } from "react";
import { SectionHeading } from "@/components/page/section-heading";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { LoadingState } from "@/components/states/loading-state";
import { type EstateDocument, useDownloadDocument } from "@/lib/documents";
import {
  useWorkOrderDocumentAccess,
  useWorkOrderDocuments,
} from "@/lib/work-order-documents";

import { AttachmentRow } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/attachment-row";

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
        <SectionHeading icon={Files}>Documents</SectionHeading>
        {documents.isPending ? (
          <LoadingState label="Loading documents…" variant="table" />
        ) : null}
        {documents.isError ? (
          <ErrorState
            message="Couldn't load documents. Try again."
            onRetry={retry}
            retryLabel="Retry documents"
          />
        ) : null}
        {download.isError ? <p role="alert">{download.error.message}</p> : null}
        {!documents.isError && documents.data?.items.length === 0 ? (
          <EmptyState
            description="Linked documents appear here"
            icon={FileText}
            title="No documents yet"
          />
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
