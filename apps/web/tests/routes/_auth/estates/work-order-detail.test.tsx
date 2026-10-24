import { renderWithProviders, screen } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkOrderDetailPage } from "@/routes/_auth/estates/$estateId/work-orders/$workOrderId/-components/work-order-detail-page";

const state = vi.hoisted(() => ({
  access: {
    canView: true,
    canCreate: false,
    canReadReports: false,
    canViewAssets: false,
    pending: false,
    estateName: "Oak",
  },
  error: false,
  creatorName: "Alex Tan" as string | undefined,
}));
vi.mock("@/lib/work-orders", () => ({
  useWorkOrderAccess: () => state.access,
  useWorkOrder: () => ({
    isError: state.error,
    data: {
      id: "order",
      reference: "OAK-W0001",
      description: "Repair pump",
      locationPath: "Block A / L1",
      assetId: "pump",
      assetReference: "OAK-A0001",
      category: "EQUIPMENT_FAULT",
      priority: "HIGH",
      source: "RESIDENT_REPORT",
      sourceReportId: "report",
      status: "OPEN",
      createdAt: "2026-10-22T00:00:00Z",
      createdByUserId: "manager",
      createdByName: state.creatorName,
    },
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
beforeEach(() => {
  state.access.canView = true;
  state.access.canReadReports = false;
  state.access.canViewAssets = false;
  state.error = false;
  state.creatorName = "Alex Tan";
});
it("shows the creator's display name instead of their internal ID", () => {
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  screen.getByText("Alex Tan");
  expect(screen.queryByText("manager")).toBeNull();
});
it("uses a readable fallback when the creator name is unavailable", () => {
  state.creatorName = undefined;
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  screen.getByText("Name unavailable");
  expect(screen.queryByText("manager")).toBeNull();
});
it("shows Crew the saved asset reference without an owner-only asset link", () => {
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  screen.getByText("OAK-A0001");
  screen.getByText("Block A / L1");
  expect(screen.queryByRole("link", { name: "OAK-A0001" })).toBeNull();
  expect(screen.queryByRole("link", { name: "View source report" })).toBeNull();
});
it("links source reports only for independent report readers", () => {
  state.access.canReadReports = true;
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  screen.getByRole("link", { name: "View source report" });
});
it("hides cached work-order content after access is revoked", () => {
  state.access.canView = false;
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  expect(screen.queryByText("Repair pump")).toBeNull();
  screen.getByRole("alert");
});
it("hides cached work-order content when refetching fails", () => {
  state.error = true;
  renderWithProviders(
    <WorkOrderDetailPage estateId="oak" workOrderId="order" />
  );
  expect(screen.queryByText("Repair pump")).toBeNull();
  screen.getByRole("alert");
});
