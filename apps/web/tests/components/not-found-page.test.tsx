import { renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { NotFoundPage } from "@/components/not-found-page";

const HOME_PATH = /\/$/;
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
it("explains a missing page and offers recovery navigation", () => {
  renderWithProviders(<NotFoundPage />);
  screen.getByRole("heading", { name: "Page not found", level: 1 });
  expect(
    screen.getByRole<HTMLAnchorElement>("link", { name: "Go to home" }).href
  ).toMatch(HOME_PATH);
});
