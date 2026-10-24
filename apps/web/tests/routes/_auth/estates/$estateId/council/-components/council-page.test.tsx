import { fireEvent, within } from "@testing-library/react";
import { ownerEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
} from "@tests/test-utils";
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
const removalLabel = /Remove access for/;
const estate = {
  id: "estate-id",
  name: "Maple Grove",
  owned: true,
  canInviteMembers: true,
  canManageInvitationPermissions: true,
};
let currentEstate = estate;
let allowed = false;
let removed = false;
let cancelled = false;
beforeEach(() => {
  vi.resetAllMocks();
  currentEstate = { ...estate };
  allowed = false;
  removed = false;
  cancelled = false;
  vi.mocked(api.GET).mockImplementation((path) => {
    let data: unknown = currentEstate;
    if (path === "/access/context") {
      data = {
        ...unassignedAccess,
        canEnterWorkspace: true,
        estates: [
          {
            ...ownerEstateAccess,
            estateId: "estate-id",
            estateName: currentEstate.name,
            canInviteMembers: currentEstate.canInviteMembers,
            canManageInvitationPermissions:
              currentEstate.canManageInvitationPermissions,
            canViewEstateInvitations:
              currentEstate.canInviteMembers ||
              currentEstate.canManageInvitationPermissions,
            canViewEstateRoles: currentEstate.canManageInvitationPermissions,
            canReassignRoles: currentEstate.canManageInvitationPermissions,
          },
        ],
      };
    }
    if (path === "/estates/{estateId}/invitation-roles") {
      data = [
        { role: "COUNCIL", label: "Council member" },
        { role: "RESIDENT", label: "Resident" },
        { role: "MANAGER", label: "Manager (Admin)" },
        { role: "CREW", label: "Crew" },
      ];
    }
    if (
      path === "/estates/{estateId}/roles" ||
      path === "/estates/{estateId}/role-permissions"
    ) {
      data = [];
    }
    if (path === "/estates/{estateId}/members") {
      data = removed
        ? []
        : [
            {
              userId: "member",
              name: "Alice",
              email: "alice@example.com",
              canInviteMembers: allowed,
              role: allowed ? "MANAGER" : "COUNCIL",
              owner: false,
            },
          ];
    }
    if (path === "/estates/{estateId}/council-invitations") {
      data = cancelled
        ? []
        : [
            {
              id: "inv_1",
              estateId: "estate-id",
              name: "Bob",
              email: "bob@example.com",
              status: "IN_APP",
              expiresAt: "2026-10-13T00:00:00Z",
            },
          ];
    }
    return Promise.resolve({ data, response: new Response() }) as never;
  });
});

it("lets a Manager invite a council member and promote another member", async () => {
  vi.mocked(api.POST).mockResolvedValue({
    data: { email: "council@example.com", status: "PENDING" },
    response: new Response(null, { status: 201 }),
  } as never);
  vi.mocked(api.PUT).mockImplementation(() => {
    allowed = true;
    return Promise.resolve({
      data: {
        userId: "member",
        role: "MANAGER" as const,
        name: "Alice",
        email: "alice@example.com",
        canInviteMembers: true,
        owner: false,
      },
      error: undefined,
      response: new Response(null, { status: 200 }),
    } as never);
  });
  const { queryClient } = renderWithProviders(
    <CouncilPage estateId="estate-id" />
  );
  fireEvent.change(await screen.findByRole("textbox", { name: "Email" }), {
    target: { value: "council@example.com" },
  });
  expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
  expect((await screen.findByRole("status")).textContent).toContain(
    "council@example.com"
  );
  expect(api.POST).toHaveBeenCalledWith(
    "/estates/{estateId}/council-invitations",
    {
      params: { path: { estateId: "estate-id" } },
      body: { email: "council@example.com", role: "COUNCIL" },
    }
  );
  await chooseOption(
    await screen.findByRole("combobox", { name: "Role for Alice" }),
    "Manager (Admin)"
  );
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: "Role for Alice" }).textContent
    ).toContain("Manager (Admin)")
  );
  expect(api.PUT).toHaveBeenCalledWith(
    "/estates/{estateId}/members/{userId}/role",
    {
      params: { path: { estateId: "estate-id", userId: "member" } },
      body: { role: "MANAGER" },
    }
  );
  expect(
    queryClient
      .getQueryCache()
      .getAll()
      .filter((q) => q.queryKey.includes("estate-members"))
      .every((q) => q.queryKey[0] === "owner")
  ).toBe(true);
});

it("shows delegates the form without permission controls", async () => {
  currentEstate = {
    ...estate,
    owned: false,
    canManageInvitationPermissions: false,
  };
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  await screen.findByRole("button", { name: "Send invitation" });
  expect(screen.queryByRole("checkbox")).toBeNull();
  expect(api.GET).not.toHaveBeenCalledWith(
    "/estates/{estateId}/members",
    expect.anything()
  );
});

it("denies members without invitation permission", async () => {
  currentEstate = {
    ...estate,
    owned: false,
    canInviteMembers: false,
    canManageInvitationPermissions: false,
  };
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "permission"
  );
  expect(screen.queryByRole("button", { name: "Send invitation" })).toBeNull();
});

it("retains input and reports a failed invitation", async () => {
  vi.mocked(api.POST).mockResolvedValue({
    error: { message: "Already invited." },
    response: new Response(null, { status: 409 }),
  });
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  fireEvent.change(await screen.findByRole("textbox", { name: "Email" }), {
    target: { value: "council@example.com" },
  });
  expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Already invited."
  );
  expect(
    (screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement).value
  ).toBe("council@example.com");
});

it("keeps the saved role unchanged when a role update fails", async () => {
  vi.mocked(api.PUT).mockResolvedValue({
    error: { message: "Unable to save permission." },
    response: new Response(null, { status: 502 }),
  });
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  await chooseOption(
    await screen.findByRole("combobox", { name: "Role for Alice" }),
    "Crew"
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Unable to save permission."
  );
  expect(
    screen.getByRole("combobox", { name: "Role for Alice" }).textContent
  ).toContain("Council member");
});

it("blocks repeated submissions while sending", async () => {
  let finish: ((value: unknown) => void) | undefined;
  vi.mocked(api.POST).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }) as never
  );
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  fireEvent.change(await screen.findByRole("textbox", { name: "Email" }), {
    target: { value: "council@example.com" },
  });
  expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
  const sending = await screen.findByRole("button", {
    name: "Sending invitation…",
  });
  expect((sending as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(sending);
  expect(api.POST).toHaveBeenCalledTimes(1);
  finish?.({
    data: { email: "council@example.com" },
    response: new Response(null, { status: 201 }),
  });
  await screen.findByRole("button", { name: "Send invitation" });
});

it("tells the inviter that an existing account accepts on Invitations", async () => {
  vi.mocked(api.POST).mockResolvedValue({
    data: { email: "existing@example.com", status: "IN_APP" },
    response: new Response(null, { status: 201 }),
  } as never);
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  fireEvent.change(await screen.findByRole("textbox", { name: "Email" }), {
    target: { value: "existing@example.com" },
  });
  expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
  const message = await screen.findByRole("status");
  expect(message.textContent).toContain("Invitations");
  expect(message.textContent).toContain("No email was sent");
});

it("confirms cancellation with the email before invalidating the pending list", async () => {
  vi.mocked(api.DELETE).mockImplementation(() => {
    cancelled = true;
    return Promise.resolve({
      data: undefined,
      response: new Response(null, { status: 204 }),
    });
  });
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Cancel invitation for bob@example.com",
    })
  );
  const dialog = screen.getByRole("dialog", { name: "Cancel invitation?" });
  expect(dialog.textContent).toContain("bob@example.com");
  expect(api.DELETE).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Keep invitation" })
  );
  expect(api.DELETE).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Cancel invitation for bob@example.com",
    })
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Cancel invitation",
    })
  );
  await waitFor(() =>
    expect(api.DELETE).toHaveBeenCalledWith(
      "/estates/{estateId}/council-invitations/{invitationId}",
      { params: { path: { estateId: "estate-id", invitationId: "inv_1" } } }
    )
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", {
        name: "Cancel invitation for bob@example.com",
      })
    ).toBeNull()
  );
});

it("confirms member removal and refreshes the member list", async () => {
  vi.mocked(api.DELETE).mockImplementation(() => {
    removed = true;
    return Promise.resolve({
      data: undefined,
      response: new Response(null, { status: 204 }),
    });
  });
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Remove access for alice@example.com",
    })
  );
  const dialog = screen.getByRole("dialog", { name: "Remove estate access?" });
  expect(dialog.textContent).toContain("alice@example.com");
  expect(dialog.textContent).toContain(
    "Outstanding invitations they sent will be cancelled"
  );
  expect(api.DELETE).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Remove access" })
  );
  await waitFor(() =>
    expect(api.DELETE).toHaveBeenCalledWith(
      "/estates/{estateId}/members/{userId}",
      { params: { path: { estateId: "estate-id", userId: "member" } } }
    )
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", {
        name: "Remove access for alice@example.com",
      })
    ).toBeNull()
  );
});

it("retains the confirmation and membership when removal fails", async () => {
  vi.mocked(api.DELETE).mockResolvedValue({
    error: { message: "Unable to remove member." },
    response: new Response(null, { status: 502 }),
  });
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Remove access for alice@example.com",
    })
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Remove access",
    })
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Unable to remove member"
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
});

it("does not expose owner removal controls to delegates", async () => {
  currentEstate = {
    ...estate,
    owned: false,
    canManageInvitationPermissions: false,
  };
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  await screen.findByRole("button", { name: "Send invitation" });
  expect(screen.queryByRole("button", { name: removalLabel })).toBeNull();
  screen.getByRole("heading", { name: "Pending invitations" });
});

const ESTATES_GUIDANCE = /Existing users accept on Invitations\./;
it("uses Invitations consistently in invitation guidance", async () => {
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  await screen.findByText(ESTATES_GUIDANCE);
});
it("announces when a member role is saving", async () => {
  let complete: ((value: unknown) => void) | undefined;
  vi.mocked(api.PUT).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }) as never
  );
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  await chooseOption(
    await screen.findByRole("combobox", { name: "Role for Alice" }),
    "Crew"
  );
  await screen.findByText("Saving role…");
  complete?.({
    data: { userId: "member", role: "CREW" },
    response: new Response(null, { status: 200 }),
  });
  await screen.findByText("Role saved.");
});
