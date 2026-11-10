import { mockMobileViewport } from "@tests/mock-viewport";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { CostTable } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-costs-section/cost-table";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params: _params,
    ...props
  }: {
    children: ReactNode;
    params?: unknown;
    to: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const WORK_ORDER = /OAK-W0001/u;

beforeEach(() => {
  mockMobileViewport();
});

const rows = [
  {
    id: "m1",
    at: "2026-10-01",
    date: "1 Oct 2026",
    label: "Breakdown repair",
    labour: "10.00",
    parts: null,
    other: "5.00",
    total: null,
  },
  {
    id: "w1",
    at: "2026-10-05",
    date: "5 Oct 2026",
    label: "OAK-W0001",
    labour: "100.00",
    parts: "50.00",
    total: "150.00",
    workOrder: { id: "order", reference: "OAK-W0001" },
  },
];

it("lists cost entries on phones with the total emphasised and work orders linked", () => {
  renderWithProviders(<CostTable canView estateId="e" rows={rows} />);
  expect(screen.queryByRole("table")).toBeNull();
  const list = within(screen.getByRole("list", { name: "Cost entries" }));
  const [manualItem, workItem] = list.getAllByRole("listitem");
  const manual = within(manualItem);
  manual.getByText("Breakdown repair");
  manual.getByText("1 Oct 2026");
  manual.getByText("Unknown");
  const work = within(workItem);
  const link = work.getByRole("link", { name: WORK_ORDER });
  within(link).getByText("150.00");
  within(link).getByText("5 Oct 2026");
});

it("does not link work orders the viewer cannot open", () => {
  renderWithProviders(<CostTable canView={false} estateId="e" rows={rows} />);
  expect(screen.queryByRole("link")).toBeNull();
});
