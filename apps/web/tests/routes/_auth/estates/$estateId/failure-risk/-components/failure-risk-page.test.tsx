import type { components } from "@proj/api/schema";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { FailureRiskPage } from "@/routes/_auth/estates/$estateId/failure-risk/-components/failure-risk-page";
import {
  renderWithProviders,
  screen,
  within,
} from "../../../../../../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

type FailureRisk = components["schemas"]["FailureRiskResponse"];

const estate = {
  id: "estate-id",
  name: "Maple Grove",
  code: "MG-001",
  address: "1 Grove Road",
  postalCode: "123456",
  createdAt: "2026-09-25T00:00:00Z",
  updatedAt: "2026-09-25T00:00:00Z",
  owned: true,
};

const flagged: FailureRisk = {
  assetId: "a1",
  assetReference: "MG-A0001",
  assetName: "Booster pump 1",
  category: "PUMP",
  basis: "ASSET_HISTORY",
  failuresObserved: 3,
  daysSinceLastEvent: 40,
  probability30Days: 0.123,
  probability60Days: 0.256,
  probability90Days: 0.404,
  recommendedTimeframe: "WITHIN_30_DAYS",
  expectedEndOfLife: "2031-05-01",
  flagged: true,
  flagReasons: ["CONDITION", "FAILURE_RISK", "END_OF_LIFE"],
};

const unknown: FailureRisk = {
  assetId: "a2",
  assetReference: "MG-A0002",
  assetName: "Transfer pump 2",
  category: "PUMP",
  basis: "INSUFFICIENT_DATA",
  failuresObserved: 0,
  daysSinceLastEvent: null,
  probability30Days: null,
  probability60Days: null,
  probability90Days: null,
  recommendedTimeframe: null,
  expectedEndOfLife: null,
  flagged: false,
  flagReasons: [],
};

function serve(rows: FailureRisk[]) {
  vi.mocked(api.GET).mockImplementation(((path: string) =>
    Promise.resolve({
      data: path === "/estates/{estateId}/failure-risk" ? rows : estate,
      response: new Response(),
    })) as never);
}

async function rowFor(name: string) {
  const cell = await screen.findByText(name);
  const row = cell.closest("tr");
  if (!row) {
    throw new Error(`No table row for ${name}`);
  }
  return within(row);
}

describe("FailureRiskPage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("loads the estate's failure-risk list", async () => {
    serve([flagged]);
    renderWithProviders(<FailureRiskPage estateId="estate-id" />);
    await screen.findByText("Booster pump 1");
    expect(api.GET).toHaveBeenCalledWith("/estates/{estateId}/failure-risk", {
      params: { path: { estateId: "estate-id" } },
    });
  });

  it("shows whole percentages, the timeframe, end of life and flag reasons", async () => {
    serve([flagged]);
    renderWithProviders(<FailureRiskPage estateId="estate-id" />);
    const row = await rowFor("Booster pump 1");
    row.getByText("MG-A0001");
    row.getByText("12%");
    row.getByText("26%");
    row.getByText("40%");
    row.getByText("Within 30 days");
    row.getByText("2031-05-01");
    row.getByText("Condition");
    row.getByText("Failure risk");
    row.getByText("End of life");
  });

  it("says when there is not enough data to forecast", async () => {
    serve([unknown]);
    renderWithProviders(<FailureRiskPage estateId="estate-id" />);
    const row = await rowFor("Transfer pump 2");
    row.getByText("Not enough data");
    expect(row.queryByText("%")).toBeNull();
  });

  it("shows an empty state when the estate has nothing to forecast", async () => {
    serve([]);
    renderWithProviders(<FailureRiskPage estateId="estate-id" />);
    await screen.findByText(/no assets to forecast/i);
    expect(screen.queryByRole("table")).toBeNull();
  });
});
