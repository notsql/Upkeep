import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { AppNavigation } from "@/components/app-navigation";
import { renderWithProviders, screen, waitFor, within } from "../test-utils";

beforeEach(() => {
  // Router navigation scrolls; jsdom has no viewport implementation.
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, role: "user", loading: false }),
}));
vi.mock("@/lib/estates", () => ({
  useEstate: () => ({
    data: {
      name: "Maple Estate",
      owned: true,
      canInviteMembers: true,
      canManageInvitationPermissions: true,
    },
  }),
}));

it.each([
  ["/estates/e/council", "Council"],
  ["/estates/e/assets?status=ALL", "Assets"],
  ["/estates/e/assets/a", "Assets"],
  ["/estates/e", "Overview"],
  ["/estates/e#locations", "Overview"],
])(
  "highlights only %s's current destination with real router links",
  async (path, label) => {
    const root = createRootRoute({ component: AppNavigation });
    const routes = [
      "/",
      "/estates",
      "/estates/$estateId",
      "/estates/$estateId/assets",
      "/estates/$estateId/assets/$assetId",
      "/estates/$estateId/council",
    ].map((routePath) =>
      createRoute({ getParentRoute: () => root, path: routePath })
    );
    const router = createRouter({
      routeTree: root.addChildren(routes),
      history: createMemoryHistory({ initialEntries: [path] }),
    });
    await router.load();
    renderWithProviders(<RouterProvider router={router} />);
    const nav = within(
      await screen.findByRole("navigation", { name: "Desktop navigation" })
    );
    expect(nav.queryByRole("link", { name: "Locations" })).toBeNull();
    await waitFor(() =>
      expect(
        nav
          .getAllByRole("link", { current: "page" })
          .map((link) => link.textContent)
      ).toEqual([label])
    );
  }
);
