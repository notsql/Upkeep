import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Location } from "@/lib/locations";
import { LocationsSection } from "@/routes/_auth/estates/$estateId/-components/locations-section";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "../../../../../test-utils";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const at = "2026-09-27T00:00:00Z";
const estate = {
  id: "estate-id",
  name: "Maple Grove",
  code: "MG-001",
  address: "1 Grove Road",
  postalCode: "123456",
  createdAt: at,
  updatedAt: at,
};
function location(
  id: string,
  type: Location["type"],
  name: string,
  parentId?: string,
  sortOrder?: number
): Location {
  return { id, type, name, parentId, sortOrder, createdAt: at, updatedAt: at };
}
const locations: Location[] = [
  location("b1", "BLOCK", "Blk 101"),
  location("b2", "BLOCK", "Blk 102"),
  location("l1", "LEVEL", "Level 1", "b1", 1),
  location("l2", "LEVEL", "Level 2", "b1", 2),
  location("a1", "COMMON_AREA", "Lift lobby", "l1"),
];
const path = { params: { path: { estateId: "estate-id" } } };

function serve(options: { deactivatedAt?: string; items?: Location[] } = {}) {
  vi.mocked(api.GET).mockImplementation(((url: string) =>
    Promise.resolve({
      data:
        url === "/estates/{id}"
          ? { ...estate, deactivatedAt: options.deactivatedAt }
          : (options.items ?? locations),
      response: new Response(),
    })) as never);
}

function succeed(method: "POST" | "PATCH") {
  vi.mocked(api[method]).mockResolvedValue({
    data: locations[0],
    response: new Response(),
  } as never);
}

function fail(method: "POST" | "PATCH", message: string, status = 409) {
  vi.mocked(api[method]).mockResolvedValue({
    error: { message },
    response: new Response(null, { status }),
  } as never);
}

describe("locations section", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    serve();
  });

  it("shows levels and common areas nested under their parents", async () => {
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    const block = await screen.findByRole("listitem", { name: "Blk 101" });
    const level = within(block).getByRole("listitem", { name: "Level 1" });
    within(level).getByRole("listitem", { name: "Lift lobby" });
    expect(
      within(screen.getByRole("listitem", { name: "Blk 102" })).queryAllByRole(
        "listitem"
      )
    ).toEqual([]);
  });

  it("invites the manager to add a block when the estate has none", async () => {
    serve({ items: [] });
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    expect((await screen.findByRole("status")).textContent).toContain(
      "No locations yet"
    );
  });

  it("searches by name and shows where each match sits", async () => {
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    await screen.findByRole("listitem", { name: "Blk 101" });
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search locations" }),
      { target: { value: "lobby" } }
    );
    const results = screen.getByRole("list", { name: "Search results" });
    expect(within(results).getAllByRole("listitem")).toHaveLength(1);
    within(results).getByText("Blk 101 › Level 1 › Lift lobby");
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search locations" }),
      { target: { value: "carpark" } }
    );
    expect(screen.getByRole("status").textContent).toContain(
      "No locations match"
    );
  });

  it("adds a block under the estate", async () => {
    succeed("POST");
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add block" }));
    const form = screen.getByRole("form", { name: "Add block" });
    fireEvent.change(within(form).getByRole("textbox", { name: "Name" }), {
      target: { value: "Blk 103" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith("/estates/{estateId}/locations", {
        ...path,
        body: { type: "BLOCK", name: "Blk 103" },
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole("form", { name: "Add block" })).toBeNull()
    );
  });

  it("adds a level to a block, suggesting the next position up", async () => {
    succeed("POST");
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Add level to Blk 101" })
    );
    const form = screen.getByRole("form", { name: "Add level to Blk 101" });
    const position = within(form).getByRole("spinbutton", {
      name: "Position",
    }) as HTMLInputElement;
    expect(position.value).toBe("3");
    fireEvent.change(within(form).getByRole("textbox", { name: "Name" }), {
      target: { value: "Level 3" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith("/estates/{estateId}/locations", {
        ...path,
        body: { type: "LEVEL", parentId: "b1", name: "Level 3", sortOrder: 3 },
      })
    );
  });

  it("adds a common area to a level", async () => {
    succeed("POST");
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Add common area to Level 2" })
    );
    const form = screen.getByRole("form", {
      name: "Add common area to Level 2",
    });
    expect(within(form).queryByRole("spinbutton")).toBeNull();
    fireEvent.change(within(form).getByRole("textbox", { name: "Name" }), {
      target: { value: "Corridor" },
    });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith("/estates/{estateId}/locations", {
        ...path,
        body: { type: "COMMON_AREA", parentId: "l2", name: "Corridor" },
      })
    );
  });

  it("keeps what was typed and explains a rejected save", async () => {
    fail("POST", 'Another location here is already called "Blk 101".');
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add block" }));
    const form = screen.getByRole("form", { name: "Add block" });
    const name = within(form).getByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "Blk 101" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    expect((await within(form).findByRole("alert")).textContent).toContain(
      "already called"
    );
    expect((name as HTMLInputElement).value).toBe("Blk 101");
  });

  it("moves a level to another block", async () => {
    succeed("PATCH");
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Level 2" })
    );
    const form = screen.getByRole("form", { name: "Edit Level 2" });
    const inside = within(form).getByRole("combobox", { name: "Inside" });
    expect(inside.textContent).toContain("Blk 101");
    fireEvent.click(inside);
    expect(
      (await screen.findAllByRole("option")).map((option) => option.textContent)
    ).toEqual(["Blk 101", "Blk 102"]);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    await waitFor(() =>
      expect(inside.getAttribute("aria-expanded")).toBe("false")
    );
    await chooseOption(inside, "Blk 102");
    expect(inside.textContent).toContain("Blk 102");
    expect(inside.textContent).not.toContain("Blk 101");
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith(
        "/estates/{estateId}/locations/{id}",
        {
          params: { path: { estateId: "estate-id", id: "l2" } },
          body: { parentId: "b2", name: "Level 2", sortOrder: 2 },
        }
      )
    );
  });

  it("confirms before deactivating and explains a refusal", async () => {
    fail("POST", 'Deactivate the locations inside "Blk 101" first.');
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Deactivate Blk 101" })
    );
    expect(api.POST).not.toHaveBeenCalled();
    const confirm = screen.getByRole("group", {
      name: "Deactivate Blk 101?",
    });
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Deactivate" })
    );
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(
        "/estates/{estateId}/locations/{id}/deactivate",
        { params: { path: { estateId: "estate-id", id: "b1" } } }
      )
    );
    expect((await within(confirm).findByRole("alert")).textContent).toContain(
      "first"
    );
  });

  it("is browse-only for an inactive estate", async () => {
    serve({ deactivatedAt: at });
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    await screen.findByRole("listitem", { name: "Blk 101" });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Add block" })).toBeNull()
    );
    expect(screen.queryAllByRole("button")).toEqual([]);
    screen.getByRole("searchbox", { name: "Search locations" });
  });
});
