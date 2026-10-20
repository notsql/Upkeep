import {
  mixedAccess,
  residentAccess,
  unassignedAccess,
  workspaceAccess,
} from "@tests/fixtures/access";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import Header from "@/components/header";
import { api } from "@/lib/api";
import { HomePage } from "@/routes/-components/home-page";

let access:
  | typeof mixedAccess
  | typeof workspaceAccess
  | typeof unassignedAccess = workspaceAccess;

const CREATE_ACCOUNT = /^(Register|Create account)$/;

const { auth } = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, role: "user", loading: false },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => auth,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params: _params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: unknown;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api", () => ({
  api: {
    GET: vi.fn().mockResolvedValue({ data: { ok: true, database: true } }),
  },
}));

beforeEach(() => {
  access = workspaceAccess;
  vi.mocked(api.GET).mockClear();
  auth.user = null;
  auth.loading = false;
  auth.role = "user";
  vi.mocked(api.GET).mockImplementation((path: string) => {
    const responses: Record<string, unknown> = {
      "/access/context": access,
      "/health": { ok: true, database: true },
      "/dashboard/summary": {
        accessibleEstateCount: 0,
        activeEstateCount: 0,
        inactiveEstateCount: 0,
        activeOwnedEstateCount: 0,
        totalActiveAssets: 0,
        councilMemberCount: 0,
        conditionCounts: {
          good: 0,
          needsAttention: 0,
          faulty: 0,
          unassessed: 0,
        },
        affectedEstateCount: 0,
        estatesNeedingAttention: [],
      },
    };
    return Promise.resolve({
      data: responses[path] ?? [],
      response: new Response(),
    }) as never;
  });
});
it("never loads the management dashboard for database resident-only access with an ordinary WorkOS role", async () => {
  auth.user = { id: "resident-a" };
  auth.role = "user";
  access = residentAccess;
  renderWithProviders(<HomePage />);

  await screen.findByRole("link", { name: "Report a fault" });

  const calls = vi.mocked(api.GET).mock.calls as unknown[][];
  expect(calls.some((call) => call[0] === "/dashboard/summary")).toBe(false);
  expect(screen.queryByRole("link", { name: "Accessible estates" })).toBeNull();
});

it("does not start management queries while estate access is being resolved", () => {
  auth.user = { id: "resident-a" };
  vi.mocked(api.GET).mockImplementation(
    (() => new Promise(() => undefined)) as never
  );
  renderWithProviders(<HomePage />);
  expect(
    vi
      .mocked(api.GET)
      .mock.calls.some((call) => call[0] === "/dashboard/summary")
  ).toBe(false);
  expect(screen.queryByRole("link", { name: "Accessible estates" })).toBeNull();
});

it("offers an unassigned account its first estate without loading estate management data", async () => {
  auth.user = { id: "unassigned" };
  access = unassignedAccess;
  renderWithProviders(<HomePage />);
  expect(
    (await screen.findByRole("link", { name: "Create estate" })).getAttribute(
      "href"
    )
  ).toBe("/estates/new");
  expect(
    vi
      .mocked(api.GET)
      .mock.calls.some((call) => call[0] === "/dashboard/summary")
  ).toBe(false);
  expect(screen.queryByRole("link", { name: "Accessible estates" })).toBeNull();
});
it("offers one account-creation action and consistent Sign in labels across the home page", () => {
  renderWithProviders(
    <>
      <Header />
      <HomePage />
    </>
  );
  screen.getByRole("heading", { name: "Your estate workspace", level: 1 });
  expect(
    within(screen.getByRole("main")).getByRole<HTMLAnchorElement>("link", {
      name: "Sign in",
    }).href
  ).toContain("/api/auth/sign-in");
  screen.getByRole("link", { name: "Create account" });
  expect(screen.getAllByRole("link", { name: CREATE_ACCOUNT })).toHaveLength(1);
  expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  expect(screen.getAllByRole("link", { name: "Sign in" })).toHaveLength(2);
});
it.each(["user", "resident"])(
  "lets a mixed estate-role account load its management dashboard despite WorkOS role %s",
  async (role) => {
    auth.user = { id: "owner" };
    auth.role = role;
    access = mixedAccess;
    vi.mocked(api.GET).mockImplementation((path: string) => {
      const responses: Record<string, unknown> = {
        "/access/context": access,
        "/dashboard/summary": {
          accessibleEstateCount: 1,
          activeEstateCount: 1,
          inactiveEstateCount: 0,
          activeOwnedEstateCount: 1,
          totalActiveAssets: 0,
          councilMemberCount: 0,
          conditionCounts: {
            good: 0,
            needsAttention: 0,
            faulty: 0,
            unassessed: 0,
          },
          affectedEstateCount: 0,
          estatesNeedingAttention: [],
        },
      };
      return Promise.resolve({
        data: responses[path] ?? [],
        response: new Response(),
      }) as never;
    });
    renderWithProviders(<HomePage />);
    await screen.findByRole("link", { name: "Accessible estates" });
    expect(screen.queryByRole("link", { name: "Browse estates" })).toBeNull();
    screen.getByRole("link", { name: "Accessible estates" });
    expect(screen.queryByRole("link", { name: "Create account" })).toBeNull();
  }
);
