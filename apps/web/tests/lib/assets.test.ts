import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { type Asset, assetQueryKey, useAsset } from "@/lib/assets";
import { renderWithProviders, screen, waitFor } from "../test-utils";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const at = "2026-09-27T00:00:00Z";
const asset: Asset = {
  lifecycleVersion: 0,
  id: "asset-id",
  estateId: "estate-id",
  reference: "SUNRISE-A0001",
  name: "Lift A",
  category: "LIFT",
  locationId: "a1",
  locationPath: "Blk 101 › Level 1 › Lift lobby",
  installedOn: "2020-05-01",
  manufacturer: "Otis",
  model: "Gen2",
  serialNumber: "SN-123",
  createdAt: at,
  updatedAt: at,
};

// Module scope: never define a component inside another component.
function AssetProbe({
  estateId,
  assetId,
}: {
  estateId: string;
  assetId: string;
}) {
  const query = useAsset(estateId, assetId);
  if (query.error) {
    return createElement("p", { role: "alert" }, query.error.message);
  }
  return query.data ? createElement("h1", null, query.data.name) : null;
}

describe("asset query keys", () => {
  it("scope an asset to the signed-in user and its estate", () => {
    expect(assetQueryKey("owner", "estate-id", "asset-id")).toEqual([
      "estates",
      "owner",
      "assets",
      "estate-id",
      "asset-id",
    ]);
  });

  it("do not let two users share a cached asset", () => {
    expect(assetQueryKey("owner", "estate-id", "asset-id")).not.toEqual(
      assetQueryKey("someone-else", "estate-id", "asset-id")
    );
  });
});

describe("useAsset", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the asset from its estate and caches it under the user's key", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: asset,
      response: new Response(),
    } as never);
    const { queryClient } = renderWithProviders(
      createElement(AssetProbe, { estateId: "estate-id", assetId: "asset-id" })
    );
    await screen.findByRole("heading", { name: "Lift A" });
    expect(api.GET).toHaveBeenCalledWith("/estates/{estateId}/assets/{id}", {
      params: { path: { estateId: "estate-id", id: "asset-id" } },
    });
    expect(
      queryClient.getQueryData([
        "estates",
        "owner",
        "assets",
        "estate-id",
        "asset-id",
      ])
    ).toEqual(asset);
  });

  it("throws the server's message when the request fails", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "Asset not found." },
      response: new Response(null, { status: 404 }),
    } as never);
    const { queryClient } = renderWithProviders(
      createElement(AssetProbe, { estateId: "estate-id", assetId: "asset-id" })
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Asset not found."
    );
    await waitFor(() =>
      expect(
        queryClient.getQueryData(
          assetQueryKey("owner", "estate-id", "asset-id")
        )
      ).toBeUndefined()
    );
  });

  it("explains a rejected sign-in rather than failing silently", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: undefined,
      response: new Response(null, { status: 401 }),
    } as never);
    renderWithProviders(
      createElement(AssetProbe, { estateId: "estate-id", assetId: "asset-id" })
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "could not verify"
    );
  });
});
