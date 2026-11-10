import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { ownerEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import { beforeEach, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

const { apiGet, access } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  access: { estate: {} as Record<string, unknown> },
}));

vi.mock("@/routes/__root", async () => {
  const { createRootRouteWithContext, Outlet } = await import(
    "@tanstack/react-router"
  );
  return {
    Route: createRootRouteWithContext<{ queryClient: QueryClient }>()({
      component: Outlet,
    }),
  };
});
vi.mock("@/lib/api", () => ({ api: { GET: apiGet } }));
vi.mock("@/lib/access-server", () => ({
  getSessionIdentity: () => Promise.resolve({ id: "caller" }),
  getSessionAccess: () =>
    Promise.resolve({
      user: { id: "caller" },
      access: {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [access.estate],
      },
    }),
  getSessionEstate: () =>
    Promise.resolve({ id: "oak", name: "Oak", owned: false }),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "caller" }, loading: false }),
}));

async function open(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient: new QueryClient() },
  });
  await router.load();
  return router;
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockReturnValue(new Promise(() => undefined));
  access.estate = { ...ownerEstateAccess, estateId: "oak" };
});

it.each([
  ["/estates/oak/asset-categories", "/estates/oak/inspections/schedules"],
  [
    "/estates/oak/asset-categories/days",
    "/estates/oak/inspections/schedules/days",
  ],
])("sends the old bookmark %s to %s", async (from, to) => {
  const router = await open(from);
  expect(router.state.location.pathname).toBe(to);
});

it("404s the old bookmark for someone who cannot open Inspections", async () => {
  access.estate = {
    ...ownerEstateAccess,
    estateId: "oak",
    role: "MEMBER",
    canManageInvitationPermissions: false,
  };
  const router = await open("/estates/oak/asset-categories");
  expect(router.state.location.pathname).toBe("/estates/oak/asset-categories");
  expect(
    router.state.matches.some((match) => match.status === "notFound")
  ).toBe(true);
});
