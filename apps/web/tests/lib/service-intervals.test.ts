import { createElement, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { estateAssetCategoriesQueryKey } from "@/lib/asset-categories";
import {
  assetServiceIntervalQueryKey,
  formatInterval,
  type ServiceInterval,
  useAssetServiceInterval,
  useSetAssetServiceInterval,
  useSetCategoryServiceInterval,
} from "@/lib/service-intervals";
import { renderWithProviders, screen, waitFor } from "../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PUT: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
}));

function AssetInterval() {
  const interval = useAssetServiceInterval("estate-id", "asset-id");
  return interval.data
    ? createElement("output", null, interval.data.source)
    : null;
}

function SetCategory() {
  const set = useSetCategoryServiceInterval("estate-id");
  const { mutate } = set;
  useEffect(() => {
    mutate({ category: "PUMP", interval: { value: 6, unit: "MONTH" } });
  }, [mutate]);
  return set.error ? createElement("output", null, set.error.message) : null;
}

function SetAsset({ interval }: { interval: ServiceInterval | null }) {
  const set = useSetAssetServiceInterval("estate-id", "asset-id");
  const { mutate } = set;
  useEffect(() => {
    mutate(interval);
  }, [mutate, interval]);
  return set.error ? createElement("output", null, set.error.message) : null;
}

describe("service interval hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads an asset's interval under the user's key", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { source: "CATEGORY" },
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(AssetInterval));
    await screen.findByText("CATEGORY");
    expect(api.GET).toHaveBeenCalledWith(
      "/estates/{estateId}/assets/{assetId}/service-interval",
      { params: { path: { estateId: "estate-id", assetId: "asset-id" } } }
    );
    expect(
      queryClient.getQueryCache().find({
        queryKey: assetServiceIntervalQueryKey(
          "manager",
          "estate-id",
          "asset-id"
        ),
      })
    ).toBeDefined();
  });

  it("puts a category's interval and refreshes the estate's categories", async () => {
    vi.mocked(api.PUT).mockResolvedValue({
      data: { code: "PUMP" },
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(SetCategory));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(
        "/estates/{estateId}/asset-categories/{category}/service-interval",
        {
          params: { path: { estateId: "estate-id", category: "PUMP" } },
          body: { interval: { value: 6, unit: "MONTH" } },
        }
      )
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: estateAssetCategoriesQueryKey("manager", "estate-id"),
      })
    );
  });

  it("puts or clears an asset's override and refreshes its interval", async () => {
    vi.mocked(api.PUT).mockResolvedValue({
      data: { source: "CATEGORY" },
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(
      createElement(SetAsset, { interval: null })
    );
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(
        "/estates/{estateId}/assets/{assetId}/service-interval",
        {
          params: { path: { estateId: "estate-id", assetId: "asset-id" } },
          body: { interval: null },
        }
      )
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: assetServiceIntervalQueryKey(
          "manager",
          "estate-id",
          "asset-id"
        ),
      })
    );
  });

  it("turns a refused change into an error", async () => {
    vi.mocked(api.PUT).mockResolvedValue({
      error: { message: "This asset is retired." },
      response: new Response(null, { status: 409 }),
    } as never);
    renderWithProviders(
      createElement(SetAsset, { interval: { value: 3, unit: "MONTH" } })
    );
    await screen.findByText("This asset is retired.");
  });
});

describe("formatInterval", () => {
  it.each([
    [{ value: 1, unit: "DAY" }, "Every 1 day"],
    [{ value: 14, unit: "DAY" }, "Every 14 days"],
    [{ value: 1, unit: "MONTH" }, "Every 1 month"],
    [{ value: 6, unit: "MONTH" }, "Every 6 months"],
    [{ value: 1, unit: "YEAR" }, "Every 1 year"],
    [{ value: 2, unit: "YEAR" }, "Every 2 years"],
    [null, "Not set"],
    [undefined, "Not set"],
  ] as const)("formats %o as %s", (interval, text) => {
    expect(formatInterval(interval)).toBe(text);
  });
});
