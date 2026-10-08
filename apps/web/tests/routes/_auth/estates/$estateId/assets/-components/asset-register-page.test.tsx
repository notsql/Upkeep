import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
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
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
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
