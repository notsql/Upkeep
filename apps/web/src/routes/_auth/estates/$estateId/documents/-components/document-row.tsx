import { TableCell, TableRow } from "@proj/ui/components/table";

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
