import { fireEvent } from "@testing-library/react";
import { ownerEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Location } from "@/lib/locations";
import { LocationsSection } from "@/routes/_auth/estates/$estateId/-components/locations-section/locations-section";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const at = "2026-09-27T00:00:00Z";
const locations: Location[] = [
  { id: "b1", type: "BLOCK", name: "Blk 101", createdAt: at, updatedAt: at },
  {
    id: "l1",
    type: "LEVEL",
    name: "Level 1",
    parentId: "b1",
    sortOrder: 1,
    createdAt: at,
    updatedAt: at,
  },
];

function pressed(name: string): string | null {
  return screen.getByRole("button", { name }).getAttribute("aria-pressed");
}

describe("locations view toggle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const data: Record<string, unknown> = {
      "/access/context": {
        ...unassignedAccess,
        estates: [{ ...ownerEstateAccess, estateId: "estate-id" }],
      },
      "/estates/{id}": {
        id: "estate-id",
        name: "Maple Grove",
        owned: true,
        createdAt: at,
        updatedAt: at,
      },
    };
    vi.mocked(api.GET).mockImplementation(((url: string) =>
      Promise.resolve({
        data: data[url] ?? locations,
        response: new Response(),
      })) as never);
  });

  it("opens on the building view and switches to the tree", async () => {
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    await screen.findByRole("list", { name: "Blk 101 floors" });
    screen.getByRole("group", { name: "View" });
    expect(pressed("Building")).toBe("true");
    expect(
      screen.queryByRole("list", { name: "Location hierarchy" })
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tree" }));
    await screen.findByRole("list", { name: "Location hierarchy" });
    expect(screen.queryByRole("list", { name: "Blk 101 floors" })).toBeNull();
  });

  it("shows the tree while searching and restores the view after", async () => {
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    await screen.findByRole("list", { name: "Blk 101 floors" });
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    fireEvent.change(
      await screen.findByRole("searchbox", { name: "Search locations" }),
      { target: { value: "Level" } }
    );
    await screen.findByRole("list", { name: "Search results" });
    expect(
      screen
        .getByRole("button", { name: "Building" })
        .hasAttribute("disabled") ||
        screen
          .getByRole("button", { name: "Building" })
          .getAttribute("aria-disabled") === "true"
    ).toBe(true);
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search locations" }),
      {
        target: { value: "" },
      }
    );
    await waitFor(() => screen.getByRole("list", { name: "Blk 101 floors" }));
  });

  it("names the section without a visible heading", async () => {
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    await screen.findByRole("list", { name: "Blk 101 floors" });
    screen.getByRole("region", { name: "Blocks and levels" });
    expect(
      screen.queryByRole("heading", { name: "Blocks and levels" })
    ).toBeNull();
  });
});
