import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import Header from "@/components/header";
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
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/api", () => ({
  api: {
    GET: vi.fn().mockResolvedValue({ data: { ok: true, database: true } }),
  },
}));
vi.mock("@/components/estates/estate-switcher", () => ({
  EstateSwitcher: () => null,
}));
beforeEach(() => {
  auth.user = null;
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
it("gives signed-in users a clear route to Estates", () => {
  auth.user = { id: "owner" };
  renderWithProviders(<HomePage />);
  screen.getByRole("link", { name: "Go to Estates" });
  expect(screen.queryByRole("link", { name: "Create account" })).toBeNull();
});
