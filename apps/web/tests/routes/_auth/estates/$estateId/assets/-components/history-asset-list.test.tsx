import { fireEvent } from "@testing-library/react";
import { historyAsset } from "@tests/fixtures/asset-history";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { HistoryAssetList } from "@/routes/_auth/estates/$estateId/assets/-components/history-asset-list";
import { AssetDetailsNav } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-details-nav";

vi.mock("@/lib/access", () => ({
  useAuthenticatedSession: () => ({ userId: "council", ready: true }),
  useAppAccess: () => ({
    isPending: false,
    isError: false,
    data: { estates: [{ estateId: "estate", canViewAssetHistory: true }] },
  }),
}));
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
// AssetDetailsNav reads ownership for the Devices badge; History readers have none.
vi.mock("@/lib/estates", () => ({
  useEstate: () => ({ data: undefined }),
  useEstateSession: () => ({ userId: "council", ready: true }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    children,
  }: {
    to: string;
    params?: { estateId?: string; assetId?: string };
    children: ReactNode;
  }) => (
    <a
      href={to
        .replace("$estateId", params?.estateId ?? "")
        .replace("$assetId", params?.assetId ?? "")}
    >
      {children}
    </a>
  ),
}));

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  vi.mocked(api.GET).mockResolvedValue({
    data: { items: [historyAsset], nextCursor: "next" },
    response: new Response(),
  } as never);
});

it("lets Council readers browse assets without owner queries or management actions", async () => {
  renderWithProviders(
    <HistoryAssetList
      estateId="estate"
      filters={{}}
      onFiltersChange={vi.fn()}
    />
  );
  const link = await screen.findByRole("link", { name: "Water pump" });
  expect(link.getAttribute("href")).toBe("/estates/estate/assets/pump");
  screen.getByRole("cell", { name: "E-A0001" });
  screen.getByRole("cell", { name: "Block A › Pump room" });
  expect(screen.queryByRole("link", { name: "Create" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Retire" })).toBeNull();
  expect(api.GET).not.toHaveBeenCalledWith(
    "/estates/{estateId}/assets",
    expect.anything()
  );
});

it("debounces search and clears the page cursor while preserving status", async () => {
  const change = vi.fn();
  renderWithProviders(
    <HistoryAssetList
      estateId="estate"
      filters={{ q: "old", status: "INACTIVE", cursor: "old-page" }}
      onFiltersChange={change}
    />
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Search assets" }), {
    target: { value: "% pump" },
  });
  await waitFor(() =>
    expect(change).toHaveBeenCalledWith({ q: "% pump", status: "INACTIVE" })
  );
});

it("preserves search and status in pagination and restores search from URL state", async () => {
  const change = vi.fn();
  const view = renderWithProviders(
    <HistoryAssetList
      estateId="estate"
      filters={{ q: "pump", status: "ALL" }}
      onFiltersChange={change}
    />
  );
  fireEvent.click(await screen.findByRole("button", { name: "Next page" }));
  expect(change).toHaveBeenCalledWith({
    q: "pump",
    status: "ALL",
    cursor: "next",
  });
  view.rerender(
    <HistoryAssetList
      estateId="estate"
      filters={{ q: "lift", status: "ALL" }}
      onFiltersChange={change}
    />
  );
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Search assets" })
        .value
    ).toBe("lift")
  );
  view.rerender(
    <HistoryAssetList
      estateId="estate"
      filters={{ q: "pump", status: "ALL" }}
      onFiltersChange={change}
    />
  );
  await waitFor(() =>
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Search assets" })
        .value
    ).toBe("pump")
  );
});

it.each([
  [{}, "No assets yet"],
  [{ q: "missing" }, "No matching assets"],
])(
  "distinguishes an empty estate from empty search results",
  async (filters, message) => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { items: [], nextCursor: null },
      response: new Response(),
    } as never);
    renderWithProviders(
      <HistoryAssetList
        estateId="estate"
        filters={filters}
        onFiltersChange={vi.fn()}
      />
    );
    await screen.findByText(message);
  }
);

it("shows a retriable list failure instead of an empty estate", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    error: { message: "Assets unavailable" },
    response: new Response(null, { status: 500 }),
  } as never);
  renderWithProviders(
    <HistoryAssetList
      estateId="estate"
      filters={{}}
      onFiltersChange={vi.fn()}
    />
  );
  await screen.findByRole("alert");
  screen.getByRole("button", { name: "Retry" });
  expect(screen.queryByText("No assets yet")).toBeNull();
});

it("adds History alongside existing owner sections", () => {
  renderWithProviders(<AssetDetailsNav assetId="pump" estateId="estate" />);
  expect(
    screen.getByRole("link", { name: "History" }).getAttribute("href")
  ).toBe("/estates/estate/assets/pump/history");
  screen.getByRole("link", { name: "Records" });
});
