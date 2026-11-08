import { SidebarProvider } from "@proj/ui/components/sidebar";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import {
  councilEstateAccess,
  crewEstateAccess,
  mixedAccess,
  ownerEstateAccess,
  residentAccess,
  workspaceAccess,
} from "@tests/fixtures/access";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { AppNavigation } from "@/components/shell/app-navigation";
import { api } from "@/lib/api";

const SWITCH_ESTATE = /Switch estate/u;

vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));

type Access = typeof workspaceAccess | typeof mixedAccess;
const state: { access: Access; owned: boolean | "pending" } = {
  access: workspaceAccess,
  owned: true,
};

function Layout() {
  return (
    <SidebarProvider>
      <AppNavigation />
      <Outlet />
    </SidebarProvider>
  );
}
function Destination() {
  return <h1>Destination</h1>;
}
async function setup(initialPath: string) {
  const root = createRootRoute({ component: Layout });
  const routes = [
    "/",
    "/estates",
    "/estates/$estateId",
    "/estates/$estateId/$section",
    "/estates/$estateId/assets/$assetId",
    "/reports",
    "/reports/new",
    "/reports/$reportId",
  ].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: Destination })
  );
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  await router.load();
  renderWithProviders(<RouterProvider router={router} />);
  return within(await screen.findByRole("navigation", { name: "Sidebar" }));
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  state.access = workspaceAccess;
  state.owned = true;
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    if (path === "/access/context") {
      return Promise.resolve({
        data: state.access,
        response: new Response(),
      });
    }
    if (state.owned === "pending") {
      return new Promise(() => undefined);
    }
    return Promise.resolve({
      data: { id: "pine", name: "Pine Estate", owned: state.owned },
      response: new Response(),
    });
  }) as never);
});

function requestedPaths(): string[] {
  return (vi.mocked(api.GET).mock.calls as unknown[][]).map((call) =>
    String(call[0])
  );
}

function estate(
  overrides: Partial<typeof ownerEstateAccess> & {
    canViewDocuments?: boolean;
  }
) {
  state.access = {
    ...workspaceAccess,
    estates: [{ ...ownerEstateAccess, ...overrides }],
  };
}

it("groups an owner's destinations with no Workspace group or switcher", async () => {
  estate({ canViewDocuments: true });
  const nav = await setup("/estates/pine/assets");
  await nav.findByRole("link", { name: "Estate settings" });
  const names = nav.getAllByRole("link").map((link) => link.textContent);
  expect(names).toEqual([
    "Overview",
    "Work orders",
    "Fault reports",
    "Inspections",
    "Locations",
    "Assets",
    "Documents",
    "Members",
    "Roles",
    "Asset categories",
    "Notification settings",
    "Estate settings",
  ]);
  for (const label of ["Operations", "Assets", "Records", "Administration"]) {
    nav.getByRole("group", { name: label });
  }
  expect(nav.queryByText("Workspace")).toBeNull();
  expect(nav.queryByRole("button", { name: SWITCH_ESTATE })).toBeNull();
  expect(nav.queryByRole("link", { name: "UpKeep" })).toBeNull();
  expect(
    nav.getByRole("link", { name: "Assets" }).getAttribute("aria-current")
  ).toBe("page");
  expect(
    nav.getByRole("link", { name: "Estate settings" }).getAttribute("href")
  ).toBe("/estates/pine/edit");
  expect(nav.getByRole("link", { name: "Assets" }).getAttribute("href")).toBe(
    "/estates/pine/assets"
  );
  expect(
    nav.getByRole("link", { name: "Locations" }).getAttribute("href")
  ).toBe("/estates/pine/locations");
  expect(
    nav
      .getByRole("link", { name: "Notification settings" })
      .getAttribute("href")
  ).toBe("/estates/pine/notification-settings");
});

it("keeps the section active on nested pages and matches Overview exactly", async () => {
  const nav = await setup("/estates/pine/assets/pump");
  await nav.findByRole("link", { name: "Estate settings" });
  expect(
    nav.getByRole("link", { name: "Assets" }).getAttribute("aria-current")
  ).toBe("page");
  expect(
    nav.getByRole("link", { name: "Overview" }).getAttribute("aria-current")
  ).toBeNull();
});

it("hides owner-only items for a management-only non-owner", async () => {
  state.owned = false;
  estate({
    role: "MEMBER",
    canManageEstate: false,
    canManageInvitationPermissions: false,
    canViewAssets: false,
    canViewInspectionResults: false,
  });
  const nav = await setup("/estates/pine");
  await nav.findByRole("link", { name: "Members" });
  await waitFor(() => expect(requestedPaths()).toContain("/estates/{id}"));
  for (const label of [
    "Inspections",
    "Devices",
    "Asset categories",
    "Notification settings",
    "Failure risk",
    "Estate settings",
    "Assets",
    "Device monitoring",
  ]) {
    expect(nav.queryByRole("link", { name: label })).toBeNull();
  }
});

it("shows delegate destinations to a non-owner who manages invitation permissions", async () => {
  state.owned = false;
  estate({ role: "MEMBER", canManageEstate: false });
  const nav = await setup("/estates/pine");
  await nav.findByRole("link", { name: "Inspections" });
  nav.getByRole("link", { name: "Assets" });
  nav.getByRole("link", { name: "Asset categories" });
  expect(nav.queryByRole("link", { name: "Failure risk" })).toBeNull();
  expect(nav.queryByRole("link", { name: "Estate settings" })).toBeNull();
});

it("hides owner-only items until ownership is known", async () => {
  state.owned = "pending";
  estate({ canManageInvitationPermissions: false, canManageEstate: false });
  const nav = await setup("/estates/pine");
  await nav.findByRole("link", { name: "Overview" });
  expect(nav.queryByRole("link", { name: "Devices" })).toBeNull();
  expect(nav.queryByRole("link", { name: "Failure risk" })).toBeNull();
});

it("shows only the Administration group for a roles-only estate", async () => {
  state.access = {
    ...workspaceAccess,
    estates: [
      {
        ...councilEstateAccess,
        canViewManagement: false,
        canViewEstateDetails: false,
        canInviteMembers: false,
        canViewEstateRoles: true,
      },
    ],
  };
  const nav = await setup("/estates/oak/roles");
  await nav.findByRole("link", { name: "Roles" });
  expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Roles",
  ]);
  expect(
    nav.getAllByRole("group").map((group) => group.getAttribute("aria-label"))
  ).toEqual(["Administration"]);
});

it("shows Crew only their permitted sections", async () => {
  state.access = { ...workspaceAccess, estates: [crewEstateAccess] };
  const nav = await setup("/estates/oak/work-orders");
  await nav.findByRole("link", { name: "Work orders" });
  expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Overview",
    "Work orders",
    "Fault reports",
    "Assets",
  ]);
  expect(nav.queryByRole("group", { name: "Records" })).toBeNull();
  expect(requestedPaths()).not.toContain("/estates/{id}");
});

it("points Council, who cannot open the register, at All devices", async () => {
  state.owned = false;
  state.access = { ...workspaceAccess, estates: [councilEstateAccess] };
  const nav = await setup("/estates/oak/assets/devices");
  const assets = await nav.findByRole("link", { name: "Assets" });
  expect(assets.getAttribute("href")).toBe("/estates/oak/assets/devices");
  expect(assets.getAttribute("aria-current")).toBe("page");
  expect(nav.queryByRole("link", { name: "Readings" })).toBeNull();
});

it("shows resident reporting links on /reports", async () => {
  state.access = residentAccess;
  const nav = await setup("/reports?estateId=maple");
  await nav.findByRole("link", { name: "My reports" });
  expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Dashboard",
    "Report a fault",
    "My reports",
  ]);
  expect(
    nav.getByRole("link", { name: "Report a fault" }).getAttribute("href")
  ).toBe("/reports/new?estateId=maple");
  expect(
    nav.getByRole("link", { name: "My reports" }).getAttribute("aria-current")
  ).toBe("page");
  expect(nav.queryByRole("link", { name: "Estates" })).toBeNull();
});

it("marks the resident Dashboard active on / for a resident-only account", async () => {
  state.access = residentAccess;
  const nav = await setup("/");
  const dashboard = await nav.findByRole("link", { name: "Dashboard" });
  expect(dashboard.getAttribute("aria-current")).toBe("page");
});

it("hides the resident Dashboard for a mixed resident and staff account", async () => {
  state.access = mixedAccess;
  const nav = await setup("/reports?estateId=maple");
  await nav.findByRole("link", { name: "My reports" });
  expect(nav.queryByRole("link", { name: "Dashboard" })).toBeNull();
});

it("renders no items while access is unavailable", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    error: { message: "Unavailable" },
    response: new Response(null, { status: 503 }),
  } as never);
  const nav = await setup("/estates/pine");
  await waitFor(() => expect(vi.mocked(api.GET)).toHaveBeenCalled());
  expect(nav.queryAllByRole("link")).toHaveLength(0);
});
