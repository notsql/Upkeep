import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent } from "@testing-library/react";
import { mockMobileViewport } from "@tests/mock-viewport";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { AssetRegisterPage } from "@/routes/_auth/estates/$estateId/assets/-components/asset-register-page";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
const keepFilters = vi.fn();
function Register() {
  return (
    <AssetRegisterPage
      estateId="estate"
      filters={{ status: "ALL" }}
      onFiltersChange={keepFilters}
    />
  );
}
function Details() {
  return <h1>Water pump details</h1>;
}
beforeEach(() => {
  mockMobileViewport();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.mocked(api.GET).mockImplementation((path) => {
    if (path === "/estates/{estateId}/assets") {
      return Promise.resolve({
        data: [
          {
            id: "pump",
            reference: "E-A0001",
            name: "Water pump",
            category: "PUMP",
            locationPath: "Block A › Level 1 › Pump room",
            currentCondition: "FAULTY",
            lifecycleVersion: 0,
          },
        ],
        response: new Response(),
      } as never);
    }
    if (path === "/asset-categories") {
      return Promise.resolve({
        data: [{ code: "PUMP", label: "Pump" }],
        response: new Response(),
      } as never);
    }
    return Promise.resolve({
      data:
        path === "/estates/{id}"
          ? { id: "estate", name: "Maple Grove", owned: true }
          : [],
      response: new Response(),
    } as never);
  });
});

it("opens asset details by tapping the location within a single whole-card link", async () => {
  const root = createRootRoute();
  const register = createRoute({
    getParentRoute: () => root,
    path: "/estates/$estateId/assets",
    component: Register,
  });
  const details = createRoute({
    getParentRoute: () => root,
    path: "/estates/$estateId/assets/$assetId",
    component: Details,
  });
  const router = createRouter({
    routeTree: root.addChildren([register, details]),
    history: createMemoryHistory({
      initialEntries: ["/estates/estate/assets?status=ALL"],
    }),
  });
  await router.load();
  renderWithProviders(<RouterProvider router={router} />);
  const list = within(await screen.findByRole("list", { name: "Assets" }));
  const card = await list.findByRole("link", { name: "Water pump (E-A0001)" });
  expect(card.getAttribute("href")).toBe("/estates/estate/assets/pump");
  expect(list.getAllByRole("link")).toHaveLength(1);
  const contents = within(card);
  expect(contents.queryAllByRole("link")).toHaveLength(0);
  expect(contents.queryAllByRole("button")).toHaveLength(0);
  await contents.findByText("Pump");
  contents.getByText("Faulty");
  contents.getByText("Active");
  fireEvent.click(contents.getByText("Block A › Level 1 › Pump room"));
  await screen.findByRole("heading", { name: "Water pump details" });
  expect(router.state.location.pathname).toBe("/estates/estate/assets/pump");
  router.history.back();
  await screen.findByRole("list", { name: "Assets" });
  await waitFor(() =>
    expect(router.state.location.search).toEqual({ status: "ALL" })
  );
});
