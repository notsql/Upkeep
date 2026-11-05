import { renderWithProviders, screen, within } from "@tests/test-utils";
import { Wrench } from "lucide-react";
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

it("shows a decorative icon beside the title when given one", () => {
  renderWithProviders(<PageHeader icon={Wrench} title="Work orders" />);
  const heading = screen.getByRole("heading", {
    name: "Work orders",
    level: 1,
  });
  expect(
    heading.parentElement?.querySelector("svg[aria-hidden='true']")
  ).not.toBeNull();
});

it("links estate section roots such as roles and council", () => {
  renderWithProviders(
    <PageHeader
      breadcrumbs={[
        {
          label: "Roles",
          params: { estateId: "e1" },
          to: "/estates/$estateId/roles",
        },
        {
          label: "Members",
          params: { estateId: "e1" },
          to: "/estates/$estateId/council",
        },
        { label: "New role" },
      ]}
      title="New role"
    />
  );
  screen.getByRole("link", { name: "Roles" });
  screen.getByRole("link", { name: "Members" });
});
