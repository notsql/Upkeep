import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import type { EstateDocument } from "@/lib/documents";
import { DocumentList } from "@/routes/_auth/estates/$estateId/documents/-components/document-list";

vi.mock("@/lib/use-mobile", () => ({ useMobile: () => true }));

const document: EstateDocument = {
  id: "00000000-0000-0000-0000-000000000002",
  estateId: "00000000-0000-0000-0000-000000000001",
  documentType: "INVOICE",
  originalFilename: "Invoice.pdf",
  contentType: "application/pdf",
  sizeBytes: 1234,
  createdAt: "2026-10-25T01:00:00Z",
  canDelete: true,
};

function renderAssetLink() {
  return <a href="/estates/estate/assets/pump">Pump A</a>;
}

it("keeps asset links in the mobile document list and omits the removed Size field", () => {
  renderWithProviders(
    <DocumentList
      downloading={false}
      failed={false}
      items={[document]}
      onDownload={vi.fn()}
      renderAssets={renderAssetLink}
    />
  );
  const list = within(screen.getByRole("list", { name: "Documents" }));
  list.getByRole("link", { name: "Pump A" });
  list.getByRole("button", { name: "Download Invoice.pdf" });
  expect(list.queryByText("Size")).toBeNull();
  expect(list.queryByText("1,234 bytes")).toBeNull();
});

it("explains an empty result when only a document type filter is active", () => {
  renderWithProviders(
    <DocumentList
      documentType="INVOICE"
      downloading={false}
      failed={false}
      items={[]}
      onDownload={vi.fn()}
    />
  );
  screen.getByText("No matching documents");
  expect(screen.queryByText("No documents yet")).toBeNull();
});

it("offers Clear filters when filters produced no documents", () => {
  const clear = vi.fn();
  renderWithProviders(
    <DocumentList
      downloading={false}
      failed={false}
      filename="pump"
      items={[]}
      onClearFilters={clear}
      onDownload={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(clear).toHaveBeenCalled();
});

it("offers the create action when nothing has been uploaded", () => {
  renderWithProviders(
    <DocumentList
      createAction={<button type="button">Upload document</button>}
      downloading={false}
      failed={false}
      items={[]}
      onDownload={vi.fn()}
    />
  );
  screen.getByText("No documents yet");
  screen.getByRole("button", { name: "Upload document" });
});
