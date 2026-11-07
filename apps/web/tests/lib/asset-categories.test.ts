import { createElement, useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import {
  estateAssetCategoriesQueryKey,
  useEstateAssetCategories,
  useSetSilentFailure,
} from "@/lib/asset-categories";
import { renderWithProviders, screen, waitFor } from "../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), PUT: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
}));

const listing = { estateActive: true, categories: [] };

function List() {
  const categories = useEstateAssetCategories("estate-id");
  return categories.data
    ? createElement(
        "output",
        null,
        `${categories.data.categories.length} categories`
      )
    : null;
}

function Flag() {
  const set = useSetSilentFailure("estate-id");
  const { mutate } = set;
  useEffect(() => {
    mutate({ category: "PUMP", failsSilently: true });
  }, [mutate]);
  return set.error ? createElement("output", null, set.error.message) : null;
}

describe("asset category hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.GET).mockResolvedValue({
      data: listing,
      response: new Response(),
    } as never);
  });

  it("loads the estate's categories under the user's key", async () => {
    const { queryClient } = renderWithProviders(createElement(List));
    await screen.findByText("0 categories");
    expect(
      queryClient.getQueryCache().find({
        queryKey: estateAssetCategoriesQueryKey("manager", "estate-id"),
      })
    ).toBeDefined();
  });

  it("puts the flag and refreshes the estate's categories", async () => {
    vi.mocked(api.PUT).mockResolvedValue({
      data: { code: "PUMP" },
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(createElement(Flag));
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(
        "/estates/{estateId}/asset-categories/{category}/silent-failure",
        {
          params: { path: { estateId: "estate-id", category: "PUMP" } },
          body: { failsSilently: true },
        }
      )
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: estateAssetCategoriesQueryKey("manager", "estate-id"),
      })
    );
  });

  it("turns a refused change into an error", async () => {
    vi.mocked(api.PUT).mockResolvedValue({
      error: { message: "This estate is inactive." },
      response: new Response(null, { status: 409 }),
    } as never);
    renderWithProviders(createElement(Flag));
    await screen.findByText("This estate is inactive.");
  });
});
