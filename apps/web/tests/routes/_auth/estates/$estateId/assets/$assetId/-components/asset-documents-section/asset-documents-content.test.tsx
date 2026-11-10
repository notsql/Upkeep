import { fireEvent } from "@testing-library/react";
import { mockMobileViewport } from "@tests/mock-viewport";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { AssetDocumentsContent } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-documents-section/asset-documents-content";

const download = vi.hoisted(() => vi.fn());

// Phones read the infinite feed; desktop reads the page query.
const page = vi.hoisted(() => ({
  items: [
    {
      id: "d1",
      originalFilename: "invoice.pdf",
      documentType: "INVOICE",
      sizeBytes: 1200,
      createdAt: "2026-10-25T08:00:00Z",
      canDelete: false,
    },
  ],
}));

vi.mock("@/lib/asset-documents", () => ({
  useAssetDocuments: () => ({
    data: page,
    isPending: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useAssetDocumentFeed: () => ({
    data: { pages: [page] },
    isPending: false,
    isError: false,
    isFetching: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  }),
  useDocumentAsset: () => ({
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/documents", () => ({
  useDownloadDocument: () => ({
    mutate: download,
    isPending: false,
    isError: false,
  }),
}));

beforeEach(() => {
  mockMobileViewport();
  download.mockReset();
});

it("lists documents on phones with the filename, details and actions", async () => {
  renderWithProviders(
    <AssetDocumentsContent assetId="a" canWrite estateId="e" />
  );
  expect(screen.queryByRole("table")).toBeNull();
  const list = within(screen.getByRole("list", { name: "Documents" }));
  const item = within(list.getByRole("listitem"));
  item.getByText("invoice.pdf");
  item.getByText("Invoice");
  item.getByText("1,200 bytes");
  fireEvent.click(
    item.getByRole("button", { name: "Actions for invoice.pdf" })
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: "Download" }));
  expect(download).toHaveBeenCalled();
});

it("offers a single download button when the viewer cannot unlink", () => {
  renderWithProviders(
    <AssetDocumentsContent assetId="a" canWrite={false} estateId="e" />
  );
  const item = within(screen.getByRole("listitem"));
  fireEvent.click(item.getByRole("button", { name: "Download invoice.pdf" }));
  expect(download).toHaveBeenCalled();
});
