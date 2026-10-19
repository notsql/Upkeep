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
  mixedAccess,
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
  createServerFn: () => ({ handler: (handler: () => unknown) => handler }),
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
    "/estates",
    "/estates/$estateId",
    "/estates/$estateId/assets",
    "/estates/$estateId/council",
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

it.each([
  "/estates",
  "/estates/maple",
  "/estates/maple/assets",
  "/estates/maple/council",
])(
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

it("does not start estate management for an unassigned account", async () => {
  get.mockResolvedValue({ data: unassignedAccess, response: new Response() });
  const router = routerFor("/estates");
  await router.load();
  expect(managementLoader).not.toHaveBeenCalled();
});

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
