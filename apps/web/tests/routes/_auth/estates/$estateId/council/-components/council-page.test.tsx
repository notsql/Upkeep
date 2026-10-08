import { fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { CouncilPage } from "@/routes/_auth/estates/$estateId/council/-components/council-page";
import {
  renderWithProviders,
  screen,
  waitFor,
} from "../../../../../../test-utils";

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
    if (path === "/estates/{estateId}/members") {
      data = removed
        ? []
        : [
            {
              userId: "member",
              name: "Alice",
              email: "alice@example.com",
              canInviteMembers: allowed,
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

it("lets the owner invite a council member and grant invitation permission", async () => {
  vi.mocked(api.POST).mockResolvedValue({
    data: { email: "council@example.com", status: "PENDING" },
    response: new Response(null, { status: 201 }),
  } as never);
  vi.mocked(api.PUT).mockImplementation(() => {
    allowed = true;
    return Promise.resolve({
      data: undefined,
      response: new Response(null, { status: 204 }),
    });
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
      body: { email: "council@example.com" },
    }
  );
  fireEvent.click(
    await screen.findByRole("checkbox", {
      name: "Can invite members for Alice",
    })
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole("checkbox", { name: "Can invite members for Alice" })
        .getAttribute("aria-checked")
    ).toBe("true")
  );
  expect(api.PUT).toHaveBeenCalledWith(
    "/estates/{estateId}/members/{userId}/invitation-permission",
    {
      params: { path: { estateId: "estate-id", userId: "member" } },
      body: { canInviteMembers: true },
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

it("keeps saved permission unchanged when the update fails", async () => {
  vi.mocked(api.PUT).mockResolvedValue({
    error: { message: "Unable to save permission." },
    response: new Response(null, { status: 502 }),
  });
  renderWithProviders(<CouncilPage estateId="estate-id" />);
  fireEvent.click(
    await screen.findByRole("checkbox", {
      name: "Can invite members for Alice",
    })
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Unable to save permission."
  );
  expect(
    screen
      .getByRole("checkbox", { name: "Can invite members for Alice" })
      .getAttribute("aria-checked")
  ).toBe("false");
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

it("tells the inviter that an existing account accepts in My estates", async () => {
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
  expect(message.textContent).toContain("My estates");
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
  expect(
    screen.queryByRole("heading", { name: "Pending invitations" })
  ).toBeNull();
});
