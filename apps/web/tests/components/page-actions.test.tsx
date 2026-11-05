import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { CreateButton, FilterToggle } from "@/components/page-actions";

async function renderInRouter(ui: ReactNode) {
  const root = createRootRoute({ component: () => ui });
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: "/" }),
    ]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  renderWithProviders(<RouterProvider router={router} />);
  await screen.findByRole("link", { name: "Create" });
}

it("renders Create as a link when given a destination", async () => {
  await renderInRouter(
    <CreateButton
      params={{ estateId: "e1" }}
      to="/estates/$estateId/work-orders/new"
    />
  );
  expect(
    screen.getByRole("link", { name: "Create" }).getAttribute("href")
  ).toBe("/estates/e1/work-orders/new");
});

it("renders Create as a button when given onClick", () => {
  const onClick = vi.fn();
  renderWithProviders(<CreateButton onClick={onClick} />);
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  expect(onClick).toHaveBeenCalledOnce();
});

it("toggles the filter panel and reports its state", () => {
  const onToggle = vi.fn();
  renderWithProviders(
    <FilterToggle
      activeCount={2}
      controls="filters"
      expanded={false}
      onToggle={onToggle}
    />
  );
  const toggle = screen.getByRole("button", { name: "Filters, 2 active" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(toggle.getAttribute("aria-controls")).toBe("filters");
  fireEvent.click(toggle);
  expect(onToggle).toHaveBeenCalledOnce();
});

it("names the toggle plainly when no filter is active", () => {
  renderWithProviders(
    <FilterToggle activeCount={0} controls="f" expanded onToggle={vi.fn()} />
  );
  expect(
    screen
      .getByRole("button", { name: "Filters" })
      .getAttribute("aria-expanded")
  ).toBe("true");
});

it("gives the Create button an id for focus return", () => {
  renderWithProviders(<CreateButton id="add-block" onClick={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Create" }).id).toBe("add-block");
});
