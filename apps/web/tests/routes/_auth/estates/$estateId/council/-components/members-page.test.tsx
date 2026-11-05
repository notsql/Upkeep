import { fireEvent, within } from "@testing-library/react";
import { ownerEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import { chooseOption, renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { CouncilPage } from "@/routes/_auth/estates/$estateId/council/-components/council-page";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
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

beforeEach(() => {
  vi.resetAllMocks();
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
            canViewEstateRoles: true,
            canReassignRoles: true,
          },
        ],
      };
    }
    if (path === "/estates/{estateId}/invitation-roles") {
      data = [{ role: "COUNCIL", label: "Council member" }];
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
    "Council member"
  );
  table.getByText("Alice");
  expect(table.queryByText("Carl")).toBeNull();
});

it("splits members and pending invitations into counted tabs", async () => {
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  await screen.findByRole("tab", { name: "Members 3" });
  const pending = await screen.findByRole("tab", {
    name: "Pending invitations 1",
  });
  expect(
    screen.queryByRole("combobox", { name: "Filter by status" })
  ).toBeNull();
  expect(
    screen.queryByRole("button", {
      name: "Cancel invitation for bob@example.com",
    })
  ).toBeNull();
  fireEvent.click(pending);
  await screen.findByRole("button", {
    name: "Cancel invitation for bob@example.com",
  });
  screen.getByRole("search", { name: "Filter members" });
  expect(screen.queryByRole("table", { name: "Estate members" })).toBeNull();
});

it("shows an empty state with Clear filters when no members match", async () => {
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  await screen.findByRole("table", { name: "Estate members" });
  fireEvent.change(screen.getByRole("searchbox", { name: "Search members" }), {
    target: { value: "nobody-matches" },
  });
  screen.getByText("No matching members");
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await screen.findByText("Carl");
});
