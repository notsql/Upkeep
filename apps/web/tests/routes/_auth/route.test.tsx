import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
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
  unassignedAccess,
} from "@tests/fixtures/access";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/_auth/route";

const { getAuth, get, managementLoader } = vi.hoisted(() => ({
  getAuth: vi.fn(),
  get: vi.fn(),
  managementLoader: vi.fn(),
}));
vi.mock("@workos/authkit-tanstack-react-start", () => ({ getAuth }));
vi.mock("@/lib/api", () => ({ api: { GET: get } }));
// A route's server-side access lookup must use a client scoped to that request.
vi.mock("@proj/api", () => ({ createApiClient: () => ({ GET: get }) }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (handler: () => unknown) => handler,
    };
    return builder;
  },
}));

function ManagementPage() {
  return <h1>Management page</h1>;
}
function ReportingPage() {
  return <h1>Reporting page</h1>;
}
function AccessError() {
  return <p role="alert">Access unavailable</p>;
}

function routerFor(path: string) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: Outlet,
  });
  const auth = createRoute({
    getParentRoute: () => root,
    id: "_auth",
    component: Outlet,
    beforeLoad: async (context) => {
      const guard = Route.options.beforeLoad as
        | ((value: unknown) => unknown)
        | undefined;
      if (guard) {
        await guard(context);
      }
    },
    loader: async (context) => {
      const load = Route.options.loader as
        | ((value: unknown) => unknown)
        | undefined;
      if (load) {
        await load(context);
      }
    },
  });
  const management = [
    "/invitations",
    "/estates",
    "/estates/new",
    "/estates/$estateId",
    "/estates/$estateId/assets",
    "/estates/$estateId/assets/new",
    "/estates/$estateId/assets/$assetId",
    "/estates/$estateId/assets/$assetId/history",
    "/estates/$estateId/assets/$assetId/maintenance",
    "/estates/$estateId/assets/$assetId/documents",
    "/estates/$estateId/assets/$assetId/edit",
    "/estates/$estateId/assets/$assetId/readings",
    "/estates/$estateId/readings",
    "/estates/$estateId/readings/new",
    "/estates/$estateId/readings/imports",
    "/estates/$estateId/readings/imports/$batchId",
    "/estates/$estateId/assets/$assetId/inspections/new",
    "/estates/$estateId/assets/$assetId/inspections/$inspectionId",
    "/estates/$estateId/edit",
    "/estates/$estateId/devices",
    "/estates/$estateId/asset-categories",
    "/estates/$estateId/asset-categories/$interval",
    "/estates/$estateId/inspections",
    "/estates/$estateId/sensors",
    "/estates/$estateId/sensors/all",
    "/estates/$estateId/failure-risk",
    "/estates/$estateId/council",
    "/estates/$estateId/reports",
    "/estates/$estateId/reports/$reportId",
    "/estates/$estateId/work-orders",
    "/estates/$estateId/work-orders/new",
    "/estates/$estateId/work-orders/$workOrderId",
    "/admin/users",
  ].map((destination) =>
    createRoute({
      getParentRoute: () => auth,
      path: destination,
      component: ManagementPage,
      loader: managementLoader,
    })
  );
  const reporting = ["/reports/new", "/reports", "/reports/$reportId"].map(
    (destination) =>
      createRoute({
        getParentRoute: () => auth,
        path: destination,
        component: ReportingPage,
      })
  );
  return createRouter({
    routeTree: root.addChildren([
      auth.addChildren([...management, ...reporting]),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
    context: {
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
    },
    defaultErrorComponent: AccessError,
  });
}

beforeEach(() => {
  getAuth.mockReset();
  get.mockReset();
  managementLoader.mockReset();
  getAuth.mockResolvedValue({
    user: { id: "resident-a" },
    role: "user",
    accessToken: "ordinary-user-token",
  });
  get.mockResolvedValue({ data: residentAccess, response: new Response() });
});

it.each(["imports", "imports/batch-1"])(
  "denies a Crew bookmark to readings/%s before child loaders run",
  async (suffix) => {
    get.mockResolvedValue({
      data: {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [
          {
            ...crewEstateAccess,
            canViewReadings: true,
            canRecordReadings: true,
            canImportReadings: false,
            canRevertReadingImports: false,
          },
        ],
      },
      response: new Response(),
    });
    const router = routerFor(
      `/estates/${crewEstateAccess.estateId}/readings/${suffix}`
    );
    await router.load();
    expect(
      router.state.matches.some((match) => match.status === "notFound")
    ).toBe(true);
    expect(managementLoader).not.toHaveBeenCalled();
  }
);

it("denies a bookmarked manual-entry route when write capability is unavailable", async () => {
  get.mockResolvedValue({
    data: {
      ...unassignedAccess,
      canEnterWorkspace: true,
      estates: [
        {
          ...crewEstateAccess,
          canViewReadings: true,
          canRecordReadings: false,
        },
      ],
    },
    response: new Response(),
  });
  const router = routerFor(
    `/estates/${crewEstateAccess.estateId}/readings/new`
  );
  await router.load();
  expect(
    router.state.matches.some((match) => match.status === "notFound")
  ).toBe(true);
  expect(managementLoader).not.toHaveBeenCalled();
});

it.each([crewEstateAccess, { ...ownerEstateAccess, canViewAssets: false }])(
  "allows an estate readings reader without owner-only asset access: $role",
  async (estate) => {
    get.mockResolvedValue({
      data: {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [{ ...estate, canViewReadings: true }],
      },
      response: new Response(),
    });
    const path = `/estates/${estate.estateId}/readings`;
    const router = routerFor(path);
    await router.load();
    expect(
      router.state.matches.some((match) => match.status === "notFound")
    ).toBe(false);
    renderWithProviders(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Management page" });
  }
);

it.each([
  residentAccess,
  unassignedAccess,
  {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: [{ ...councilEstateAccess, canViewReadings: false }],
  },
])(
  "hides unauthorized readings URLs before loaders without redirecting to reporting: %j",
  async (access) => {
    get.mockResolvedValue({ data: access, response: new Response() });
    const estateId = access.estates[0]?.estateId ?? "foreign";
    const path = `/estates/${estateId}/readings`;
    const router = routerFor(path);
    await router.load();
    expect(router.state.location.pathname).toBe(path);
    expect(
      router.state.matches.some((match) => match.status === "notFound")
    ).toBe(true);
    expect(managementLoader).not.toHaveBeenCalled();
  }
);

it.each(
  [residentAccess, mixedAccess, unassignedAccess].flatMap((access) =>
    ["", "/new", "/saved"].map((suffix) => ({ access, suffix }))
  )
)(
  "hides unauthorized work-order deep links rather than redirecting to reporting: %j",
  async ({ access, suffix }) => {
    get.mockResolvedValue({ data: access, response: new Response() });
    const path = `/estates/maple/work-orders${suffix}`;
    const router = routerFor(path);
    await router.load();
    expect(router.state.location.pathname).toBe(path);
    expect(
      router.state.matches.some((match) => match.status === "notFound")
    ).toBe(true);
    expect(managementLoader).not.toHaveBeenCalled();
  }
);

it.each(["/estates/oak/work-orders", "/estates/oak/work-orders/saved"])(
  "lets Crew read %s before the management guard",
  async (path) => {
    get.mockResolvedValue({
      data: {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [crewEstateAccess],
      },
      response: new Response(),
    });
    const router = routerFor(path);
    renderWithProviders(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Management page" });
  }
);
it("blocks Crew direct work-order creation before the child loader starts", async () => {
  get.mockResolvedValue({
    data: {
      ...unassignedAccess,
      canEnterWorkspace: true,
      estates: [crewEstateAccess],
    },
    response: new Response(),
  });
  const router = routerFor("/estates/oak/work-orders/new");
  await router.load();
  expect(
    router.state.matches.some((match) => match.status === "notFound")
  ).toBe(true);
  expect(managementLoader).not.toHaveBeenCalled();
});

it.each([
  "/estates/oak",
  "/estates/oak/assets",
  "/estates/oak/assets/pump",
  "/estates/oak/assets/pump/inspections/new",
  "/estates/oak/assets/pump/inspections/saved",
])(
  "admits Crew inspection and estate read route %s without management access",
  async (path) => {
    get.mockResolvedValue({
      data: {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [crewEstateAccess],
      },
      response: new Response(),
    });
    const router = routerFor(path);
    await router.load();
    renderWithProviders(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Management page" });
    expect(router.state.location.pathname).toBe(path);
  }
);

it.each([
  "/estates/oak/edit",
  "/estates/oak/council",
  "/estates/oak/assets/new",
  "/estates/oak/assets/pump/edit",
  "/estates/oak/assets/pump/readings",
])(
  "keeps Crew out of administrative route %s before its loader starts",
  async (path) => {
    get.mockResolvedValue({
      data: {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [crewEstateAccess],
      },
      response: new Response(),
    });
    const router = routerFor(path);
    await router.load();
    expect(managementLoader).not.toHaveBeenCalled();
  }
);

it.each(["oak", "foreign"])(
  "requires inspection creation capability in the requested estate %s",
  async (estateId) => {
    get.mockResolvedValue({
      data: {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [{ ...crewEstateAccess, canCreateInspectionResults: false }],
      },
      response: new Response(),
    });
    const router = routerFor(
      `/estates/${estateId}/assets/pump/inspections/new`
    );
    await router.load();
    expect(managementLoader).not.toHaveBeenCalled();
  }
);

it("allows inactive-estate inspection history while denying result creation", async () => {
  get.mockResolvedValue({
    data: {
      ...unassignedAccess,
      canEnterWorkspace: true,
      estates: [
        {
          ...crewEstateAccess,
          canCreateInspectionResults: false,
          canCreateWorkOrders: false,
        },
      ],
    },
    response: new Response(),
  });
  const router = routerFor("/estates/oak/assets/pump/inspections/saved");
  await router.load();
  renderWithProviders(<RouterProvider router={router} />);
  await screen.findByRole("heading", { name: "Management page" });
});

it.each(["/estates/maple", "/estates/maple/assets", "/estates/maple/council"])(
  "redirects database resident-only access from %s before its child loader runs",
  async (path) => {
    const router = routerFor(path);
    await router.load();
    expect(router.state.location.pathname).toBe("/reports/new");
    expect(managementLoader).not.toHaveBeenCalled();
  }
);

it.each(["/estates/oak", "/estates/oak/council", "/estates/pine/assets"])(
  "keeps an authorized mixed-role deep link %s even with a stale WorkOS resident claim",
  async (path) => {
    getAuth.mockResolvedValue({
      user: { id: "mixed-user" },
      role: "resident",
      accessToken: "stale-role-token",
    });
    get.mockResolvedValue({ data: mixedAccess, response: new Response() });
    const router = routerFor(path);
    await router.load();
    renderWithProviders(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Management page" });
    expect(router.state.location.pathname).toBe(path);
  }
);

it("redirects a mixed-role user away from their resident estate while keeping management access elsewhere", async () => {
  get.mockResolvedValue({ data: mixedAccess, response: new Response() });
  const router = routerFor("/estates/maple/assets");
  await router.load();
  expect(router.state.location.pathname).toBe("/reports/new");
  expect(managementLoader).not.toHaveBeenCalled();
});

it("does not let council access start an owner-only asset screen", async () => {
  get.mockResolvedValue({ data: mixedAccess, response: new Response() });
  const router = routerFor("/estates/oak/assets");
  await router.load();
  expect(managementLoader).not.toHaveBeenCalled();
});

it("waits for access in beforeLoad before any management child loader starts", async () => {
  let finish: (() => void) | undefined;
  get.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () =>
          resolve({ data: residentAccess, response: new Response() });
      })
  );
  const router = routerFor("/estates/maple/assets");
  const loading = router.load();
  try {
    await waitFor(() =>
      expect(get.mock.calls.some(([path]) => path === "/access/context")).toBe(
        true
      )
    );
    expect(managementLoader).not.toHaveBeenCalled();
  } finally {
    finish?.();
    await loading;
  }
  expect(router.state.location.pathname).toBe("/reports/new");
});

it("does not start a management child loader when access lookup fails", async () => {
  get.mockResolvedValue({
    error: { message: "Access unavailable" },
    response: new Response(null, { status: 503 }),
  });
  const router = routerFor("/estates/pine/assets");
  await router.load();
  expect(managementLoader).not.toHaveBeenCalled();
});

it("does not start an existing estate screen for an unassigned account", async () => {
  get.mockResolvedValue({ data: unassignedAccess, response: new Response() });
  const router = routerFor("/estates/private-estate");
  await router.load();
  expect(managementLoader).not.toHaveBeenCalled();
});

it.each(
  [
    { account: "unassigned", access: unassignedAccess },
    { account: "Resident", access: residentAccess },
    {
      account: "Crew",
      access: {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [crewEstateAccess],
      },
    },
    {
      account: "Council",
      access: {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [councilEstateAccess],
      },
    },
  ].flatMap((account) =>
    ["/estates", "/estates/", "/estates/new", "/estates/new/"].map((path) => ({
      ...account,
      path,
    }))
  )
)("allows a $account account to open $path", async ({ access, path }) => {
  get.mockResolvedValue({ data: access, response: new Response() });
  const router = routerFor(path);
  await router.load();
  renderWithProviders(<RouterProvider router={router} />);
  await screen.findByRole("heading", { name: "Management page" });
  expect(router.state.location.pathname).toBe(path);
  expect(managementLoader).toHaveBeenCalled();
});

it.each(["/estates/new", "/estates/new/"])(
  "does not bypass a denied creation capability at %s",
  async (path) => {
    get.mockResolvedValue({
      data: { ...mixedAccess, canCreateEstate: false },
      response: new Response(),
    });
    const router = routerFor(path);
    await router.load();
    expect(managementLoader).not.toHaveBeenCalled();
  }
);

it.each(["/estates", "/estates/new"])(
  "does not start %s when the access lookup fails",
  async (path) => {
    get.mockResolvedValue({
      error: { message: "Access unavailable" },
      response: new Response(null, { status: 503 }),
    });
    const router = routerFor(path);
    await router.load();
    expect(managementLoader).not.toHaveBeenCalled();
  }
);

it.each(["/reports", "/reports/report-1", "/reports/new"])(
  "allows authenticated reporting route %s after the membership row is deleted",
  async (path) => {
    get.mockResolvedValue({ data: unassignedAccess, response: new Response() });
    const router = routerFor(path);
    await router.load();
    renderWithProviders(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Reporting page" });
    expect(router.state.location.pathname).toBe(path);
  }
);

it("keeps platform admin entry independent of residency in another estate", async () => {
  getAuth.mockResolvedValue({
    user: { id: "platform-admin" },
    role: "admin",
    accessToken: "admin-token",
  });
  get.mockResolvedValue({
    data: { ...mixedAccess, canAccessPlatformAdmin: true },
    response: new Response(),
  });
  const router = routerFor("/admin/users");
  await router.load();
  renderWithProviders(<RouterProvider router={router} />);
  await screen.findByRole("heading", { name: "Management page" });
});

it("allows an unassigned account to open invitations without workspace access", async () => {
  get.mockResolvedValue({ data: unassignedAccess, response: new Response() });
  const router = routerFor("/invitations");
  await router.load();
  expect(router.state.location.pathname).toBe("/invitations");
  renderWithProviders(<RouterProvider router={router} />);
  await screen.findByRole("heading", { name: "Management page" });
});

it.each([ownerEstateAccess, crewEstateAccess])(
  "allows a $role responder to open report detail without general management permission",
  async (permission) => {
    get.mockResolvedValue({
      data: {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [{ ...permission, estateId: "oak" }],
      },
      response: new Response(),
    });
    const router = routerFor("/estates/oak/reports/report-1");
    await router.load();
    renderWithProviders(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Management page" });
    expect(managementLoader).toHaveBeenCalled();
  }
);

it.each(["/estates/oak/reports", "/estates/oak/reports/report-1"])(
  "blocks council report route %s before any child query loader starts",
  async (path) => {
    get.mockResolvedValue({ data: mixedAccess, response: new Response() });
    const router = routerFor(path);
    await router.load();
    expect(managementLoader).not.toHaveBeenCalled();
  }
);

it("uses the requested estate's report capability rather than manager rights in another estate", async () => {
  get.mockResolvedValue({
    data: {
      ...mixedAccess,
      estates: mixedAccess.estates.map((estate) => ({
        ...estate,
        canViewFaultReports: estate.estateId === "pine",
      })),
    },
    response: new Response(),
  });
  const router = routerFor("/estates/oak/reports");
  await router.load();
  expect(managementLoader).not.toHaveBeenCalled();
});

it("does not let a WorkOS admin claim bypass a missing report capability", async () => {
  getAuth.mockResolvedValue({
    user: { id: "platform-admin" },
    role: "admin",
    accessToken: "admin-token",
  });
  get.mockResolvedValue({
    data: {
      ...mixedAccess,
      canAccessPlatformAdmin: true,
      estates: mixedAccess.estates.map((estate) => ({
        ...estate,
        canViewFaultReports: false,
      })),
    },
    response: new Response(),
  });
  const router = routerFor("/estates/pine/reports/report-1");
  await router.load();
  expect(managementLoader).not.toHaveBeenCalled();
});

const OWNER_GATED = [
  "/estates/oak/devices",
  "/estates/oak/asset-categories",
  "/estates/oak/inspections",
  "/estates/oak/sensors",
  "/estates/oak/sensors/all",
  "/estates/oak/asset-categories/months",
  "/estates/oak/failure-risk",
  "/estates/oak/edit",
  "/estates/oak/assets",
];
const managementOnly = {
  ...councilEstateAccess,
  role: "MEMBER",
  canViewManagement: true,
  canViewAssets: false,
  canViewInspectionResults: false,
  canManageEstate: false,
  canManageInvitationPermissions: false,
};
function estateAccess(
  estate: typeof managementOnly,
  owned: boolean | "error" = false
) {
  get.mockImplementation((path: string) => {
    if (path === "/estates/{id}") {
      return Promise.resolve(
        owned === "error"
          ? {
              error: { message: "Forbidden" },
              response: new Response(null, { status: 403 }),
            }
          : {
              data: { id: estate.estateId, name: estate.estateName, owned },
              response: new Response(),
            }
      );
    }
    return Promise.resolve({
      data: { ...unassignedAccess, canEnterWorkspace: true, estates: [estate] },
      response: new Response(),
    });
  });
}

it.each(OWNER_GATED)(
  "404s %s for a management-only non-owner",
  async (path) => {
    estateAccess(managementOnly);
    const router = routerFor(path);
    await router.load();
    expect(
      router.state.matches.some((match) => match.status === "notFound")
    ).toBe(true);
    expect(managementLoader).not.toHaveBeenCalled();
  }
);

it.each([
  "/estates/oak/assets",
  "/estates/oak/assets/pump",
  "/estates/oak/assets/pump/history",
])(
  "opens $path for Council history readers without fetching owner-only context",
  async (path) => {
    estateAccess(
      { ...managementOnly, role: "COUNCIL", canViewAssetHistory: true },
      false
    );
    const router = routerFor(path);
    await router.load();
    renderWithProviders(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Management page" });
    expect(get).not.toHaveBeenCalledWith("/estates/{id}", expect.anything());
  }
);

it.each([
  "/estates/oak/assets/new",
  "/estates/oak/assets/pump/edit",
  "/estates/oak/assets/pump/maintenance",
  "/estates/oak/assets/pump/documents",
])("keeps $path private for Council history readers", async (path) => {
  estateAccess(
    { ...managementOnly, role: "COUNCIL", canViewAssetHistory: true },
    false
  );
  const router = routerFor(path);
  await router.load();
  expect(managementLoader).not.toHaveBeenCalled();
});

it.each(OWNER_GATED)("404s %s when the owner lookup fails", async (path) => {
  estateAccess(managementOnly, "error");
  const router = routerFor(path);
  await router.load();
  expect(managementLoader).not.toHaveBeenCalled();
});

it.each([
  ...OWNER_GATED.filter((path) => !path.endsWith("/assets")).map((path) => ({
    path,
    estate: managementOnly,
    owned: true,
  })),
  ...[
    "/estates/oak/devices",
    "/estates/oak/asset-categories",
    "/estates/oak/inspections",
  ].map((path) => ({
    path,
    estate: { ...managementOnly, canManageInvitationPermissions: true },
    owned: false,
  })),
  {
    path: "/estates/oak/sensors",
    estate: { ...managementOnly, role: "COUNCIL" },
    owned: false,
  },
  {
    path: "/estates/oak/edit",
    estate: { ...managementOnly, canManageEstate: true },
    owned: false,
  },
  {
    path: "/estates/oak/assets",
    estate: { ...managementOnly, canViewAssets: true },
    owned: false,
  },
])(
  "opens $path when its destination predicate holds",
  async ({ path, estate, owned }) => {
    estateAccess(estate, owned);
    const router = routerFor(path);
    await router.load();
    renderWithProviders(<RouterProvider router={router} />);
    await screen.findByRole("heading", { name: "Management page" });
  }
);
