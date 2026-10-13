import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { PageHeader } from "@/components/page-header";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
it("provides a page heading, navigable breadcrumbs and primary action", () => {
  renderWithProviders(
    <PageHeader
      actions={<button type="button">Register asset</button>}
      breadcrumbs={[{ label: "Estates", to: "/estates" }, { label: "Assets" }]}
      description="Equipment in this estate"
      title="Assets"
    />
  );
  screen.getByRole("heading", { name: "Assets", level: 1 });
  expect(
    within(
      screen.getByRole("navigation", { name: "Breadcrumbs" })
    ).getByRole<HTMLAnchorElement>("link", { name: "Estates" }).href
  ).toContain("/estates");
  screen.getByRole("button", { name: "Register asset" });
});
