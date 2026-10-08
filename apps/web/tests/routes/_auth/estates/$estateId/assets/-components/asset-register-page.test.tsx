import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { AssetRegisterPage } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page";
import {
  renderWithProviders,
  screen,
  waitFor,
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
});
