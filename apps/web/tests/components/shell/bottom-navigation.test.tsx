import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import {
  crewEstateAccess,
  ownerEstateAccess,
  residentAccess,
  workspaceAccess,
} from "@tests/fixtures/access";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/shell/app-shell";
import { api } from "@/lib/api";

vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));

type Access = typeof workspaceAccess | typeof residentAccess;
const state: { access: Access } = { access: workspaceAccess };

function Layout() {
  return (
    <AppShell>
      <main>Content</main>
      <Outlet />
    </AppShell>
  );
}
function Destination() {
  return null;
}
async function setup(initialPath: string) {
  const root = createRootRoute({ component: Layout });
  const routes = [
    "/",
    "/estates/$estateId",
    "/estates/$estateId/$section",
    "/estates/$estateId/$section/$sub",
    "/reports",
    "/reports/new",
  ].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: Destination })
  );
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  await router.load();
  renderWithProviders(<RouterProvider router={router} />);
  return within(
    await screen.findByRole("navigation", { name: "Estate sections" })
  );
}

function owner() {
  state.access = {
    ...workspaceAccess,
    estates: [ownerEstateAccess],
  };
}

const desktopWidth = window.innerWidth;
beforeEach(() => {
  window.innerWidth = 375;
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  state.access = workspaceAccess;
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    if (path === "/access/context") {
      return Promise.resolve({ data: state.access, response: new Response() });
    }
    return Promise.resolve({
      data: { id: "pine", name: "Pine Estate", owned: true },
      response: new Response(),
    });
  }) as never);
});
afterEach(() => {
  window.innerWidth = desktopWidth;
});

function sectionTabs() {
  return screen.queryByRole("navigation", { name: "Section pages" });
}

describe("mobile bottom navigation", () => {
  it("shows one button per sidebar section and no sidebar trigger", async () => {
    owner();
    const bar = await setup("/estates/pine/assets");
    await bar.findByRole("link", { name: "Admin" });
    expect(bar.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Overview",
      "Maintenance",
      "Assets",
      "Admin",
    ]);
    expect(screen.queryByRole("button", { name: "Toggle Sidebar" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Sidebar" })).toBeNull();
  });

  it("marks the current section and links each button to its first item", async () => {
    owner();
    const bar = await setup("/estates/pine/locations");
    const assets = await bar.findByRole("link", { name: "Assets" });
    expect(assets.getAttribute("aria-current")).toBe("page");
    expect(assets.getAttribute("href")).toBe("/estates/pine/assets");
    const maintenance = bar.getByRole("link", { name: "Maintenance" });
    expect(maintenance.getAttribute("aria-current")).toBeNull();
    expect(maintenance.getAttribute("href")).toBe("/estates/pine/reports");
    expect(
      bar.getByRole("link", { name: "Overview" }).getAttribute("href")
    ).toBe("/estates/pine");
  });

  it("lists the current section's pages as tabs", async () => {
    owner();
    await setup("/estates/pine/work-orders/w1");
    const strip = await screen.findByRole("navigation", {
      name: "Section pages",
    });
    await within(strip).findByRole("link", { name: "Work orders" });
    const tabs = within(strip).getAllByRole("link");
    expect(tabs.map((link) => link.textContent)).toEqual([
      "Fault reports",
      "Contractors",
      "Inspections",
      "Work orders",
    ]);
    expect(tabs[3]?.getAttribute("aria-current")).toBe("page");
  });

  it("filters sections by permission and hides tabs for a one-page section", async () => {
    state.access = { ...workspaceAccess, estates: [crewEstateAccess] };
    const bar = await setup("/estates/oak/assets");
    const assets = await bar.findByRole("link", { name: "Assets" });
    expect(bar.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Overview",
      "Maintenance",
      "Assets",
    ]);
    expect(assets.getAttribute("aria-current")).toBe("page");
    expect(sectionTabs()).toBeNull();
  });

  it("marks Overview current on the overview with no tabs", async () => {
    owner();
    const bar = await setup("/estates/pine");
    const overview = await bar.findByRole("link", { name: "Overview" });
    expect(overview.getAttribute("aria-current")).toBe("page");
    expect(sectionTabs()).toBeNull();
  });

  it("gives residents one button per page and no tabs", async () => {
    state.access = residentAccess;
    const bar = await setup("/reports");
    const mine = await bar.findByRole("link", { name: "My reports" });
    expect(bar.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Report a fault",
      "My reports",
    ]);
    expect(mine.getAttribute("aria-current")).toBe("page");
    expect(sectionTabs()).toBeNull();
  });

  it("keeps the desktop sidebar and no bottom bar on wide screens", async () => {
    window.innerWidth = 1280;
    owner();
    await expect(setup("/estates/pine/assets")).rejects.toThrow();
    await screen.findByRole("navigation", { name: "Sidebar" });
  });
});
