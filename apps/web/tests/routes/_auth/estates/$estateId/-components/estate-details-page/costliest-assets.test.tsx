import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { CostliestAssets } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/costliest-assets";

const P1 = /P-1/u;
const UNKNOWN = /unknown costs/u;

const state = vi.hoisted(() => ({ data: undefined as unknown }));

beforeEach(() => {
  state.data = [
    {
      assetId: "a-1",
      assetReference: "P-1",
      assetName: "Booster pump",
      category: "PUMP",
      categoryLabel: "Pump",
      totalSpend: "12480.00",
      entriesWithUnknownCosts: 2,
    },
    {
      assetId: "a-2",
      assetReference: "L-1",
      assetName: "Lift A",
      category: "LIFT",
      categoryLabel: "Lift",
      totalSpend: "950.50",
      entriesWithUnknownCosts: 0,
    },
  ];
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { estateId: string; assetId?: string };
  }) => (
    <a
      href={to
        .replace("$estateId", params?.estateId ?? "")
        .replace("$assetId", params?.assetId ?? "")}
      {...props}
    >
      {children}
    </a>
  ),
}));
vi.mock("@/lib/estate-costs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/estate-costs")>()),
  useCostliestAssets: () => ({ data: state.data, error: null }),
}));

function card() {
  return within(screen.getByRole("region", { name: "Costliest assets" }));
}

it("ranks assets by spend and links to their cost history", () => {
  renderWithProviders(<CostliestAssets estateId="e-1" />);
  const [first, second] = card().getAllByRole("listitem");
  const top = within(first);
  expect(top.getByRole("link", { name: P1 }).getAttribute("href")).toBe(
    "/estates/e-1/assets/a-1/costs"
  );
  top.getByText("Booster pump · Pump");
  top.getByText("S$12,480.00");
  top.getByText("2 entries with unknown costs");
  within(second).getByText("S$950.50");
  expect(within(second).queryByText(UNKNOWN)).toBeNull();
});

it("says when no costs are recorded", () => {
  state.data = [];
  renderWithProviders(<CostliestAssets estateId="e-1" />);
  card().getByText("No maintenance costs recorded yet.");
});
