import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { expect, it } from "vitest";
import { SubNav } from "@/components/page/sub-nav";

function Layout() {
  return (
    <>
      <SubNav
        items={[
          {
            label: "Overview",
            to: "/estates/$estateId",
            params: { estateId: "e1" },
            exact: true,
          },
          {
            label: "Locations",
            to: "/estates/$estateId/locations",
            params: { estateId: "e1" },
          },
        ]}
        label="Estate sections"
      />
      <Outlet />
    </>
  );
}

async function renderAt(path: string) {
  const root = createRootRoute({ component: Layout });
  const router = createRouter({
    routeTree: root.addChildren(
      ["/estates/$estateId", "/estates/$estateId/locations"].map((route) =>
        createRoute({ getParentRoute: () => root, path: route })
      )
    ),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  renderWithProviders(<RouterProvider router={router} />);
  return await screen.findByRole("navigation", { name: "Estate sections" });
}

it("scrolls sideways only, so a pixel of underline can't make it scroll up and down", async () => {
  const nav = await renderAt("/estates/e1");
  const classes = nav.className.split(" ");
  expect(classes).toContain("overflow-x-auto");
  expect(classes).toContain("overflow-y-hidden");
});

it("marks the current sub-view as the active page", async () => {
  const root = createRootRoute({ component: Layout });
  const router = createRouter({
    routeTree: root.addChildren(
      ["/estates/$estateId", "/estates/$estateId/locations"].map((path) =>
        createRoute({ getParentRoute: () => root, path })
      )
    ),
    history: createMemoryHistory({ initialEntries: ["/estates/e1/locations"] }),
  });
  renderWithProviders(<RouterProvider router={router} />);
  const nav = await screen.findByRole("navigation", {
    name: "Estate sections",
  });
  const current = within(nav).getByRole("link", { name: "Locations" });
  expect(current.getAttribute("aria-current")).toBe("page");
  expect(
    within(nav)
      .getByRole("link", { name: "Overview" })
      .getAttribute("aria-current")
  ).toBeNull();
});
