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
  crewEstateAccess,
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
    "/estates/$estateId/roles",
    "/estates/$estateId/reports",
    "/estates/$estateId/reports/$reportId",
    "/estates/$estateId/work-orders",
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
                {
                  ...ownerEstateAccess,
                  estateId: "maple",
                  estateName: maple.name,
                },
                { ...councilEstateAccess, canInviteMembers: false },
                {
                  ...ownerEstateAccess,
                  estateId: "inactive",
                  estateName: inactive.name,
                },
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

it("shows the assigned custom role name in the estate dropdown", async () => {
  accessOverride = {
    ...workspaceAccess,
    estates: [
      {
        ...ownerEstateAccess,
        estateId: "oak",
        estateName: "Oak Park",
        role: "CUSTOM",
        customRoleName: "Auditor",
      },
    ],
  };
  await setup("/estates/oak");
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  const trigger = await desktop.findByRole("button", {
    name: "Switch estate: Oak Park",
  });
  expect(trigger.textContent).toContain("Auditor");
  expect(trigger.getAttribute("aria-description")).toBe("Auditor");
  fireEvent.click(trigger);
  within(await screen.findByRole("menuitem", { name: "Oak Park" })).getByText(
    "Auditor"
  );
});

it.each(["roles", "council"])(
  "switches to a custom estate's permitted %s screen without report or overview access",
  async (feature) => {
    accessOverride = {
      ...workspaceAccess,
      estates: [
        { ...ownerEstateAccess, estateId: "maple", estateName: "Maple Estate" },
        {
          ...ownerEstateAccess,
          estateId: "oak",
          estateName: "Oak Park",
          role: "CUSTOM",
          customRoleName: "Delegated staff",
          canViewManagement: false,
          canManageEstate: false,
          canViewAssets: false,
          canInviteMembers: feature === "council",
          canManageInvitationPermissions: false,
          canViewFaultReports: false,
          canRelocateFaultReports: false,
          canViewWorkOrders: false,
          canCreateWorkOrders: false,
          canViewEstateRoles: feature === "roles",
          canViewEstateInvitations: feature === "council",
        },
      ],
    };
    const { router } = await setup("/estates/maple/assets");
    const desktop = within(
      screen.getByRole("navigation", { name: "Desktop navigation" })
    );
    fireEvent.click(
      await desktop.findByRole("button", {
        name: "Switch estate: Maple Estate",
      })
    );
    const target = await screen.findByRole("menuitem", { name: "Oak Park" });
    expect(target.getAttribute("href")).toBe(`/estates/oak/${feature}`);
    fireEvent.click(target);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/estates/oak/${feature}`)
    );
    const current = await desktop.findByRole("button", {
      name: "Switch estate: Oak Park",
    });
    expect(current.textContent).toContain("Delegated staff");
    expect(
      vi
        .mocked(api.GET)
        .mock.calls.some(
          (call) =>
            call[0] === "/estates/{id}" &&
            (call[1] as { params?: { path?: { id?: string } } }).params?.path
              ?.id === "oak"
        )
    ).toBe(false);
  }
);

it.each([
  "/estates/pine/work-orders",
  "/estates/pine",
  "/reports/new?estateId=maple",
])(
  "shows all estate roles and switches to resident reporting from %s",
  async (path) => {
    accessOverride = mixedAccess;
    const { router } = await setup(path);
    const desktop = within(
      screen.getByRole("navigation", { name: "Desktop navigation" })
    );
    const trigger = await desktop.findByRole("button", { name: SWITCH_ESTATE });
    expect(trigger.textContent).toContain(
      path.startsWith("/reports") ? "Resident" : "Manager"
    );
    fireEvent.click(trigger);
    const resident = await screen.findByRole("menuitem", {
      name: "Maple Estate",
    });
    within(resident).getByText("Resident");
    within(screen.getByRole("menuitem", { name: "Pine Estate" })).getByText(
      "Manager"
    );
    within(screen.getByRole("menuitem", { name: "Oak Park" })).getByText(
      "Council"
    );
    fireEvent.click(resident);
    await waitFor(() =>
      expect(router.state.location.href).toBe("/reports/new?estateId=maple")
    );
    expect(
      vi.mocked(api.GET).mock.calls.some((call) => call[0] === "/estates")
    ).toBe(false);
  }
);

it("shows a single resident estate dropdown", async () => {
  accessOverride = residentAccess;
  await setup("/reports/new");
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  fireEvent.click(await desktop.findByRole("button", { name: SWITCH_ESTATE }));
  within(
    await screen.findByRole("menuitem", { name: "Maple Estate" })
  ).getByText("Resident");
});

it("lets Crew switch work-order estates without management or owner-only requests", async () => {
  accessOverride = {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: [
      crewEstateAccess,
      { ...crewEstateAccess, estateId: "pine", estateName: "Pine Estate" },
    ],
  };
  const { router } = await setup("/estates/oak/work-orders");
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  await desktop.findByRole("link", { name: "Work orders" });
  fireEvent.click(
    await desktop.findByRole("button", { name: "Switch estate: Oak Park" })
  );
  expect(screen.queryByText("Work-order estate")).toBeNull();
  fireEvent.click(await screen.findByRole("menuitem", { name: "Pine Estate" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/estates/pine/work-orders")
  );
  expect(
    vi.mocked(api.GET).mock.calls.every((call) => call[0] === "/access/context")
  ).toBe(true);
});

it.each(["/", "/estates"])(
  "asks which work-order estate to open from %s",
  async (path) => {
    accessOverride = {
      ...workspaceAccess,
      estates: [
        { ...ownerEstateAccess, estateId: "maple", estateName: "Maple Estate" },
        { ...ownerEstateAccess, estateId: "pine", estateName: "Pine Estate" },
      ],
    };
    const { router } = await setup(path);
    const desktop = within(
      screen.getByRole("navigation", { name: "Desktop navigation" })
    );
    fireEvent.click(
      await desktop.findByRole("button", { name: "Work orders" })
    );
    const chooser = within(
      await screen.findByRole("dialog", {
        name: "Choose an estate for work orders",
      })
    );
    expect(router.state.location.pathname).toBe(path);
    fireEvent.click(chooser.getByRole("link", { name: "Pine Estate" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/estates/pine/work-orders")
    );
  }
);

it("lets Crew choose a work-order estate from mobile navigation", async () => {
  accessOverride = {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: [
      crewEstateAccess,
      { ...crewEstateAccess, estateId: "pine", estateName: "Pine Estate" },
      councilEstateAccess,
    ],
  };
  const { router } = await setup("/");
  const mobile = within(
    screen.getByRole("navigation", { name: "Mobile navigation" })
  );
  fireEvent.click(
    await mobile.findByRole("button", { name: "More navigation" })
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: "Work orders" }));
  const chooser = within(
    await screen.findByRole("dialog", {
      name: "Choose an estate for work orders",
    })
  );
  fireEvent.click(chooser.getByRole("link", { name: "Pine Estate" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/estates/pine/work-orders")
  );
  expect(
    vi.mocked(api.GET).mock.calls.every((call) => call[0] === "/access/context")
  ).toBe(true);
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
      expect(
        navigation.getByRole("link", { name: "Estates" }).getAttribute("href")
      ).toBe("/estates");
      expect(
        navigation.queryByRole("link", { name: "Admin users" })
      ).toBeNull();
    })
  );
  expect(
    vi.mocked(api.GET).mock.calls.some((call) => call[0] === "/estates")
  ).toBe(false);
});

it.each([ownerEstateAccess, crewEstateAccess])(
  "shows Fault reports in desktop and contextual navigation for $role responders",
  async (permission) => {
    accessOverride = {
      ...workspaceAccess,
      estates: [{ ...permission, estateId: "oak" }],
    };
    await setup("/estates/oak/reports/report-1");
    await Promise.all(
      ["Desktop navigation", "Estate navigation"].map(async (name) => {
        const navigation = within(
          await screen.findByRole("navigation", { name })
        );
        const link = await navigation.findByRole("link", {
          name: "Fault reports",
        });
        expect(link.getAttribute("href")).toBe("/estates/oak/reports");
        expect(link.getAttribute("aria-current")).toBe("page");
        expect(
          navigation.queryByRole("link", { name: "My reports" })
        ).toBeNull();
      })
    );
  }
);

it("keeps Fault reports available for an inactive estate with read permission", async () => {
  accessOverride = {
    ...workspaceAccess,
    estates: [
      {
        ...ownerEstateAccess,
        estateId: "inactive",
        canRelocateFaultReports: false,
      },
    ],
  };
  await setup("/estates/inactive/reports");
  const navigation = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  expect(
    (
      await navigation.findByRole("link", { name: "Fault reports" })
    ).getAttribute("href")
  ).toBe("/estates/inactive/reports");
});

it("lets Crew switch between assigned report estates without requesting management estate data", async () => {
  accessOverride = {
    ...workspaceAccess,
    canCreateEstate: false,
    estates: [
      { ...crewEstateAccess, estateId: "oak", estateName: "Oak Park" },
      { ...crewEstateAccess, estateId: "maple", estateName: "Maple Estate" },
    ],
  };
  const { router } = await setup("/estates/oak/reports");
  const local = within(
    await screen.findByRole("navigation", { name: "Estate navigation" })
  );
  fireEvent.click(
    await local.findByRole("button", { name: "Switch estate: Oak Park" })
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Maple Estate" })
  );
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/estates/maple/reports")
  );
  expect(
    vi
      .mocked(api.GET)
      .mock.calls.some(
        (call) => call[0] === "/estates" || call[0] === "/estates/{id}"
      )
  ).toBe(false);
});

it("offers mixed Council/Crew accounts an entry to their responder estate from another estate", async () => {
  accessOverride = {
    ...workspaceAccess,
    estates: [councilEstateAccess, { ...crewEstateAccess, estateId: "maple" }],
  };
  await setup("/estates/oak");
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  fireEvent.click(
    await desktop.findByRole("button", { name: "Respond to faults" })
  );
  const chooser = within(
    await screen.findByRole("dialog", {
      name: "Choose an estate for fault reports",
    })
  );
  expect(chooser.getAllByRole("link")).toHaveLength(1);
  expect(
    chooser.getByRole("link", { name: "Oak Park" }).getAttribute("href")
  ).toBe("/estates/maple/reports");
});

it("lets a manager switch from their report estate to another assigned Crew report estate", async () => {
  accessOverride = {
    ...workspaceAccess,
    estates: [
      { ...ownerEstateAccess, estateId: "maple", estateName: "Maple Estate" },
      { ...crewEstateAccess, estateId: "oak", estateName: "Oak Park" },
    ],
  };
  const { router } = await setup("/estates/maple/reports");
  const local = within(
    await screen.findByRole("navigation", { name: "Estate navigation" })
  );
  fireEvent.click(
    await local.findByRole("button", { name: "Switch estate: Maple Estate" })
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: "Oak Park" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/estates/oak/reports")
  );
});

it("does not derive fault-report navigation from broad management access or a WorkOS admin claim", async () => {
  accessOverride = {
    ...workspaceAccess,
    estates: [
      { ...ownerEstateAccess, estateId: "maple" },
      { ...councilEstateAccess, canViewFaultReports: false },
    ],
  };
  auth.role = "admin";
  await setup("/estates/oak");
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  await desktop.findByRole("link", { name: "Overview" });
  expect(screen.queryByRole("link", { name: "Fault reports" })).toBeNull();
});

it("removes fault-report navigation after responder access is revoked on refetch", async () => {
  accessOverride = {
    ...workspaceAccess,
    estates: [{ ...ownerEstateAccess, estateId: "maple" }],
  };
  const { queryClient } = await setup("/estates/maple/reports");
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  await desktop.findByRole("link", { name: "Fault reports" });
  accessOverride = {
    ...workspaceAccess,
    estates: [
      {
        ...councilEstateAccess,
        estateId: "maple",
        canViewFaultReports: false,
      },
    ],
  };
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ["owner", "app-access"] });
  });
  await waitFor(() =>
    expect(screen.queryByRole("link", { name: "Fault reports" })).toBeNull()
  );
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
  desktop.getByRole("link", { name: "Estate members" });
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

it("keeps estate creation discoverable after the resident membership is deleted", async () => {
  accessOverride = unassignedAccess;
  auth.user = { id: "former-resident" };
  await setup("/reports");
  await Promise.all(
    ["Desktop navigation", "Mobile navigation"].map(async (name) => {
      const navigation = within(screen.getByRole("navigation", { name }));
      await navigation.findByRole("link", { name: "Sign out" });
      expect(navigation.queryByRole("link", { name: "My reports" })).toBeNull();
      expect(
        navigation.getByRole("link", { name: "Estates" }).getAttribute("href")
      ).toBe("/estates");
    })
  );
});

it.each([
  { account: "unassigned", access: unassignedAccess },
  {
    account: "Crew",
    access: { ...workspaceAccess, estates: [crewEstateAccess] },
  },
  {
    account: "Council",
    access: { ...workspaceAccess, estates: [councilEstateAccess] },
  },
])(
  "offers the estate directory in desktop and mobile navigation for $account accounts",
  async ({ access }) => {
    accessOverride = access;
    await setup("/estates");
    await Promise.all(
      ["Desktop navigation", "Mobile navigation"].map(async (name) => {
        const navigation = within(screen.getByRole("navigation", { name }));
        expect(
          (
            await navigation.findByRole("link", { name: "Estates" })
          ).getAttribute("href")
        ).toBe("/estates");
        expect(
          navigation.queryByRole("link", { name: "Admin users" })
        ).toBeNull();
      })
    );
  }
);

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
    name: "Maple Estate",
  });
  expect(current.getAttribute("aria-current")).toBe("location");
  expect(current.getAttribute("href")).toBe("/estates/maple");
  const target = screen.getByRole("menuitem", { name: "Oak Park" });
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
    expect(desktop.queryByRole("link", { name: "Estate members" })).toBeNull();
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
    name: "Old Estate",
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

// Context choices now come from access context, not the management estate-list query.
it("hides the estate dropdown when access context fails", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    error: { message: "Unavailable" },
    response: new Response(null, { status: 503 }),
  } as never);
  const { router, queryClient } = await setup();
  await waitFor(() =>
    expect(queryClient.getQueryState(["owner", "app-access"])?.status).toBe(
      "error"
    )
  );
  expect(screen.queryByRole("button", { name: SWITCH_ESTATE })).toBeNull();
  expect(router.state.location.pathname).toBe("/estates/maple/assets");
});

it("does not show another account's cached estate choices", async () => {
  await setup("/estates/oak");
  const desktop = within(
    screen.getByRole("navigation", { name: "Desktop navigation" })
  );
  fireEvent.click(
    await desktop.findByRole("button", { name: "Switch estate: Oak Park" })
  );
  await screen.findByRole("menuitem", { name: "Maple Estate" });
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
  await screen.findByRole("menuitem", { name: "Oak Park" });
  expect(
    screen.queryByRole("menuitem", { name: OTHER_ACCOUNT_ESTATES })
  ).toBeNull();
});

it("does not invent a selected estate when access context has no memberships", async () => {
  accessOverride = unassignedAccess;
  await setup("/estates/maple/assets");
  await waitFor(() => expect(vi.mocked(api.GET)).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: SWITCH_ESTATE })).toBeNull();
  expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
});

it.each(["/", "/estates", "/estates/new"])(
  "has no estate switcher outside an estate on %s",
  async (path) => {
    await setup(path);
    expect(screen.queryByRole("button", { name: SWITCH_ESTATE })).toBeNull();
  }
);

it.each(["/", "/estates"])(
  "asks which fault-report estate to open from %s",
  async (path) => {
    accessOverride = {
      ...workspaceAccess,
      estates: [
        { ...crewEstateAccess, estateId: "oak", estateName: "Oak Park" },
        { ...crewEstateAccess, estateId: "maple", estateName: "Maple Estate" },
        {
          ...ownerEstateAccess,
          estateId: "private",
          estateName: "Owner only",
          canViewFaultReports: false,
        },
      ],
    };
    const { router } = await setup(path);
    const desktop = within(
      screen.getByRole("navigation", { name: "Desktop navigation" })
    );
    fireEvent.click(
      await desktop.findByRole("button", { name: "Respond to faults" })
    );
    const chooser = within(
      await screen.findByRole("dialog", {
        name: "Choose an estate for fault reports",
      })
    );
    expect(router.state.location.pathname).toBe(path);
    expect(chooser.queryByRole("link", { name: "Owner only" })).toBeNull();
    fireEvent.click(chooser.getByRole("link", { name: "Maple Estate" }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/estates/maple/reports")
    );
    expect(
      vi
        .mocked(api.GET)
        .mock.calls.every((call) => call[0] === "/access/context")
    ).toBe(true);
  }
);
it("lets Crew choose a fault-report estate from mobile navigation", async () => {
  accessOverride = {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: [
      crewEstateAccess,
      { ...crewEstateAccess, estateId: "pine", estateName: "Pine Estate" },
    ],
  };
  const { router } = await setup("/");
  const mobile = within(
    screen.getByRole("navigation", { name: "Mobile navigation" })
  );
  fireEvent.click(
    await mobile.findByRole("button", { name: "More navigation" })
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Respond to faults" })
  );
  const chooser = within(
    await screen.findByRole("dialog", {
      name: "Choose an estate for fault reports",
    })
  );
  fireEvent.click(chooser.getByRole("link", { name: "Pine Estate" }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe("/estates/pine/reports")
  );
});
