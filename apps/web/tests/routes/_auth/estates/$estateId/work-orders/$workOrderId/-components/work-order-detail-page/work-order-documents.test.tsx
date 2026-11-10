import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { EstateDocument } from "@/lib/documents";
import { WorkOrderDocuments } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page/work-order-documents";

const UPLOADED = /^Uploaded /u;

const document: EstateDocument = {
  id: "doc",
  estateId: "estate",
  documentType: "SERVICE_REPORT",
  originalFilename: "Pump service.pdf",
  contentType: "application/pdf",
  sizeBytes: 1234,
  createdAt: "2026-10-25T01:00:00Z",
  canDelete: false,
};
const state = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@/lib/use-mobile", () => ({ useMobile: () => true }));
vi.mock("@/lib/work-order-documents", () => ({
  useWorkOrderDocumentAccess: () => ({ canRead: true }),
  useWorkOrderDocuments: () => ({
    isPending: false,
    isError: false,
    data: { items: [document], nextCursor: null },
    refetch: vi.fn(),
  }),
}));
vi.mock("@/lib/documents", () => ({
  useDownloadDocument: () => ({
    mutate: state.mutate,
    isPending: false,
    isError: false,
  }),
}));

describe("WorkOrderDocuments on a phone", () => {
  it("lists each document with its type, size and upload date and a download action", () => {
    renderWithProviders(
      <WorkOrderDocuments estateId="estate" workOrderId="order" />
    );
    expect(screen.queryByRole("table")).toBeNull();
    const list = within(screen.getByRole("list", { name: "Documents" }));
    const item = within(list.getByRole("listitem"));
    item.getByText("Pump service.pdf");
    item.getByText("Service report · 1,234 bytes");
    item.getByText(UPLOADED);
    fireEvent.click(
      item.getByRole("button", { name: "Download Pump service.pdf" })
    );
    expect(state.mutate).toHaveBeenCalledWith(document);
  });
});
