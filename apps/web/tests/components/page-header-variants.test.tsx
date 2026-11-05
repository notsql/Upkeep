import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import {
  DetailPageHeader,
  FormPageHeader,
  ListPageHeader,
} from "@/components/page-header";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

it("list header: icon, title, description, then Filters and Create in order", () => {
  const onToggle = vi.fn();
  renderWithProviders(
    <ListPageHeader
      create={{
        to: "/estates/$estateId/work-orders/new",
        params: { estateId: "e1" },
      }}
      description="Repairs in progress"
      filters={{ activeCount: 1, controls: "f", expanded: true, onToggle }}
      icon={Wrench}
      title="Work orders"
    />
  );
  const header = screen.getByRole("banner");
  within(header).getByRole("heading", { level: 1, name: "Work orders" });
  within(header).getByText("Repairs in progress");
  const toggle = within(header).getByRole("button", {
    name: "Filters, 1 active",
  });
  within(header).getByRole("link", { name: "Create" });
  const text = header.textContent ?? "";
  expect(text.indexOf("Filters")).toBeLessThan(text.indexOf("Create"));
  fireEvent.click(toggle);
  expect(onToggle).toHaveBeenCalledOnce();
});

it("list header omits actions it is not given", () => {
  renderWithProviders(<ListPageHeader title="Devices" />);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("link")).toBeNull();
});

it("detail header: breadcrumbs, title, status, meta and actions", () => {
  renderWithProviders(
    <DetailPageHeader
      actions={<button type="button">Edit</button>}
      breadcrumbs={[
        {
          label: "Work orders",
          to: "/estates/$estateId/work-orders",
          params: { estateId: "e1" },
        },
        { label: "WO-12" },
      ]}
      meta="Opened 3 Mar 2026 · Pump A"
      status={<span>Open</span>}
      title="WO-12"
    />
  );
  within(screen.getByRole("navigation", { name: "Breadcrumbs" })).getByRole(
    "link",
    { name: "Work orders" }
  );
  screen.getByRole("heading", { level: 1, name: "WO-12" });
  screen.getByText("Open");
  screen.getByText("Opened 3 Mar 2026 · Pump A");
  screen.getByRole("button", { name: "Edit" });
});

it("form header: breadcrumbs, title and description, no actions", () => {
  renderWithProviders(
    <FormPageHeader
      breadcrumbs={[
        { label: "Estates", to: "/estates" },
        { label: "Create estate" },
      ]}
      description="Name and address"
      title="Create estate"
    />
  );
  screen.getByRole("heading", { level: 1, name: "Create estate" });
  screen.getByText("Name and address");
  screen.getByRole("link", { name: "Estates" });
});
