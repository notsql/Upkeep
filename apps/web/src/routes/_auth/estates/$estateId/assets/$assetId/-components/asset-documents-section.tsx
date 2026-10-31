import { Alert, AlertDescription } from "@proj/ui/components/alert";
import { Button } from "@proj/ui/components/button";
import { Card, CardContent, CardHeader } from "@proj/ui/components/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { useCallback, useState } from "react";
import {
  useAssetDocumentAccess,
  useAssetDocuments,
  useDocumentAsset,
} from "@/lib/asset-documents";
import { type EstateDocument, useDownloadDocument } from "@/lib/documents";
import { DocumentAssetDialog } from "@/routes/_auth/estates/$estateId/documents/-components/document-asset-dialog";
import { DocumentRow } from "@/routes/_auth/estates/$estateId/documents/-components/document-row";

export function AssetDocumentsSection({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const access = useAssetDocumentAccess(estateId);
  if (!access.canRead) {
    return null;
  }
  return (
    <AssetDocumentsContent
      assetId={assetId}
      canWrite={access.canWrite}
      estateId={estateId}
      key={`${access.userId}:${estateId}:${assetId}`}
    />
  );
}

function AssetDocumentsContent({
  estateId,
  assetId,
  canWrite,
}: {
  estateId: string;
  assetId: string;
  canWrite: boolean;
}) {
  const [cursor, setCursor] = useState<string>();
  const [selected, setSelected] = useState<EstateDocument>();
  const documents = useAssetDocuments(estateId, assetId, cursor);
  const association = useDocumentAsset(estateId, selected?.id ?? "");
  const download = useDownloadDocument(estateId);
  const close = useCallback(() => setSelected(undefined), []);
  const downloadDocument = useCallback(
    (document: EstateDocument) => download.mutate(document),
    [download.mutate]
  );
  const retry = useCallback(() => documents.refetch(), [documents.refetch]);
  const next = useCallback(
    () => setCursor(documents.data?.nextCursor ?? undefined),
    [documents.data?.nextCursor]
  );
  const first = useCallback(() => setCursor(undefined), []);
  const retryAssociation = useCallback(
    () => association.refetch(),
    [association.refetch]
  );
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold text-lg">Documents</h2>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4">
        {documents.isPending ? <p role="status">Loading documents…</p> : null}
        {documents.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {documents.error.message}
              <Button onClick={retry} type="button" variant="outline">
                Retry documents
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {download.isError ? <p role="alert">{download.error.message}</p> : null}
        {documents.data?.items.length === 0 ? (
          <p>No documents linked to this asset.</p>
        ) : null}
        {documents.data?.items.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Filename</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.data.items.map((document) => (
                <DocumentRow
                  document={document}
                  downloading={download.isPending}
                  key={document.id}
                  onDownload={downloadDocument}
                  onUnlink={canWrite ? setSelected : undefined}
                />
              ))}
            </TableBody>
          </Table>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {cursor ? (
            <Button onClick={first} type="button" variant="outline">
              First page
            </Button>
          ) : null}
          {documents.data?.nextCursor ? (
            <Button onClick={next} type="button" variant="outline">
              Next
            </Button>
          ) : null}
        </div>
        {selected && association.isPending ? (
          <p role="status">Loading document link…</p>
        ) : null}
        {selected && association.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              {association.error.message}
              <Button
                onClick={retryAssociation}
                type="button"
                variant="outline"
              >
                Retry association
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {selected && association.data && canWrite ? (
          <DocumentAssetDialog
            document={selected}
            estateId={estateId}
            initialAssociation={association.data}
            initialUnlink
            key={selected.id}
            onClose={close}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
