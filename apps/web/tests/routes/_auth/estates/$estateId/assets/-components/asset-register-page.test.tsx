import { fireEvent } from "@testing-library/react";
import { mockMobileViewport } from "@tests/mock-viewport";
import { chooseOption } from "@tests/test-utils";
import { type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { AssetFilters } from "@/lib/assets";
import { AssetRegisterPage } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "../../../../../../test-utils";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
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
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
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
describe("estate asset register", () => {
  it("identifies the estate by name in the asset breadcrumbs", async () => {
    vi.mocked(api.GET).mockImplementation(
      async (path) =>
        ({
          data:
            path === "/estates/{id}"
              ? { id: "estate", name: "Maple Grove", owned: true }
              : [],
          response: new Response(),
        }) as never
    );
    renderWithProviders(
      <AssetRegisterPage
        estateId="estate"
        filters={{}}
        onFiltersChange={vi.fn()}
      />
    );
    const breadcrumbs = within(
      screen.getByRole("navigation", { name: "Breadcrumbs" })
    );
    await breadcrumbs.findByRole("link", { name: "Maple Grove" });
    expect(breadcrumbs.queryByRole("link", { name: "Estate" })).toBeNull();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.GET).mockResolvedValue({
      data: [],
      response: new Response(),
    } as never);
  });
  it("shows assets as links with their current condition and location", async () => {
    vi.mocked(api.GET).mockImplementation(
      async (path) =>
        ({
          data:
            path === "/estates/{estateId}/assets"
              ? [
                  {
                    id: "a",
                    reference: "E-A0001",
                    name: "Water pump",
                    category: "PUMP",
                    locationPath: "Block A › Level 1",
                    currentCondition: "FAULTY",
                    lifecycleVersion: 0,
                  },
                ]
              : [],
          response: new Response(),
        }) as never
    );
    renderWithProviders(
      <AssetRegisterPage
        estateId="estate"
        filters={{}}
        onFiltersChange={vi.fn()}
      />
    );
    await screen.findByRole("link", { name: "Water pump" });
    screen.getByRole("cell", { name: "Faulty" });
    screen.getByRole("cell", { name: "Block A › Level 1" });
  });
  it("offers clear filters for an empty filtered register", async () => {
    const change = vi.fn();
    renderWithProviders(
      <AssetRegisterPage
        estateId="estate"
        filters={{ q: "missing", status: "INACTIVE" }}
        onFiltersChange={change}
      />
    );
    await screen.findByText("No matching assets.");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(change).toHaveBeenCalledWith({});
    await waitFor(() =>
      expect(api.GET).toHaveBeenCalledWith("/estates/{estateId}/assets", {
        params: {
          path: { estateId: "estate" },
          query: { q: "missing", status: "INACTIVE" },
        },
      })
    );
  });
  it("explains an inactive estate instead of offering asset registration", async () => {
    vi.mocked(api.GET).mockImplementation(
      async (path) =>
        ({
          data:
            path === "/estates/{id}"
              ? {
                  id: "estate",
                  owned: true,
                  deactivatedAt: "2026-10-08T00:00:00Z",
                }
              : [],
          response: new Response(),
        }) as never
    );
    renderWithProviders(
      <AssetRegisterPage
        estateId="estate"
        filters={{}}
        onFiltersChange={vi.fn()}
      />
    );
    await screen.findByText(
      "This estate is inactive. Existing assets remain available."
    );
    expect(screen.queryByRole("link", { name: "Register asset" })).toBeNull();
  });
});

function MobileRegister() {
  const [filters, setFilters] = useState<AssetFilters>({ q: "pump" });
  return (
    <AssetRegisterPage
      estateId="estate"
      filters={filters}
      onFiltersChange={setFilters}
    />
  );
}

it("shows complete mobile cards and switches to a table without refetching", async () => {
  const resize = mockMobileViewport();
  vi.mocked(api.GET).mockImplementation(
    async (path) =>
      ({
        data:
          path === "/estates/{estateId}/assets"
            ? [
                {
                  id: "a",
                  reference: "E-A0001",
                  name: "Water pump",
                  category: "PUMP",
                  locationPath: "Block A › Level 1 › Pump room",
                  currentCondition: "FAULTY",
                  lifecycleVersion: 0,
                },
              ]
            : [],
        response: new Response(),
      }) as never
  );
  renderWithProviders(
    <AssetRegisterPage
      estateId="estate"
      filters={{}}
      onFiltersChange={vi.fn()}
    />
  );
  const cards = within(await screen.findByRole("list", { name: "Assets" }));
  const card = cards.getByRole("link", { name: "Water pump (E-A0001)" });
  expect(cards.getAllByRole("link")).toHaveLength(1);
  within(card).getByText("Water pump");
  within(card).getByText("E-A0001");
  cards.getByText("Pump");
  cards.getByText("Block A › Level 1 › Pump room");
  cards.getByText("Faulty");
  cards.getByText("Active");
  expect(screen.queryByRole("table")).toBeNull();
  const calls = vi.mocked(api.GET).mock.calls.length;
  resize(false);
  await screen.findByRole("table", { name: "Assets" });
  expect(screen.queryByRole("list", { name: "Assets" })).toBeNull();
  expect(vi.mocked(api.GET).mock.calls.length).toBe(calls);
});

it("applies mobile filter drafts, discards Cancel and keeps search when clearing secondary filters", async () => {
  mockMobileViewport();
  renderWithProviders(<MobileRegister />);
  expect(screen.queryByRole("combobox", { name: "Condition" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  await screen.findByRole("dialog", { name: "Filter assets" });
  await chooseOption(
    screen.getByRole("combobox", { name: "Condition" }),
    "Faulty"
  );
  expect(api.GET).not.toHaveBeenCalledWith(
    "/estates/{estateId}/assets",
    expect.objectContaining({
      params: expect.objectContaining({
        query: expect.objectContaining({ condition: "FAULTY" }),
      }),
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  expect(
    screen.getByRole("combobox", { name: "Condition" }).textContent
  ).toContain("All conditions");
  await chooseOption(
    screen.getByRole("combobox", { name: "Condition" }),
    "Faulty"
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  screen.getByRole("button", { name: "Filters (1)" });
  await waitFor(() =>
    expect(api.GET).toHaveBeenCalledWith("/estates/{estateId}/assets", {
      params: {
        path: { estateId: "estate" },
        query: { q: "pump", condition: "FAULTY" },
      },
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "Filters (1)" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Clear secondary filters" })
  );
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  screen.getByRole("button", { name: "Filters" });
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "Search assets" })
      .value
  ).toBe("pump");
});
