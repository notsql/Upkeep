import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Location } from "@/lib/locations";
import { LocationsSection } from "@/routes/_auth/estates/$estateId/-components/locations-section";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
const { auth } = vi.hoisted(() => ({
  auth: { user: { id: "owner" }, loading: false },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => auth,
}));

const ACTIONS_LABEL = /Actions for/;
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

function serve(
  options: { deactivatedAt?: string; items?: Location[]; owned?: boolean } = {}
) {
  vi.mocked(api.GET).mockImplementation(((url: string) =>
    Promise.resolve({
      data:
        url === "/estates/{id}"
          ? {
              ...estate,
              owned: options.owned ?? true,
              deactivatedAt: options.deactivatedAt,
            }
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
    auth.user = { id: "owner" };
    serve();
  });

  it("lets shared members browse and search without location write controls", async () => {
    serve({ owned: false });
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    await screen.findByRole("listitem", { name: "Blk 101" });
    expect(screen.queryByRole("button", { name: "Add block" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit Blk 101" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Deactivate Blk 101" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Add level to Blk 101" })
    ).toBeNull();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search locations" }),
      {
        target: { value: "Lift lobby" },
      }
    );
    expect(
      (await screen.findByRole("list", { name: "Search results" })).textContent
    ).toContain("Lift lobby");
  });

  it("shows levels and common areas nested under their parents", async () => {
    renderWithProviders(<LocationsSection estateId="estate-id" />);
    const block = await screen.findByRole("listitem", { name: "Blk 101" });
    fireEvent.click(
      within(block).getByRole("button", { name: "Expand Blk 101" })
    );
    const level = await within(block).findByRole("listitem", {
      name: "Level 1",
    });
    fireEvent.click(
      within(level).getByRole("button", { name: "Expand Level 1" })
    );
    await within(level).findByRole("listitem", { name: "Lift lobby" });
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
    expect(within(results).getAllByRole("listitem")).toHaveLength(3);
    const block = within(results).getByRole("listitem", { name: "Blk 101" });
    const level = await within(block).findByRole("listitem", {
      name: "Level 1",
    });
    await within(level).findByRole("listitem", { name: "Lift lobby" });
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
    await selectAction("Blk 101", "Add level to Blk 101");
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
    await selectAction("Level 2", "Add common area to Level 2");
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
    await selectAction("Level 2", "Edit Level 2");
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
    await selectAction("Blk 101", "Deactivate Blk 101");
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
    expect(screen.queryByRole("button", { name: ACTIONS_LABEL })).toBeNull();
    screen.getByRole("searchbox", { name: "Search locations" });
  });
});

async function selectAction(node: string, action: string) {
  if (node.startsWith("Level")) {
    const expand = await screen.findByRole("button", {
      name: "Expand Blk 101",
    });
    fireEvent.click(expand);
  }
  fireEvent.click(
    await screen.findByRole("button", { name: `Actions for ${node}` })
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: action }));
}
it("can collapse location children and cancel a location dialog without saving", async () => {
  serve();
  renderWithProviders(<LocationsSection estateId="estate-id" />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Expand Blk 101" })
  );
  const disclosure = await screen.findByRole("button", {
    name: "Collapse Blk 101",
  });
  fireEvent.click(disclosure);
  await waitFor(() =>
    expect(screen.queryByRole("listitem", { name: "Level 1" })).toBeNull()
  );
  fireEvent.click(screen.getByRole("button", { name: "Expand Blk 101" }));
  await screen.findByRole("listitem", { name: "Level 1" });
  await selectAction("Blk 101", "Add level to Blk 101");
  const dialog = await screen.findByRole("dialog", {
    name: "Add level to Blk 101",
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(api.POST).not.toHaveBeenCalled();
});

it("keeps a location dialog open while saving and closes after success", async () => {
  serve();
  let complete: ((value: unknown) => void) | undefined;
  vi.mocked(api.POST).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }) as never
  );
  renderWithProviders(<LocationsSection estateId="estate-id" />);
  fireEvent.click(await screen.findByRole("button", { name: "Add block" }));
  const dialog = await screen.findByRole("dialog", { name: "Add block" });
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
    target: { value: "Blk 103" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  await screen.findByRole("button", { name: "Saving…" });
  expect(
    within(dialog).getByRole<HTMLButtonElement>("button", { name: "Cancel" })
      .disabled
  ).toBe(true);
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.getByRole("dialog", { name: "Add block" })).toBe(dialog);
  complete?.({ data: locations[0], response: new Response() });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("starts collapsed and shows counts across the entire block, with the name inside the disclosure", async () => {
  serve({
    items: [
      ...locations,
      location("a2", "COMMON_AREA", "Bin centre", "b1"),
      location("a3", "COMMON_AREA", "Car park", "l2"),
    ],
  });
  renderWithProviders(<LocationsSection estateId="estate-id" />);
  const block = await screen.findByRole("listitem", { name: "Blk 101" });
  within(block).getByText("2 levels · 3 common areas");
  expect(screen.queryByRole("listitem", { name: "Level 1" })).toBeNull();
  const expand = within(block).getByRole("button", { name: "Expand Blk 101" });
  fireEvent.click(within(expand).getByText("Blk 101"));
  const level = await screen.findByRole("listitem", { name: "Level 1" });
  within(level).getByText("1 common area");
  expect(screen.queryByRole("listitem", { name: "Lift lobby" })).toBeNull();
  fireEvent.click(
    within(level).getByRole("button", { name: "Expand Level 1" })
  );
  await screen.findByRole("listitem", { name: "Lift lobby" });
  const empty = screen.getByRole("listitem", { name: "Blk 102" });
  within(empty).getByText("0 levels · 0 common areas");
  expect(
    within(empty).queryByRole("button", { name: "Expand Blk 102" })
  ).toBeNull();
});
it("reveals matches with parent context and restores the manual view after clearing search", async () => {
  serve();
  renderWithProviders(<LocationsSection estateId="estate-id" />);
  await screen.findByRole("listitem", { name: "Blk 101" });
  const search = screen.getByRole("searchbox", { name: "Search locations" });
  fireEvent.change(search, { target: { value: "  LOBBY  " } });
  const result = screen.getByRole("list", { name: "Search results" });
  const block = within(result).getByRole("listitem", { name: "Blk 101" });
  const level = await within(block).findByRole("listitem", { name: "Level 1" });
  await within(level).findByRole("listitem", { name: "Lift lobby" });
  expect(
    within(result).queryByRole("listitem", { name: "Blk 102" })
  ).toBeNull();
  within(block).getByText("2 levels · 1 common area");
  fireEvent.change(search, { target: { value: "" } });
  expect(screen.queryByRole("listitem", { name: "Level 1" })).toBeNull();
});
it("keeps the actions menu independent from expansion", async () => {
  serve();
  renderWithProviders(<LocationsSection estateId="estate-id" />);
  await screen.findByRole("button", { name: "Expand Blk 101" });
  fireEvent.click(screen.getByRole("button", { name: "Actions for Blk 101" }));
  await screen.findByRole("menuitem", { name: "Edit Blk 101" });
  expect(
    screen
      .getByRole("button", { name: "Expand Blk 101", hidden: true })
      .getAttribute("aria-expanded")
  ).toBe("false");
  expect(screen.queryByRole("listitem", { name: "Level 1" })).toBeNull();
});
it("restores manual expansion after leaving the screen and isolates other estates and accounts", async () => {
  serve();
  auth.user = { id: "owner" };
  const rendered = renderWithProviders(
    <LocationsSection estateId="estate-id" />
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Expand Blk 101" })
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Expand Level 1" })
  );
  await screen.findByRole("listitem", { name: "Lift lobby" });
  rendered.rerender(<p>Asset page</p>);
  rendered.rerender(<LocationsSection estateId="estate-id" />);
  await screen.findByRole("listitem", { name: "Lift lobby" });
  rendered.rerender(<LocationsSection estateId="another-estate" />);
  await screen.findByRole("button", { name: "Expand Blk 101" });
  expect(screen.queryByRole("listitem", { name: "Level 1" })).toBeNull();
  rendered.rerender(<LocationsSection estateId="estate-id" />);
  await screen.findByRole("listitem", { name: "Lift lobby" });
  auth.user = { id: "other-account" };
  rendered.rerender(<LocationsSection estateId="estate-id" />);
  await screen.findByRole("button", { name: "Expand Blk 101" });
  expect(screen.queryByRole("listitem", { name: "Level 1" })).toBeNull();
});
