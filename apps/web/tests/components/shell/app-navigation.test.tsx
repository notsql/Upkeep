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
    "/estates/$estateId/$section/$sub",
    "/estates/$estateId/$section/$sub/$leaf",
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
    "Fault reports",
    "Inspections",
    "Work orders",
    "Assets",
    "Locations",
    "Documents",
    "People & access",
    "Notification settings",
    "Estate settings",
  ]);
  expect(
    nav.getAllByRole("group").map((group) => group.getAttribute("aria-label"))
  ).toEqual(["Maintenance", "Assets", "Administration"]);
  for (const label of ["Operations", "Records"]) {
    expect(nav.queryByRole("group", { name: label })).toBeNull();
  }
  for (const label of ["Asset categories", "Members", "Roles"]) {
    expect(nav.queryByRole("link", { name: label })).toBeNull();
  }
  expect(
    nav.getByRole("link", { name: "People & access" }).getAttribute("href")
  ).toBe("/estates/pine/council");
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
  await nav.findByRole("link", { name: "People & access" });
  await waitFor(() => expect(requestedPaths()).toContain("/estates/{id}"));
  for (const label of [
    "Inspections",
    "Devices",
    "Asset categories",
    "Notification settings",
    "Chance of breaking down",
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
  expect(nav.queryByRole("link", { name: "Asset categories" })).toBeNull();
  expect(
    nav.queryByRole("link", { name: "Chance of breaking down" })
  ).toBeNull();
  expect(nav.queryByRole("link", { name: "Estate settings" })).toBeNull();
});

it("hides owner-only items until ownership is known", async () => {
  state.owned = "pending";
  estate({ canManageInvitationPermissions: false, canManageEstate: false });
  const nav = await setup("/estates/pine");
  await nav.findByRole("link", { name: "Overview" });
  expect(nav.queryByRole("link", { name: "Devices" })).toBeNull();
  expect(
    nav.queryByRole("link", { name: "Chance of breaking down" })
  ).toBeNull();
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
  const people = await nav.findByRole("link", { name: "People & access" });
  expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "People & access",
  ]);
  expect(people.getAttribute("href")).toBe("/estates/oak/roles");
  expect(people.getAttribute("aria-current")).toBe("page");
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
    "Fault reports",
    "Work orders",
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

it.each([
  "/estates/pine/council",
  "/estates/pine/council/invitations",
  "/estates/pine/roles",
  "/estates/pine/roles/new",
  "/estates/pine/roles/r1/edit",
])("marks People & access active on %s", async (path) => {
  const nav = await setup(path);
  const people = await nav.findByRole("link", { name: "People & access" });
  expect(people.getAttribute("aria-current")).toBe("page");
});

it.each([
  "/estates/pine/inspections",
  "/estates/pine/inspections/schedules",
  "/estates/pine/inspections/schedules/days",
])("marks Inspections active on %s", async (path) => {
  const nav = await setup(path);
  const inspections = await nav.findByRole("link", { name: "Inspections" });
  expect(inspections.getAttribute("aria-current")).toBe("page");
});

it("links People & access to Members for a members-only user", async () => {
  estate({ canViewEstateRoles: false });
  const nav = await setup("/estates/pine");
  const people = await nav.findByRole("link", { name: "People & access" });
  expect(people.getAttribute("href")).toBe("/estates/pine/council");
});

it("hides People & access when the user can open neither page", async () => {
  estate({
    canViewEstateRoles: false,
    canViewEstateInvitations: false,
    canInviteMembers: false,
    canManageInvitationPermissions: false,
  });
  const nav = await setup("/estates/pine");
  await nav.findByRole("link", { name: "Overview" });
  expect(nav.queryByRole("link", { name: "People & access" })).toBeNull();
});
