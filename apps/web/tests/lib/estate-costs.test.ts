import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  budgetForecastQueryKey,
  costliestAssetsQueryKey,
  formatSgd,
  useBudgetForecast,
  useCostliestAssets,
} from "@/lib/estate-costs";
import { renderWithProviders, screen } from "../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

function Top() {
  const top = useCostliestAssets("e-1");
  return top.data
    ? createElement("output", null, String(top.data.length))
    : null;
}

function Forecast() {
  const forecast = useBudgetForecast("e-1");
  return forecast.data
    ? createElement("output", null, forecast.data.total)
    : null;
}

function Failing() {
  const top = useCostliestAssets("e-1");
  return top.error ? createElement("output", null, top.error.message) : null;
}

describe("estate cost hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the costliest assets under the user's key", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [{ assetId: "a" }, { assetId: "b" }],
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(Top));
    await screen.findByText("2");
    expect(api.GET).toHaveBeenCalledWith(
      "/estates/{estateId}/costs/top-assets",
      {
        params: { path: { estateId: "e-1" } },
      }
    );
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: costliestAssetsQueryKey("owner", "e-1") })
    ).toBeDefined();
  });

  it("loads the budget forecast under the user's key", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { total: "18300.00" },
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(Forecast));
    await screen.findByText("18300.00");
    expect(api.GET).toHaveBeenCalledWith("/estates/{estateId}/costs/forecast", {
      params: { path: { estateId: "e-1" } },
    });
    expect(
      queryClient
        .getQueryCache()
        .find({ queryKey: budgetForecastQueryKey("owner", "e-1") })
    ).toBeDefined();
  });

  it("turns a refused load into an error", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "Estate not found." },
      response: new Response(null, { status: 404 }),
    } as never);
    renderWithProviders(createElement(Failing));
    await screen.findByText("Estate not found.");
  });
});

describe("formatSgd", () => {
  it.each([
    ["0.00", "S$0.00"],
    ["12480.00", "S$12,480.00"],
    ["1000000000000.30", "S$1,000,000,000,000.30"],
  ])("formats %s as %s", (amount, text) => {
    expect(formatSgd(amount)).toBe(text);
  });
});
