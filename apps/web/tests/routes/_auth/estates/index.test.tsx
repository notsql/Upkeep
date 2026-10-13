import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { Route } from "@/routes/_auth/estates/index";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@/routes/_auth/estates/-components/pending-invitations", () => ({
  PendingInvitations: () => null,
}));
vi.mock("@/routes/_auth/estates/-components/invitation-acceptance", () => ({
  InvitationAcceptance: () => null,
}));
function EstateDestination() {
  return <h1>Estate destination</h1>;
}
beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.mocked(api.GET).mockResolvedValue({
    data: [
      {
        id: "shared",
        name: "Oak Park",
        code: "OP-002",
        address: "88 River Road",
        owned: false,
      },
    ],
    response: new Response(),
  } as never);
});
it("restores search, status and access filters after opening a whole estate card and going back", async () => {
  const root = createRootRoute();
  const auth = createRoute({ getParentRoute: () => root, id: "_auth" });
  const directory = createRoute({
    getParentRoute: () => auth,
    path: "estates/",
    component: Route.options.component,
    validateSearch: Route.options.validateSearch,
  });
  const destination = createRoute({
    getParentRoute: () => auth,
    path: "estates/$estateId",
    component: EstateDestination,
  });
  const router = createRouter({
    routeTree: root.addChildren([auth.addChildren([directory, destination])]),
    history: createMemoryHistory({ initialEntries: ["/estates"] }),
  });
  await router.load();
  renderWithProviders(<RouterProvider router={router} />);
  await screen.findByRole("link", { name: "Oak Park (OP-002)" });
  fireEvent.change(screen.getByRole("searchbox", { name: "Search estates" }), {
    target: { value: "Oak " },
  });
  await waitFor(() => expect(router.state.location.search.q).toBe("Oak "));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search estates" }), {
    target: { value: "Oak Park" },
  });
  await chooseOption(screen.getByRole("combobox", { name: "Status" }), "All");
  await chooseOption(
    screen.getByRole("combobox", { name: "Access" }),
    "Shared with you"
  );
  const card = screen.getByRole("link", { name: "Oak Park (OP-002)" });
  expect(within(card).queryAllByRole("link")).toHaveLength(0);
  expect(within(card).queryAllByRole("button")).toHaveLength(0);
  fireEvent.click(card);
  await screen.findByRole("heading", { name: "Estate destination" });
  router.history.back();
  await screen.findByRole("link", { name: "Oak Park (OP-002)" });
  expect(
    screen.getByRole<HTMLInputElement>("searchbox", { name: "Search estates" })
      .value
  ).toBe("Oak Park");
  expect(
    screen.getByRole("combobox", { name: "Status" }).textContent
  ).toContain("All");
  expect(
    screen.getByRole("combobox", { name: "Access" }).textContent
  ).toContain("Shared with you");
});
