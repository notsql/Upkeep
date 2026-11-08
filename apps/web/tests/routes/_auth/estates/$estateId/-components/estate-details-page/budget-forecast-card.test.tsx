import { renderWithProviders, screen, within } from "@tests/test-utils";
import { beforeEach, it, vi } from "vitest";
import { BudgetForecastCard } from "@/routes/_auth/estates/$estateId/-components/estate-details-page/budget-forecast-card";

const state = vi.hoisted(() => ({ data: undefined as unknown }));

beforeEach(() => {
  state.data = {
    from: "2026-11-08",
    to: "2027-11-08",
    total: "18300.00",
    scheduledServices: { total: "12000.00", services: 14 },
    predictedRepairs: { total: "6300.00", expectedRepairs: 1.6 },
    assetsWithoutCostBasis: 3,
  };
});

vi.mock("@/lib/estate-costs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/estate-costs")>()),
  useBudgetForecast: () => ({ data: state.data, error: null }),
}));

function card() {
  return within(screen.getByRole("region", { name: "Maintenance budget" }));
}

it("shows the projected total, window and its two parts", () => {
  renderWithProviders(<BudgetForecastCard estateId="e-1" />);
  card().getByText("S$18,300.00");
  card().getByText("Next 12 months: 8 Nov 2026 – 7 Nov 2027");
  card().getByText("Scheduled services: S$12,000.00 (14 services)");
  card().getByText("Predicted repairs: S$6,300.00 (1.6 expected repairs)");
  card().getByText("3 assets left out: no cost history to estimate from");
});

it("says when there is nothing to project", () => {
  state.data = {
    from: "2026-11-08",
    to: "2027-11-08",
    total: "0.00",
    scheduledServices: { total: "0.00", services: 0 },
    predictedRepairs: { total: "0.00", expectedRepairs: 0 },
    assetsWithoutCostBasis: 0,
  };
  renderWithProviders(<BudgetForecastCard estateId="e-1" />);
  card().getByText("S$0.00");
  card().getByText("No services or repairs to project.");
});

it("uses the singular for one service, one repair and one asset", () => {
  state.data = {
    from: "2026-11-08",
    to: "2027-11-08",
    total: "150.00",
    scheduledServices: { total: "100.00", services: 1 },
    predictedRepairs: { total: "50.00", expectedRepairs: 1 },
    assetsWithoutCostBasis: 1,
  };
  renderWithProviders(<BudgetForecastCard estateId="e-1" />);
  card().getByText("Scheduled services: S$100.00 (1 service)");
  card().getByText("Predicted repairs: S$50.00 (1 expected repair)");
  card().getByText("1 asset left out: no cost history to estimate from");
});
