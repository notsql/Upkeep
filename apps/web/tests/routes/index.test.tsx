import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { crewEstateAccess, workspaceAccess } from "@tests/fixtures/access";
import { beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/index";

const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/access-server", () => ({ getSessionAccess: session }));

beforeEach(() => session.mockReset());

it("lands a Crew-only account on its assigned fault reports without management access", async () => {
  session.mockResolvedValue({
    user: { id: "crew" },
    access: {
      ...workspaceAccess,
      canCreateEstate: false,
      estates: [crewEstateAccess],
    },
  });
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: Outlet,
  });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    beforeLoad: async (context) => {
      const guard = Route.options.beforeLoad as
        | ((value: unknown) => unknown)
        | undefined;
      await guard?.(context);
    },
  });
  const reports = createRoute({
    getParentRoute: () => root,
    path: "/estates/$estateId/reports",
  });
  const router = createRouter({
    routeTree: root.addChildren([home, reports]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    context: { queryClient: new QueryClient() },
  });
  await router.load();
  expect(router.state.location.pathname).toBe("/estates/oak/reports");
});
