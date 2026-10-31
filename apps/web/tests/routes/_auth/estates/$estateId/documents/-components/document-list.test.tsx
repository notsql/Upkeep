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
  screen.getByText("No files match your search");
  expect(screen.queryByText("No documents uploaded")).toBeNull();
});
