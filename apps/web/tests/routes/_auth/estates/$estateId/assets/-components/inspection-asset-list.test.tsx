import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { InspectionAssetList } from "@/routes/_auth/estates/$estateId/assets/-components/inspection-asset-list";

const state = vi.hoisted(() => ({
  cursors: [] as (string | undefined)[],
  nextCursor: null as string | null,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/inspections", () => ({
  useInspectionAccess: () => ({ pending: false, canView: true }),
  useInspectionAssets: (_estate: string, _query: string, cursor?: string) => {
    state.cursors.push(cursor);
    return {
      data: {
        items: [
          {
            id: "a",
            reference: "E-A0001",
            name: "Water pump",
            locationPath: "Block A",
            assetActive: true,
            estateActive: true,
            locationActive: true,
          },
        ],
        nextCursor: state.nextCursor,
      },
      refetch: vi.fn(),
    };
  },
}));

beforeEach(() => {
  state.cursors = [];
  state.nextCursor = "next";
});

it("keeps the search behind a Filters toggle in the list header", () => {
  renderWithProviders(<InspectionAssetList estateId="estate" />);
  screen.getByRole("heading", { level: 1, name: "Assets" });
  const toggle = screen.getByRole("button", { name: "Filters" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("textbox", { name: "Search assets" })).toBeNull();
  fireEvent.click(toggle);
  screen.getByRole("searchbox", { name: "Search assets" });
});

it("pages with Previous page and Next page", () => {
  renderWithProviders(<InspectionAssetList estateId="estate" />);
  const nav = screen.getByRole("navigation", { name: "Asset pages" });
  const previous = screen.getByRole<HTMLButtonElement>("button", {
    name: "Previous page",
  });
  expect(previous.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(state.cursors.at(-1)).toBe("next");
  fireEvent.click(previous);
  expect(state.cursors.at(-1)).toBeUndefined();
  expect(nav).toBeTruthy();
});
