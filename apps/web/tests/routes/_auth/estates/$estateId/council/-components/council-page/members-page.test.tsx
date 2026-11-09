import { fireEvent, within } from "@testing-library/react";
import { ownerEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import { chooseOption, renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { CouncilPage } from "@/routes/_auth/estates/$estateId/council/-components/council-page/council-page";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => () => Promise.resolve(),
  useSearch: () => ({}),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const OWNER_ROW = /Olivia Owner/u;
const members = [
  {
    userId: "owner",
    name: "Olivia Owner",
    email: "olivia@example.com",
    canInviteMembers: true,
    role: "MANAGER",
    owner: true,
  },
  {
    userId: "alice",
    name: "Alice",
    email: "alice@example.com",
    canInviteMembers: false,
    role: "COUNCIL",
    owner: false,
  },
  {
    userId: "carl",
    name: "Carl",
    email: "carl@crew.test",
    canInviteMembers: false,
    role: "CREW",
    owner: false,
  },
];

let rolesVisible = true;

beforeEach(() => {
  vi.resetAllMocks();
  rolesVisible = true;
  vi.mocked(api.GET).mockImplementation((path) => {
    let data: unknown = { id: "estate-id", name: "Maple Grove", owned: true };
    if (path === "/access/context") {
      data = {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [
          {
            ...ownerEstateAccess,
            estateId: "estate-id",
            estateName: "Maple Grove",
            canInviteMembers: true,
            canManageInvitationPermissions: true,
            canViewEstateInvitations: true,
            canViewEstateRoles: rolesVisible,
            canReassignRoles: true,
          },
        ],
      };
    }
    if (path === "/estates/{estateId}/invitation-roles") {
      data = [{ role: "COUNCIL", label: "Council" }];
    }
    if (
      path === "/estates/{estateId}/roles" ||
      path === "/estates/{estateId}/role-permissions"
    ) {
      data = [];
    }
    if (path === "/estates/{estateId}/members") {
      data = members;
    }
    if (path === "/estates/{estateId}/council-invitations") {
      data = [
        {
          id: "inv_1",
          estateId: "estate-id",
          email: "bob@example.com",
          status: "IN_APP",
          role: "COUNCIL",
          expiresAt: "2026-12-13T00:00:00Z",
        },
      ];
    }
    return Promise.resolve({ data, response: new Response() }) as never;
  });
});

it("opens the invite form in a dialog from the page header", async () => {
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  const invite = await screen.findByRole("button", { name: "Invite member" });
  expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull();
  fireEvent.click(invite);
  const dialog = await screen.findByRole("dialog", { name: "Invite member" });
  await within(dialog).findByRole("textbox", { name: "Email" });
  within(dialog).getByRole("button", { name: "Send invitation" });
});

it("shows the owner with one Owner role instead of Owner plus Manager", async () => {
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  const table = await screen.findByRole("table", { name: "Estate members" });
  const row = within(table).getByRole("row", { name: OWNER_ROW });
  expect(within(row).getAllByText("Owner")).toHaveLength(1);
  expect(within(row).queryByText("Manager (Admin)")).toBeNull();
});

it("filters members by search text and role", async () => {
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  const table = within(
    await screen.findByRole("table", { name: "Estate members" })
  );
  expect(
    screen.queryByRole("searchbox", { name: "Search members" })
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search members" }), {
    target: { value: "crew.test" },
  });
  expect(table.queryByText("Alice")).toBeNull();
  table.getByText("Carl");
  fireEvent.change(screen.getByRole("searchbox", { name: "Search members" }), {
    target: { value: "" },
  });
  await chooseOption(
    screen.getByRole("combobox", { name: "Filter by role" }),
    "Council"
  );
  table.getByText("Alice");
  expect(table.queryByText("Carl")).toBeNull();
});

it("links members, waiting to join and roles as separate views", async () => {
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  const views = within(
    await screen.findByRole("navigation", { name: "People views" })
  );
  screen.getByRole("heading", { level: 1, name: "People & access" });
  expect(views.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Members",
    "Waiting to join",
    "Roles",
  ]);
  expect(views.getByRole("link", { name: "Roles" }).getAttribute("href")).toBe(
    "/estates/$estateId/roles"
  );
  expect(
    views.getByRole("link", { name: "Members" }).getAttribute("href")
  ).toBe("/estates/$estateId/council");
  expect(
    views.getByRole("link", { name: "Waiting to join" }).getAttribute("href")
  ).toBe("/estates/$estateId/council/invitations");
  await screen.findByRole("table", { name: "Estate members" });
  expect(
    screen.queryByRole("button", {
      name: "Cancel invitation for bob@example.com",
    })
  ).toBeNull();
  expect(screen.queryByText("Maple Grove")).toBeNull();
});

it("hides the Roles view from a members-only user", async () => {
  rolesVisible = false;
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  const views = within(
    await screen.findByRole("navigation", { name: "People views" })
  );
  expect(views.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Members",
    "Waiting to join",
  ]);
});

it("shows pending invitations on their own view with the shared filters", async () => {
  renderWithProviders(<CouncilPage estateId="estate-id" view="invitations" />);
  await screen.findByRole("button", {
    name: "Cancel invitation for bob@example.com",
  });
  expect(
    screen.queryByRole("combobox", { name: "Filter by status" })
  ).toBeNull();
  screen.getByRole("button", { name: "Filters" });
  screen.getByRole("navigation", { name: "People views" });
  expect(screen.queryByRole("table", { name: "Estate members" })).toBeNull();
});

it("clears filters from the filter bar when no members match", async () => {
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  await screen.findByRole("table", { name: "Estate members" });
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search members" }), {
    target: { value: "nobody-matches" },
  });
  screen.getByText("No matching members");
  const filters = screen.getByRole("search", { name: "Filter members" });
  within(filters).getByText("1 active");
  fireEvent.click(
    within(filters).getByRole("button", { name: "Clear filters" })
  );
  await screen.findByText("Carl");
});
