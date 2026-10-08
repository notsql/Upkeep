import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import Header from "@/components/header";
import { api } from "@/lib/api";
import { HomePage } from "@/routes/-components/home-page";
import { renderWithProviders, screen, within } from "../../test-utils";

const CREATE_ACCOUNT = /^(Register|Create account)$/;

const { auth } = vi.hoisted(() => ({
  auth: { user: null as { id: string } | null, loading: false },
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
  auth.user = null;
  auth.loading = false;
  vi.mocked(api.GET).mockImplementation(
    async (path) =>
      ({
        data: path === "/health" ? { ok: true, database: true } : [],
        response: new Response(),
      }) as never
  );
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
it("gives signed-in users a clear route to Estates", async () => {
  auth.user = { id: "owner" };
  vi.mocked(api.GET).mockImplementation(
    async (path) =>
      ({
        data:
          path === "/dashboard/summary"
            ? {
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
              }
            : [],
        response: new Response(),
      }) as never
  );
  renderWithProviders(<HomePage />);
  await screen.findByRole("link", { name: "Accessible estates" });
  expect(screen.queryByRole("link", { name: "Browse estates" })).toBeNull();
  screen.getByRole("link", { name: "Accessible estates" });
  expect(screen.queryByRole("link", { name: "Create account" })).toBeNull();
});
