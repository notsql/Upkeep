import type { components } from "@proj/api/schema";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent } from "@testing-library/react";
import {
  councilEstateAccess,
  mixedAccess,
  ownerEstateAccess,
  residentAccess,
  unassignedAccess,
  workspaceAccess,
} from "@tests/fixtures/access";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { AppNavigation, EstateNavigation } from "@/components/app-navigation";
import { api } from "@/lib/api";

let accessOverride:
  | typeof mixedAccess
  | typeof workspaceAccess
  | typeof unassignedAccess
  | undefined;

const { auth, listeners } = vi.hoisted(() => ({
  auth: { user: { id: "owner" }, role: "user", loading: false },
  listeners: new Set<() => void>(),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useAuth: () => ({
      ...auth,
      user: useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        () => auth.user
      ),
    }),
  };
});
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));

const OTHER_ACCOUNT_ESTATES = /Maple Estate|Old Estate/;
const SWITCH_ESTATE = /Switch estate/;

type Estate = components["schemas"]["EstateResponse"];
const maple: Estate = {
  id: "maple",
  name: "Maple Estate",
  code: "MP-001",
  address: "Maple Road",
  postalCode: "123456",
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  owned: true,
  canInviteMembers: true,
  canManageInvitationPermissions: true,
};
const oak: Estate = {
  ...maple,
  id: "oak",
  name: "Oak Park",
  code: "OP-002",
  owned: false,
  canInviteMembers: false,
  canManageInvitationPermissions: false,
};
const inactive: Estate = {
  ...maple,
  id: "inactive",
  name: "Old Estate",
  code: "OLD-003",
  deactivatedAt: "2026-10-01T00:00:00Z",
};
function Layout() {
  return (
    <>
      <AppNavigation />
      <EstateNavigation />
      <Outlet />
    </>
  );
}
function Destination() {
  return <h1>Estate overview</h1>;
}
async function setup(
  initialPath = "/estates/maple/assets?condition=FAULTY#history"
) {
  const root = createRootRoute({ component: Layout });
  const routes = [
    "/",
    "/estates",
    "/estates/new",
    "/estates/$estateId",
    "/estates/$estateId/assets",
    "/estates/$estateId/council",
    "/reports/new",
    "/reports",
  ].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: Destination })
  );
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  await router.load();
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}
function getEstates(path: string, options?: unknown) {
  if (path === "/access/context") {
    return Promise.resolve({
      data: accessOverride ?? {
        ...workspaceAccess,
        estates:
          auth.user.id === "owner"
            ? [
                { ...ownerEstateAccess, estateId: "maple" },
                { ...councilEstateAccess, canInviteMembers: false },
                { ...ownerEstateAccess, estateId: "inactive" },
              ]
            : [councilEstateAccess],
      },
      response: new Response(),
    } as never);
  }
  const id = (options as { params?: { path?: { id?: string } } } | undefined)
    ?.params?.path?.id;
  const estates = auth.user.id === "owner" ? [maple, oak, inactive] : [oak];
  return Promise.resolve({
    data:
      path === "/estates"
        ? estates
        : estates.find((estate) => estate.id === id),
    response: new Response(),
  } as never);
}
beforeEach(() => {
  vi.mocked(api.GET).mockClear();
  accessOverride = undefined;
  auth.user = { id: "owner" };
  auth.role = "user";
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.mocked(api.GET).mockImplementation(getEstates);
});

it("shows resident navigation from database access while WorkOS has an ordinary user role", async () => {
  accessOverride = residentAccess;
  auth.user = { id: "resident-a" };
  auth.role = "user";
  await setup("/reports/new");

  await Promise.all(
    ["Desktop navigation", "Mobile navigation"].map(async (name) => {
      const navigation = within(screen.getByRole("navigation", { name }));
      expect(
        (
          await navigation.findByRole("link", { name: "Report a fault" })
        ).getAttribute("href")
      ).toBe("/reports/new");
      expect(
        navigation
          .getByRole("link", { name: "My reports" })
          .getAttribute("href")
      ).toBe("/reports");
      expect(navigation.queryByRole("link", { name: "Home" })).toBeNull();
      expect(navigation.queryByRole("link", { name: "Estates" })).toBeNull();
      expect(
        navigation.queryByRole("link", { name: "Admin users" })
      ).toBeNull();
    })
  );
  expect(
    vi.mocked(api.GET).mock.calls.some((call) => call[0] === "/estates")
  ).toBe(false);
});

it("shows reporting and management navigation together for different estate roles", async () => {
  accessOverride = mixedAccess;
  auth.user = { id: "mixed-user" };
  auth.role = "resident"; // This stale WorkOS claim must not hide B's permissions.
  await setup("/estates/oak/council");
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  await desktop.findByRole("link", { name: "Estates" });
  desktop.getByRole("link", { name: "Home" });
  desktop.getByRole("link", { name: "Report a fault" });
  desktop.getByRole("link", { name: "My reports" });
  desktop.getByRole("link", { name: "Council" });
  expect(desktop.queryByRole("link", { name: "Assets" })).toBeNull();
  const mobile = within(
    screen.getByRole("navigation", { name: "Mobile navigation" })
  );
  const mobileHistory = mobile.queryByRole("link", { name: "My reports" });
  if (mobileHistory) {
    expect(mobileHistory.getAttribute("href")).toBe("/reports");
  } else {
    fireEvent.click(mobile.getByRole("button", { name: "More navigation" }));
    const history = await screen.findByRole("menuitem", { name: "My reports" });
    expect(history.getAttribute("href")).toBe("/reports");
  }
});

it("hides My reports after the resident membership is deleted", async () => {
  accessOverride = unassignedAccess;
  auth.user = { id: "former-resident" };
  await setup("/reports");
  await Promise.all(
    ["Desktop navigation", "Mobile navigation"].map(async (name) => {
      const navigation = within(screen.getByRole("navigation", { name }));
      await navigation.findByRole("link", { name: "Sign out" });
      expect(navigation.queryByRole("link", { name: "My reports" })).toBeNull();
      expect(navigation.queryByRole("link", { name: "Estates" })).toBeNull();
    })
  );
});

it.each([false, true])(
  "hides My reports without Resident membership (platform admin: %s)",
  async (canAccessPlatformAdmin) => {
    accessOverride = { ...workspaceAccess, canAccessPlatformAdmin };
    await setup("/estates/oak");
    const desktop = within(
      screen.getByRole("navigation", { name: "Desktop navigation" })
    );
    await desktop.findByRole("link", { name: "Estates" });
    expect(desktop.queryByRole("link", { name: "My reports" })).toBeNull();
    const mobile = within(
      screen.getByRole("navigation", { name: "Mobile navigation" })
    );
    expect(mobile.queryByRole("link", { name: "My reports" })).toBeNull();
    fireEvent.click(mobile.getByRole("button", { name: "More navigation" }));
    await screen.findByRole("menuitem", { name: "Settings" });
    expect(screen.queryByRole("menuitem", { name: "My reports" })).toBeNull();
  }
);

it("shows no management links while the database access lookup is pending", async () => {
  let finish: (() => void) | undefined;
  vi.mocked(api.GET).mockImplementation(((path: string) =>
    path === "/access/context"
      ? new Promise((resolve) => {
          finish = () =>
            resolve({ data: residentAccess, response: new Response() });
        })
      : getEstates(path)) as never);
  try {
    await setup("/reports/new");
    expect(screen.queryByRole("link", { name: "Estates" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Home" })).toBeNull();
    expect(screen.queryByRole("link", { name: "My reports" })).toBeNull();
  } finally {
    finish?.();
  }
});

it("hides My reports when the access lookup fails", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    error: { message: "Unavailable" },
    response: new Response(null, { status: 503 }),
  } as never);
  const { queryClient } = await setup("/reports");
  await waitFor(() =>
    expect(queryClient.getQueryState(["owner", "app-access"])?.status).toBe(
      "error"
    )
  );
  expect(screen.queryByRole("link", { name: "My reports" })).toBeNull();
});

it("switches from desktop assets to a shared estate overview with that estate's permissions", async () => {
  const { router } = await setup();
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  fireEvent.click(
    await desktop.findByRole("button", { name: "Switch estate: Maple Estate" })
  );
  const current = await screen.findByRole("menuitem", {
    name: "Maple Estate MP-001",
  });
  expect(current.getAttribute("aria-current")).toBe("location");
  expect(current.getAttribute("href")).toBe("/estates/maple");
  const target = screen.getByRole("menuitem", { name: "Oak Park OP-002" });
  expect(target.getAttribute("href")).toBe("/estates/oak");
  expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  await waitFor(() => {
    fireEvent.click(target);
    expect(router.state.location.pathname).toBe("/estates/oak");
  });
  expect(router.state.location.search).toEqual({});
  expect(router.state.location.hash).toBe("");
  await desktop.findByRole("button", { name: "Switch estate: Oak Park" });
  await waitFor(() => {
    expect(desktop.queryByRole("link", { name: "Assets" })).toBeNull();
    expect(desktop.queryByRole("link", { name: "Council" })).toBeNull();
  });
  expect(
    desktop.getByRole("link", { name: "Overview" }).getAttribute("href")
  ).toBe("/estates/oak");
});

it("offers inactive accessible estates above mobile estate links and opens their overview", async () => {
  const { router } = await setup("/estates/maple/council");
  const local = within(
    await screen.findByRole("navigation", { name: "Estate navigation" })
  );
  fireEvent.click(
    await local.findByRole("button", { name: "Switch estate: Maple Estate" })
  );
  const target = await screen.findByRole("menuitem", {
    name: "Old Estate OLD-003 Inactive",
  });
  await waitFor(() => {
    fireEvent.click(target);
    expect(router.state.location.pathname).toBe("/estates/inactive");
  });
  await local.findByRole("button", { name: "Switch estate: Old Estate" });
  expect(
    local.getByRole("link", { name: "Overview" }).getAttribute("href")
  ).toBe("/estates/inactive");
  const global = within(
    screen.getByRole("navigation", { name: "Mobile navigation" })
  );
  global.getByRole("link", { name: "Home" });
  global.getByRole("link", { name: "Estates" });
  expect(global.queryByRole("link", { name: "Assets" })).toBeNull();
});

it("shows a retry on list failure without changing the current estate", async () => {
  const original = getEstates;
  vi.mocked(api.GET).mockImplementation((path, options) => {
    if (path === "/estates") {
      return Promise.resolve({
        error: { message: "Unavailable" },
        response: new Response(null, { status: 503 }),
      } as never);
    }
    return original(path, options);
  });
  const { router } = await setup();
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  fireEvent.click(
    await desktop.findByRole("button", { name: "Switch estate: Maple Estate" })
  );
  await screen.findByText("Unable to load estates.");
  const retry = await screen.findByRole("menuitem", {
    name: "Retry loading estates",
  });
  expect(
    screen.queryByRole("menuitem", { name: "Oak Park OP-002" })
  ).toBeNull();
  expect(router.state.location.pathname).toBe("/estates/maple/assets");
  vi.mocked(api.GET).mockImplementation(original);
  fireEvent.click(retry);
  await waitFor(() =>
    expect(
      screen.queryByRole("menuitem", { name: "Retry loading estates" })
    ).toBeNull()
  );
  fireEvent.click(
    desktop.getByRole("button", { name: "Switch estate: Maple Estate" })
  );
  await screen.findByRole("menuitem", { name: "Oak Park OP-002" });
});

it("does not show another account's cached estate choices", async () => {
  await setup("/estates/oak");
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  fireEvent.click(
    await desktop.findByRole("button", { name: "Switch estate: Oak Park" })
  );
  await screen.findByRole("menuitem", { name: "Maple Estate MP-001" });
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
  // Keep the same providers/cache as an in-app account change.
  act(() => {
    auth.user = { id: "recipient" };
    for (const listener of listeners) {
      listener();
    }
  });
  fireEvent.click(
    await desktop.findByRole("button", { name: "Switch estate: Oak Park" })
  );
  await screen.findByRole("menuitem", { name: "Oak Park OP-002" });
  expect(
    screen.queryByRole("menuitem", { name: OTHER_ACCOUNT_ESTATES })
  ).toBeNull();
});

it("shows loading and then an empty list without inventing an estate choice", async () => {
  const original = getEstates;
  let completeList: (() => void) | undefined;
  vi.mocked(api.GET).mockImplementation((path, options) => {
    if (path === "/estates") {
      return new Promise<never>((resolve) => {
        completeList = () =>
          resolve({ data: [], response: new Response() } as never);
      });
    }
    return original(path, options);
  });
  const { router } = await setup();
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  fireEvent.click(
    await desktop.findByRole("button", { name: "Switch estate: Maple Estate" })
  );
  expect((await screen.findByRole("status")).textContent).toBe(
    "Loading estates…"
  );
  expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  completeList?.();
  await screen.findByText("No accessible estates.");
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
  expect(router.state.location.pathname).toBe("/estates/maple/assets");
});

it.each(["/", "/estates", "/estates/new"])(
  "has no estate switcher outside an estate on %s",
  async (path) => {
    await setup(path);
    expect(screen.queryByRole("button", { name: SWITCH_ESTATE })).toBeNull();
  }
);
