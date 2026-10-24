import { fireEvent } from "@testing-library/react";
import { unassignedAccess } from "@tests/fixtures/access";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { OwnerInvitations } from "@/routes/_auth/estates/$estateId/council/-components/access-controls";
import { CouncilPage } from "@/routes/_auth/estates/$estateId/council/-components/council-page";

const CONFIRM_ROLE = /confirm|change role|assign role/i;
const RETRY = /retry/i;

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("@/lib/api", () => ({
  api: { GET: apiGet, POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "caller" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Wire-response fixtures describe the agreed contract before OpenAPI generation.
const permission = {
  code: "VIEW_FAULT_REPORTS",
  label: "View fault reports",
  description: "Read estate reports and their images.",
  requires: [],
};
const definition = {
  id: "reader-role",
  estateId: "estate",
  name: "Fault reviewer",
  description: null,
  permissions: [permission.code],
  version: 3,
  canEdit: true,
  canDelete: true,
  createdAt: "2026-10-24T00:00:00Z",
  updatedAt: "2026-10-24T00:00:00Z",
};
const option = {
  role: "CUSTOM",
  label: definition.name,
  customRoleId: definition.id,
  customRoleVersion: definition.version,
  permissions: [permission],
};
const assignment = {
  estateId: "estate",
  estateName: "Maple Estate",
  role: "MANAGER",
  canViewManagement: true,
  canManageEstate: true,
  canViewAssets: false,
  canInviteMembers: true,
  canViewEstateInvitations: true,
  canManageInvitationPermissions: true,
  canViewEstateRoles: true,
  canCreateRoles: true,
  canEditRoles: true,
  canDeleteRoles: true,
  canReassignRoles: true,
  canViewFaultReports: true,
  canRelocateFaultReports: true,
};

function serve({
  delegated = false,
  inactive = false,
  accessError = false,
  loadingAccess = false,
  memberRole = "RESIDENT",
  memberCount = 1,
  invitationRoles = [option],
} = {}) {
  vi.mocked(api.GET).mockImplementation((path) => {
    const route = String(path);
    if (route === "/access/context") {
      if (loadingAccess) {
        return new Promise(() => undefined) as never;
      }
      if (accessError) {
        return Promise.resolve({
          error: { message: "Access unavailable" },
          response: new Response(null, { status: 503 }),
        }) as never;
      }
      return Promise.resolve({
        data: {
          ...unassignedAccess,
          canEnterWorkspace: true,
          estates: [
            {
              ...assignment,
              role: delegated ? "CUSTOM" : "MANAGER",
              canInviteMembers: !inactive,
              canReassignRoles: !(delegated || inactive),
              canManageInvitationPermissions: !delegated,
              canViewManagement: !delegated,
              canViewEstateRoles: !delegated,
            },
          ],
        },
        response: new Response(),
      }) as never;
    }
    if (route === "/estates/{id}") {
      return Promise.resolve(
        delegated
          ? {
              error: { message: "Estate details are unavailable." },
              response: new Response(null, { status: 403 }),
            }
          : {
              data: {
                id: "estate",
                name: "Maple Estate",
                owned: false,
                canInviteMembers: !inactive,
                canManageInvitationPermissions: true,
                deactivatedAt: inactive ? "2026-10-23T00:00:00Z" : null,
              },
              response: new Response(),
            }
      ) as never;
    }
    let data: unknown = [];
    if (route.endsWith("/role-permissions")) {
      data = [permission];
    }
    if (route.endsWith("/invitation-roles")) {
      data = invitationRoles;
    }
    if (route.endsWith("/roles")) {
      data = [definition];
    }
    if (route.endsWith("/members")) {
      data = Array.from({ length: memberCount }, (_, index) => ({
        userId: memberCount === 1 ? "other" : `other-${index + 1}`,
        name: memberCount === 1 ? "Other" : `Other ${index + 1}`,
        email:
          memberCount === 1
            ? "other@example.com"
            : `other-${index + 1}@example.com`,
        role: memberRole,
        customRoleId: memberRole === "CUSTOM" ? definition.id : null,
        customRoleName: memberRole === "CUSTOM" ? definition.name : null,
        owner: false,
      }));
    }
    return Promise.resolve({ data, response: new Response() }) as never;
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  serve();
  vi.mocked(api.POST).mockResolvedValue({
    data: {
      email: "recipient@example.com",
      role: "CUSTOM",
      customRoleId: definition.id,
      status: "IN_APP",
    },
    response: new Response(null, { status: 201 }),
  } as never);
  vi.mocked(api.PUT).mockResolvedValue({
    data: {
      userId: "other",
      role: "CUSTOM",
      customRoleId: definition.id,
      customRoleName: definition.name,
    },
    response: new Response(),
  } as never);
});

it("keeps custom-role changes and confirmation available on later member-table pages", async () => {
  serve({ memberRole: "CUSTOM", memberCount: 21 });
  renderWithProviders(<CouncilPage estateId="estate" />);
  const table = within(
    await screen.findByRole("table", { name: "Estate members" })
  );
  expect(table.getAllByRole("row")).toHaveLength(21);
  expect(table.queryByText("Other 21")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next members" }));
  await table.findByText("Other 21");
  table.getByRole("cell", { name: definition.name });
  await chooseOption(
    table.getByRole("combobox", { name: "Role for Other 21" }),
    "Council member"
  );
  const dialog = await screen.findByRole("dialog", {
    name: "Change estate role?",
  });
  expect(api.PUT).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Change role" }));
  await waitFor(() =>
    expect(api.PUT).toHaveBeenCalledWith(
      "/estates/{estateId}/members/{userId}/role",
      {
        params: { path: { estateId: "estate", userId: "other-21" } },
        body: { role: "COUNCIL" },
      }
    )
  );
});

it("shows an outstanding invitation's custom role without permission details", async () => {
  vi.mocked(api.GET).mockResolvedValueOnce({
    data: [
      {
        id: "offer",
        email: "recipient@example.com",
        role: "CUSTOM",
        customRoleName: definition.name,
        customPermissions: [permission],
        status: "IN_APP",
        expiresAt: "2026-12-01T00:00:00Z",
      },
    ],
    response: new Response(),
  } as never);
  renderWithProviders(<OwnerInvitations estateId="estate" />);
  await screen.findByRole("button", {
    name: "Cancel invitation for recipient@example.com",
  });
  expect(
    screen.getByRole("list", { name: "Outstanding invitations" }).textContent
  ).toContain(definition.name);
  expect(screen.queryByText(permission.label, { exact: false })).toBeNull();
  expect(
    screen.queryByText(permission.description, { exact: false })
  ).toBeNull();
});

it("defaults to the first eligible custom role when Council is unavailable and sends its ID and version", async () => {
  serve({
    delegated: true,
    invitationRoles: [
      option,
      { ...option, label: "Report helper", customRoleId: "helper-role" },
    ],
  });
  renderWithProviders(<CouncilPage estateId="estate" />);
  expect(
    (await screen.findByRole("combobox", { name: "Invitation role" }))
      .textContent
  ).toContain(definition.name);
  expect(
    screen.queryByRole("list", { name: "Invitation permissions" })
  ).toBeNull();
  expect(screen.queryByText(permission.label)).toBeNull();
  expect(screen.queryByText(permission.description)).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: "recipient@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
  await waitFor(() =>
    expect(api.POST).toHaveBeenCalledWith(
      "/estates/{estateId}/council-invitations",
      {
        params: { path: { estateId: "estate" } },
        body: {
          email: "recipient@example.com",
          role: "CUSTOM",
          customRoleId: definition.id,
          expectedRoleVersion: 3,
        },
      }
    )
  );
});

it("disables invitation submission when no roles are eligible", async () => {
  serve({ delegated: true, invitationRoles: [] });
  renderWithProviders(<CouncilPage estateId="estate" />);
  await screen.findByText("No eligible custom roles are available.");
  expect(
    screen.getByRole<HTMLButtonElement>("combobox", { name: "Invitation role" })
      .disabled
  ).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: "recipient@example.com" },
  });
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "Send invitation" })
      .disabled
  ).toBe(true);
  expect(api.POST).not.toHaveBeenCalled();
});

it("keeps a failed custom invitation's email and role selection for the same retry", async () => {
  vi.mocked(api.POST).mockResolvedValue({
    error: { message: "Invitation delivery failed." },
    response: new Response(null, { status: 502 }),
  });
  renderWithProviders(<CouncilPage estateId="estate" />);
  await chooseOption(
    await screen.findByRole("combobox", { name: "Invitation role" }),
    definition.name
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: "recipient@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));
  await screen.findByRole("alert");
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "Email" }).value
  ).toBe("recipient@example.com");
  expect(
    screen.getByRole("combobox", { name: "Invitation role" }).textContent
  ).toContain(definition.name);
});

it.each(["RESIDENT", "MANAGER"])(
  "confirms a %s conversion with only the email, custom role and replacement notice before saving",
  async (memberRole) => {
    serve({ memberRole });
    renderWithProviders(<CouncilPage estateId="estate" />);
    await chooseOption(
      await screen.findByRole("combobox", { name: "Role for Other" }),
      definition.name
    );
    await screen.findByRole("dialog", {
      description: `other@example.com. Assign ${definition.name}. The new role replaces the previous role and its permissions.`,
    });
    expect(api.PUT).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: CONFIRM_ROLE }));
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(
        "/estates/{estateId}/members/{userId}/role",
        {
          params: { path: { estateId: "estate", userId: "other" } },
          body: {
            role: "CUSTOM",
            customRoleId: definition.id,
            expectedRoleVersion: 3,
          },
        }
      )
    );
  }
);

it("disables member-role changes while inactive while retaining the readable roster", async () => {
  serve({ inactive: true });
  renderWithProviders(<CouncilPage estateId="estate" />);
  const picker = await screen.findByRole<HTMLButtonElement>("combobox", {
    name: "Role for Other",
  });
  expect(
    picker.disabled || picker.getAttribute("aria-disabled") === "true"
  ).toBe(true);
  expect(api.PUT).not.toHaveBeenCalled();
});

it("lets an invitation-only custom member invite without requesting estate details or the roster", async () => {
  serve({ delegated: true });
  renderWithProviders(<CouncilPage estateId="estate" />);
  await screen.findByRole("textbox", { name: "Email" });
  await chooseOption(
    screen.getByRole("combobox", { name: "Invitation role" }),
    definition.name
  );
  expect(apiGet.mock.calls.map(([path]) => String(path))).not.toContain(
    "/estates/{id}"
  );
  expect(apiGet.mock.calls.map(([path]) => String(path))).not.toContain(
    "/estates/{estateId}/members"
  );
  expect(screen.queryByRole("heading", { name: "Estate roles" })).toBeNull();
});

it("waits for resolved estate access before displaying invitation controls", async () => {
  serve({ loadingAccess: true });
  renderWithProviders(<CouncilPage estateId="estate" />);
  await screen.findByRole("status");
  await waitFor(() =>
    expect(api.GET).toHaveBeenCalledWith("/access/context", expect.anything())
  );
  expect(apiGet.mock.calls.map(([path]) => String(path))).not.toContain(
    "/estates/{id}"
  );
  expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull();
  expect(api.POST).not.toHaveBeenCalled();
});

it("shows an access error and Retry without mounting invitation forms when access lookup fails", async () => {
  serve({ accessError: true });
  renderWithProviders(<CouncilPage estateId="estate" />);
  await screen.findByRole("alert");
  screen.getByRole("button", { name: RETRY });
  expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull();
});

it("refreshes access after a rejected reassignment and disables a now-inactive estate", async () => {
  vi.mocked(api.PUT).mockImplementation(() => {
    serve({ inactive: true });
    return Promise.resolve({
      error: { message: "This estate is inactive." },
      response: new Response(null, { status: 409 }),
    });
  });
  renderWithProviders(<CouncilPage estateId="estate" />);
  await chooseOption(
    await screen.findByRole("combobox", { name: "Role for Other" }),
    definition.name
  );
  fireEvent.click(await screen.findByRole("button", { name: "Change role" }));
  await waitFor(() => {
    const picker = screen.getByRole<HTMLButtonElement>("combobox", {
      name: "Role for Other",
    });
    expect(
      picker.disabled || picker.getAttribute("aria-disabled") === "true"
    ).toBe(true);
    expect(picker.textContent).toContain("Resident");
  });
  expect(screen.queryByRole("button", { name: "Change role" })).toBeNull();
  expect(api.PUT).toHaveBeenCalledTimes(1);
});
