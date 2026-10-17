import { QueryClient } from "@tanstack/react-query";
import { mixedAccess, residentAccess } from "@tests/fixtures/access";
import { beforeEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/index";

const { getAuth, get } = vi.hoisted(() => ({ getAuth: vi.fn(), get: vi.fn() }));
vi.mock("@workos/authkit-tanstack-react-start", () => ({ getAuth }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
vi.mock("@/lib/api", () => ({ api: { GET: get } }));
vi.mock("@proj/api", () => ({ createApiClient: () => ({ GET: get }) }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (handler: () => unknown) => handler }),
}));

async function enterHome() {
  const entry = (Route.options.beforeLoad ?? Route.options.loader) as (
    context: unknown
  ) => Promise<unknown>;
  return await entry({
    location: { href: "/", pathname: "/" },
    context: { queryClient: new QueryClient() },
  });
}

beforeEach(() => {
  getAuth.mockReset();
  get.mockReset();
  getAuth.mockResolvedValue({
    user: { id: "resident-a" },
    role: "user",
    accessToken: "user-token",
  });
  get.mockResolvedValue({ data: residentAccess, response: new Response() });
});

it("lands a database resident-only account on reporting without a WorkOS resident claim", async () => {
  await expect(enterHome()).rejects.toMatchObject({
    options: { href: "/reports/new" },
  });
});

it("lets a mixed-role account enter Home despite a WorkOS resident claim", async () => {
  getAuth.mockResolvedValue({
    user: { id: "mixed-user" },
    role: "resident",
    accessToken: "stale-token",
  });
  get.mockResolvedValue({ data: mixedAccess, response: new Response() });
  await enterHome();
  expect(get.mock.calls.some(([path]) => path === "/access/context")).toBe(
    true
  );
});

it("does not grant workspace entry when the database access lookup fails", async () => {
  get.mockResolvedValue({
    error: { message: "Access unavailable" },
    response: new Response(null, { status: 503 }),
  });
  await expect(enterHome()).rejects.toBeDefined();
});

it("keeps the public home available without trying to resolve estate roles for an anonymous visitor", async () => {
  getAuth.mockResolvedValue({ user: null });
  await enterHome();
  expect(get).not.toHaveBeenCalled();
});
