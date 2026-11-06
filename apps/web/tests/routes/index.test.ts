import { QueryClient } from "@tanstack/react-query";
import {
  councilEstateAccess,
  mixedAccess,
  ownerEstateAccess,
  residentAccess,
  unassignedAccess,
  workspaceAccess,
} from "@tests/fixtures/access";
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
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (handler: () => unknown) => handler,
    };
    return builder;
  },
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

it("renders the resident dashboard at / for a resident-only account instead of redirecting", async () => {
  await expect(enterHome()).resolves.toBeUndefined();
});

it("sends a mixed-role account with several estates to the estate list", async () => {
  getAuth.mockResolvedValue({
    user: { id: "mixed-user" },
    role: "resident",
    accessToken: "stale-token",
  });
  get.mockResolvedValue({ data: mixedAccess, response: new Response() });
  await expect(enterHome()).rejects.toMatchObject({
    options: { href: "/estates" },
  });
  expect(get.mock.calls.some(([path]) => path === "/access/context")).toBe(
    true
  );
});

it("sends an account with exactly one estate membership straight to that estate", async () => {
  get.mockResolvedValue({
    data: { ...workspaceAccess, estates: [ownerEstateAccess] },
    response: new Response(),
  });
  await expect(enterHome()).rejects.toMatchObject({
    options: { href: "/estates/pine" },
  });
});

it("sends an account with two or more estates to the estate list", async () => {
  get.mockResolvedValue({
    data: {
      ...workspaceAccess,
      estates: [ownerEstateAccess, councilEstateAccess],
    },
    response: new Response(),
  });
  await expect(enterHome()).rejects.toMatchObject({
    options: { href: "/estates" },
  });
});

it("sends an account with no estates to the estate list", async () => {
  get.mockResolvedValue({ data: unassignedAccess, response: new Response() });
  await expect(enterHome()).rejects.toMatchObject({
    options: { href: "/estates" },
  });
});

it("keeps the roles-only redirect", async () => {
  get.mockResolvedValue({
    data: {
      ...workspaceAccess,
      estates: [
        {
          ...councilEstateAccess,
          canViewManagement: false,
          canViewEstateDetails: false,
          canViewEstateRoles: true,
        },
        { ...councilEstateAccess, estateId: "elm", canViewManagement: false },
      ],
    },
    response: new Response(),
  });
  await expect(enterHome()).rejects.toMatchObject({
    options: { href: "/estates/oak/roles" },
  });
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
