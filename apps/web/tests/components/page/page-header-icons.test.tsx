import { renderWithProviders, screen } from "@tests/test-utils";
import { Building2 } from "lucide-react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { DetailPageHeader } from "@/components/page/detail-page-header";
import { FormPageHeader } from "@/components/page/form-page-header";
import { ListPageHeader } from "@/components/page/list-page-header";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const crumbs = [{ label: "Estates", to: "/estates" as const }, { label: "X" }];

/** Icons in the title row (breadcrumb separators are svgs too, so scope it). */
function titleRowIcons(name: string): Element[] {
  const heading = screen.getByRole("heading", { level: 1, name });
  return [...(heading.parentElement?.querySelectorAll("svg") ?? [])];
}

it("detail header renders a decorative icon when given one", () => {
  renderWithProviders(
    <DetailPageHeader breadcrumbs={crumbs} icon={Building2} title="X" />
  );
  const icons = titleRowIcons("X");
  expect(icons).toHaveLength(1);
  expect(icons[0]?.getAttribute("aria-hidden")).toBe("true");
});

it("form header renders a decorative icon when given one", () => {
  renderWithProviders(
    <FormPageHeader breadcrumbs={crumbs} icon={Building2} title="X" />
  );
  const icons = titleRowIcons("X");
  expect(icons).toHaveLength(1);
  expect(icons[0]?.getAttribute("aria-hidden")).toBe("true");
});

it("list header renders a decorative icon when given one", () => {
  renderWithProviders(<ListPageHeader icon={Building2} title="Estates" />);
  const icons = titleRowIcons("Estates");
  expect(icons).toHaveLength(1);
  expect(icons[0]?.getAttribute("aria-hidden")).toBe("true");
});

it("headers without an icon still render their title and no icon", () => {
  renderWithProviders(
    <>
      <DetailPageHeader breadcrumbs={crumbs} title="Detail" />
      <FormPageHeader breadcrumbs={crumbs} title="Form" />
      <ListPageHeader title="List" />
    </>
  );
  for (const name of ["Detail", "Form", "List"]) {
    expect(titleRowIcons(name)).toHaveLength(0);
  }
});
