import { renderWithProviders, screen, within } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { AssetMaintenanceSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance-section";

vi.mock("@/lib/asset-events", () => ({
  assetEventTypeLabel: { PREVENTIVE: "Preventive maintenance" },
  useAssetEvents: () => ({
    data: [
      {
        id: "manual",
        type: "PREVENTIVE",
        occurredOn: "2026-10-01",
        createdAt: "2026-10-01T08:00:00Z",
        notes: "Routine check",
        countsTowardForecast: true,
      },
    ],
    isPending: false,
  }),
  useRecordAssetEvent: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/lib/work-orders", () => ({
  useWorkOrderAccess: () => ({ canView: true }),
  useAssetWorkOrderCompletions: () => ({
    data: [
      {
        workOrderId: "order",
        reference: "OAK-W0001",
        locationPath: "Block A / L1",
        completion: {
          id: "completion",
          findings: "Worn seal",
          workPerformed: "Replaced seal",
          labourCost: "0.00",
          partsCost: null,
          totalCost: null,
          downtimeMinutes: 0,
          completedAt: "2026-10-02T09:00:00Z",
          currency: "SGD",
        },
      },
    ],
    isPending: false,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
it("shows each canonical completion once, newest first alongside manual maintenance, preserving unknown costs", () => {
  renderWithProviders(
    <AssetMaintenanceSection assetId="pump" canRecord={false} estateId="oak" />
  );
  const entries = screen.getAllByRole("listitem");
  expect(entries).toHaveLength(2);
  within(entries[0]).getByRole("link", { name: "OAK-W0001" });
  within(entries[0]).getByText("Replaced seal");
  expect(within(entries[0]).getAllByText("Unknown")).toHaveLength(2);
  within(entries[1]).getByText("Routine check");
  expect(screen.getAllByRole("link", { name: "OAK-W0001" })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Record repair" })).toBeNull();
});
