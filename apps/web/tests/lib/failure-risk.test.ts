import type { components } from "@proj/api/schema";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  assetFailureRiskQueryKey,
  estateFailureRiskQueryKey,
  useAssetFailureRisk,
  useEstateFailureRisk,
} from "@/lib/failure-risk";
import { renderWithProviders, screen } from "../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

type FailureRisk = components["schemas"]["FailureRiskResponse"];

const risk: FailureRisk = {
  assetId: "asset-id",
  assetReference: "MG-A0001",
  assetName: "Booster pump 1",
  category: "PUMP",
  basis: "ASSET_HISTORY",
  failuresObserved: 2,
  daysSinceLastEvent: 40,
  probability30Days: 0.12,
  probability60Days: 0.25,
  probability90Days: 0.4,
  recommendedTimeframe: "WITHIN_60_DAYS",
  expectedEndOfLife: "2031-05-01",
  flagged: true,
  flagReasons: ["FAILURE_RISK"],
};

function AssetRiskProbe() {
  const query = useAssetFailureRisk("estate-id", "asset-id");
  if (query.error) {
    return createElement("p", { role: "alert" }, query.error.message);
  }
  return query.data ? createElement("h1", null, query.data.assetName) : null;
}

function EstateRiskProbe() {
  const query = useEstateFailureRisk("estate-id");
  if (query.error) {
    return createElement("p", { role: "alert" }, query.error.message);
  }
  return createElement(
    "ul",
    null,
    query.data?.map((row) =>
      createElement("li", { key: row.assetId }, row.assetName)
    )
  );
}

describe("failure-risk query keys", () => {
  it("scope an asset's forecast to the user, estate and asset", () => {
    const key = assetFailureRiskQueryKey("owner", "estate-id", "asset-id");
    expect(key).toContain("owner");
    expect(key).toContain("estate-id");
    expect(key).toContain("asset-id");
  });

  it("scope the estate's list to the user and estate", () => {
    const key = estateFailureRiskQueryKey("owner", "estate-id");
    expect(key).toContain("owner");
    expect(key).toContain("estate-id");
  });

  it("do not let two users share cached forecasts", () => {
    expect(estateFailureRiskQueryKey("owner", "estate-id")).not.toEqual(
      estateFailureRiskQueryKey("someone-else", "estate-id")
    );
    expect(
      assetFailureRiskQueryKey("owner", "estate-id", "asset-id")
    ).not.toEqual(
      assetFailureRiskQueryKey("someone-else", "estate-id", "asset-id")
    );
  });
});

describe("useAssetFailureRisk", () => {
  beforeEach(() => vi.resetAllMocks());

  it("loads the asset's forecast under the user's key", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: risk,
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(AssetRiskProbe));
    await screen.findByRole("heading", { name: "Booster pump 1" });
    expect(api.GET).toHaveBeenCalledWith(
      "/estates/{estateId}/assets/{assetId}/failure-risk",
      { params: { path: { estateId: "estate-id", assetId: "asset-id" } } }
    );
    expect(
      queryClient.getQueryData(
        assetFailureRiskQueryKey("owner", "estate-id", "asset-id")
      )
    ).toEqual(risk);
  });

  it("throws the server's message when the request fails", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "Asset not found." },
      response: new Response(null, { status: 404 }),
    } as never);
    renderWithProviders(createElement(AssetRiskProbe));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Asset not found."
    );
  });
});

describe("useEstateFailureRisk", () => {
  beforeEach(() => vi.resetAllMocks());

  it("loads the estate's list under the user's key", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [risk],
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(EstateRiskProbe));
    await screen.findByText("Booster pump 1");
    expect(api.GET).toHaveBeenCalledWith("/estates/{estateId}/failure-risk", {
      params: { path: { estateId: "estate-id" } },
    });
    expect(
      queryClient.getQueryData(estateFailureRiskQueryKey("owner", "estate-id"))
    ).toEqual([risk]);
  });

  it("throws the server's message when the request fails", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "Estate not found." },
      response: new Response(null, { status: 404 }),
    } as never);
    renderWithProviders(createElement(EstateRiskProbe));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Estate not found."
    );
  });
});
