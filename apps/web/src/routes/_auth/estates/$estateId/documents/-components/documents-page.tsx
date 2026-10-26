import { Button } from "@proj/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@proj/ui/components/dialog";
import { Input } from "@proj/ui/components/input";
import { Label } from "@proj/ui/components/label";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@proj/ui/components/table";
import { type ChangeEvent, type FormEvent, useCallback, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import {
  type DocumentFilters,
  type EstateDocument,
  useDeleteDocument,
  useDocumentAccess,
  useDocuments,
  useDownloadDocument,
} from "@/lib/documents";
import { useWorkOrderDocumentAccess } from "@/lib/work-order-documents";
import { DocumentRow } from "./document-row";
import { DocumentWorkOrderDialog } from "./document-work-order-dialog";
import { UploadDocumentForm } from "./upload-document-form";

function FilenameSearch({
  filename,
  onSearch,
}: {
  filename?: string;
  onSearch: (filters: DocumentFilters) => void;
}) {
  const [value, setValue] = useState(filename ?? "");
  const changeValue = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value),
    []
  );
  const clear = useCallback(() => {
    setValue("");
    onSearch({});
  }, [onSearch]);
  const submit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSearch(value.trim() ? { filename: value.trim() } : {});
    },
    [onSearch, value]
  );
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={submit}>
      <div className="grid flex-1 gap-2">
        <Label htmlFor="document-search">Search by filename</Label>
        <Input
          id="document-search"
          maxLength={255}
          onChange={changeValue}
          type="search"
          value={value}
        />
      </div>
      <Button type="submit">Search</Button>
      {filename || value ? (
        <Button onClick={clear} type="button" variant="outline">
          Clear search
        </Button>
      ) : null}
    </form>
  );
}

export function DocumentsPage({
  estateId,
  filters,
  onSearch,
}: {
  estateId: string;
  filters: DocumentFilters;
  onSearch: (filters: DocumentFilters) => void;
}) {
  const access = useDocumentAccess(estateId);
  const associations = useWorkOrderDocumentAccess(estateId);
  const [associationDocument, setAssociationDocument] =
    useState<EstateDocument>();
  const documents = useDocuments(estateId, filters);
  const deletion = useDeleteDocument(estateId);
  const download = useDownloadDocument(estateId);
  const [selected, setSelected] = useState<EstateDocument>();
  const [removed, setRemoved] = useState<string>();
  const chooseDeletion = useCallback(
    (document: EstateDocument) => {
      deletion.reset();
      setSelected(document);
    },
    [deletion.reset]
  );
  const downloadDocument = useCallback(
    (document: EstateDocument) => download.mutate(document),
    [download.mutate]
  );
  const retry = useCallback(() => documents.refetch(), [documents.refetch]);
  const first = useCallback(
    () => onSearch(filters.filename ? { filename: filters.filename } : {}),
    [filters.filename, onSearch]
  );
  const next = useCallback(
    () =>
      onSearch({ ...filters, cursor: documents.data?.nextCursor ?? undefined }),
    [filters, documents.data?.nextCursor, onSearch]
  );
  const close = useCallback(() => setSelected(undefined), []);
  const closeAssociation = useCallback(
    () => setAssociationDocument(undefined),
    []
  );
  const changeDialog = useCallback(
    (open: boolean) => {
      if (!(open || deletion.isPending)) {
        setSelected(undefined);
      }
    },
    [deletion.isPending]
  );
  const remove = useCallback(() => {
    if (!selected || deletion.isPending) {
      return;
    }
    deletion.mutate(selected.id, {
      onSuccess: () => {
        const message = `"${selected.originalFilename}" removed`;
        setRemoved(message);
        toast.success(message);
        setSelected(undefined);
      },
    });
  }, [selected, deletion.isPending, deletion.mutate]);
  if (access.pending) {
    return <p role="status">Loading access…</p>;
  }
  if (!access.canView) {
    return <p role="alert">Documents are unavailable.</p>;
  }
  return (
    <main className="page-layout space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Estates", to: "/estates" },
          { label: access.permission?.estateName ?? "Estate" },
          { label: "Documents" },
        ]}
        title="Documents"
      />
      {access.permission?.canUploadDocuments ? (
        <UploadDocumentForm estateId={estateId} />
      ) : null}
      <FilenameSearch
        filename={filters.filename}
        key={filters.filename ?? ""}
        onSearch={onSearch}
      />
      {removed ? <p role="status">{removed}</p> : null}
      {documents.isPending ? <p role="status">Loading documents…</p> : null}
      {documents.isError ? (
        <div role="alert">
          {documents.error.message}{" "}
          <Button onClick={retry} variant="outline">
            Retry
          </Button>
        </div>
      ) : null}
      {download.isError ? <p role="alert">{download.error.message}</p> : null}
      {!documents.isError && documents.data?.items.length === 0 ? (
        <p>
          {filters.filename
            ? "No files match your search"
            : "No documents uploaded"}
        </p>
      ) : null}
      {!documents.isError && documents.data?.items.length ? (
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
                onAssociation={
                  associations.canRead ? setAssociationDocument : undefined
                }
                onDelete={chooseDeletion}
                onDownload={downloadDocument}
              />
            ))}
          </TableBody>
        </Table>
      ) : null}
      <div className="flex gap-2">
        {filters.cursor ? (
          <Button onClick={first} variant="outline">
            First page
          </Button>
        ) : null}
        {documents.data?.nextCursor ? (
          <Button onClick={next} variant="outline">
            Next
          </Button>
        ) : null}
      </div>
      {associationDocument ? (
        <DocumentWorkOrderDialog
          document={associationDocument}
          estateId={estateId}
          key={`${estateId}:${associationDocument.id}`}
          onClose={closeAssociation}
        />
      ) : null}
      <Dialog onOpenChange={changeDialog} open={!!selected}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file</DialogTitle>
            <DialogDescription>
              {selected?.originalFilename} will be removed from the estate
              documents. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletion.isError ? (
            <p role="alert">{deletion.error.message}</p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={deletion.isPending}
              onClick={close}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={deletion.isPending}
              onClick={remove}
              variant="destructive"
            >
              {deletion.isPending ? "Deleting…" : "Delete file"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
