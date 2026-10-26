import { renderWithProviders, screen, within } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { AssetMaintenanceSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance-section";

const routineCheck = {
  id: "manual",
  type: "PREVENTIVE",
  occurredOn: "2026-10-01",
  createdAt: "2026-10-01T08:00:00Z",
  notes: "Routine check",
  countsTowardForecast: true,
};
const state = vi.hoisted(() => ({ events: [] as unknown[] }));

beforeEach(() => {
  state.events = [routineCheck];
});

vi.mock("@/lib/asset-events", () => ({
  assetEventTypeLabel: {
    BREAKDOWN_REPAIR: "Breakdown repair",
    PREVENTIVE: "Preventive maintenance",
  },
  useAssetEvents: () => ({ data: state.events, isPending: false }),
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

it("labels manual entries apart from work-order entries", () => {
  renderWithProviders(
    <AssetMaintenanceSection assetId="pump" canRecord={false} estateId="oak" />
  );
  const [work, manual] = screen.getAllByRole("listitem");
  within(work).getByText("Work order");
  expect(within(work).queryByText("Manual entry")).toBeNull();
  within(manual).getByText("Manual entry");
  expect(within(manual).queryByText("Work order")).toBeNull();
});

it("shows a manual entry's known maintenance details and omits unknown ones", () => {
  state.events = [
    {
      ...routineCheck,
      id: "repair",
      type: "BREAKDOWN_REPAIR",
      occurredOn: "2026-10-03",
      notes: "Pump tripped",
      findings: "Seal worn",
      workPerformed: "Replaced the seal",
      serviceProvider: "Acme Pumps",
      partsReplaced: null,
      downtimeMinutes: 0,
    },
    routineCheck,
  ];
  renderWithProviders(
    <AssetMaintenanceSection assetId="pump" canRecord={false} estateId="oak" />
  );
  const [repair, , check] = screen.getAllByRole("listitem");
  const details = within(repair);
  const value = (term: string) =>
    details.getByText(term).nextElementSibling?.textContent;
  expect(value("Findings")).toBe("Seal worn");
  expect(value("Work performed")).toBe("Replaced the seal");
  expect(value("Service provider")).toBe("Acme Pumps");
  expect(value("Downtime (minutes)")).toBe("0");
  expect(details.queryByText("Parts replaced")).toBeNull();
  expect(within(check).queryByText("Findings")).toBeNull();
  expect(within(check).queryByText("Downtime (minutes)")).toBeNull();
});
