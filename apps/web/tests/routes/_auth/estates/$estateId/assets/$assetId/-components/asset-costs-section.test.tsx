import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { AssetCostsSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-costs-section";

const UNKNOWN_COSTS = /unknown costs/;

function manual(overrides: Record<string, unknown>) {
  return {
    id: "manual",
    type: "BREAKDOWN_REPAIR",
    occurredOn: "2026-10-01",
    createdAt: "2026-10-01T08:00:00Z",
    notes: "Fixed",
    countsTowardForecast: true,
    labourCost: "0.10",
    partsCost: "0.20",
    otherCost: "0.00",
    totalCost: "0.30",
    ...overrides,
  };
}
function work(overrides: Record<string, unknown>) {
  return {
    workOrderId: "order",
    reference: "OAK-W0001",
    locationPath: "Block A / L1",
    completion: {
      id: "completion",
      findings: "Worn seal",
      workPerformed: "Replaced seal",
      labourCost: "100.00",
      partsCost: "50.00",
      totalCost: "150.00",
      completedAt: "2026-10-05T04:00:00Z",
      currency: "SGD",
      ...overrides,
    },
  };
}

const state = vi.hoisted(() => ({
  events: [] as unknown[],
  completions: [] as unknown[],
}));

beforeEach(() => {
  state.events = [manual({})];
  state.completions = [work({})];
});

vi.mock("@/lib/asset-events", () => ({
  assetEventTypeLabel: {
    BREAKDOWN_REPAIR: "Breakdown repair",
    PREVENTIVE: "Preventive maintenance",
  },
  useAssetEvents: () => ({ data: state.events, isPending: false }),
}));
vi.mock("@/lib/work-orders", () => ({
  useWorkOrderAccess: () => ({ canView: true }),
  useAssetWorkOrderCompletions: () => ({
    data: state.completions,
    isPending: false,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

function renderSection() {
  renderWithProviders(<AssetCostsSection assetId="pump" estateId="oak" />);
  return within(screen.getByRole("region", { name: "Maintenance costs" }));
}
function cells(row: HTMLElement) {
  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}
function bodyRows(section: ReturnType<typeof renderSection>) {
  const [, body] = section.getAllByRole("rowgroup");
  return within(body).queryAllByRole("row");
}
function totalsRow(section: ReturnType<typeof renderSection>) {
  const [, , footer] = section.getAllByRole("rowgroup");
  return within(footer).getByRole("row");
}

it("lists manual and work-order costs newest first, once each", () => {
  const section = renderSection();
  const rows = bodyRows(section);
  expect(rows).toHaveLength(2);
  within(rows[0]).getByRole("link", { name: "OAK-W0001" });
  expect(cells(rows[0]).slice(2)).toEqual([
    "100.00",
    "50.00",
    "Not applicable",
    "150.00",
  ]);
  expect(cells(rows[1])).toEqual([
    "2026-10-01",
    "Breakdown repair",
    "0.10",
    "0.20",
    "0.00",
    "0.30",
  ]);
});

it("totals every column exactly", () => {
  const section = renderSection();
  const totals = totalsRow(section);
  within(totals).getByRole("rowheader", { name: "Total" });
  expect(cells(totals)).toEqual(["100.10", "50.20", "0.00", "150.30"]);
  expect(section.queryByText(UNKNOWN_COSTS)).toBeNull();
});

it("shows unknown costs apart from zero and totals only the known ones", () => {
  state.events = [
    manual({ partsCost: null, totalCost: null }),
    manual({
      id: "older",
      occurredOn: "2026-09-01",
      labourCost: null,
      partsCost: null,
      otherCost: null,
      totalCost: null,
    }),
  ];
  state.completions = [];
  const section = renderSection();
  const [first, second] = bodyRows(section);
  expect(cells(first).slice(2)).toEqual(["0.10", "Unknown", "0.00", "Unknown"]);
  expect(cells(second).slice(2)).toEqual([
    "Unknown",
    "Unknown",
    "Unknown",
    "Unknown",
  ]);
  const totals = totalsRow(section);
  within(totals).getByRole("rowheader", { name: "Known costs" });
  expect(cells(totals)).toEqual(["0.10", "0.00", "0.00", "0.10"]);
  section.getByText(
    "2 entries have unknown costs, not included in the totals."
  );
});

it("limits the rows and totals to the chosen dates, inclusive", () => {
  state.events = [
    manual({}),
    manual({ id: "older", occurredOn: "2026-09-01", labourCost: "5.00" }),
  ];
  const section = renderSection();
  fireEvent.change(section.getByLabelText("From"), {
    target: { value: "2026-10-01" },
  });
  fireEvent.change(section.getByLabelText("To"), {
    target: { value: "2026-10-01" },
  });
  const rows = bodyRows(section);
  expect(rows).toHaveLength(1);
  expect(cells(rows[0])[0]).toBe("2026-10-01");
  expect(cells(totalsRow(section))).toEqual(["0.10", "0.20", "0.00", "0.30"]);
});

it("explains an empty period and a reversed range", () => {
  const section = renderSection();
  fireEvent.change(section.getByLabelText("From"), {
    target: { value: "2027-01-01" },
  });
  section.getByText("No maintenance costs in this period.");
  fireEvent.change(section.getByLabelText("To"), {
    target: { value: "2026-12-31" },
  });
  expect(section.getByRole("alert").textContent).toBe(
    "The start date must be on or before the end date."
  );
  expect(section.queryByRole("table")).toBeNull();
});
