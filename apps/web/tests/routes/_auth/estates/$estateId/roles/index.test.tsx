import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent } from "@testing-library/react";
import { unassignedAccess } from "@tests/fixtures/access";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { routeTree } from "@/routeTree.gen";

// Exercise the real registered route. Before it exists, assertions fail on the
// missing screen rather than an unresolved import of a future component.
const CREATE_ROLE = /^create role$/i;
const PREREQUISITE = /requires.*view estate|view estate.*required/i;
const SAVING = /creating|saving/i;
const DELETE_REVIEWER = /delete.*fault reviewer/i;
const REVIEWER_NAME = /Fault reviewer/;
const INVITATION_HISTORY = /invitation.*history|history.*invitation/i;
const PERMANENT = /permanent|cannot be undone/i;
const DELETE_ROLE = /^delete role$/i;
const REASSIGN = /reassign|remove.*members/i;
const EDIT_REVIEWER = /edit.*fault reviewer/i;
const OWN_ROLE = /own.*role|role.*assigned/i;
const INACTIVE = /inactive|active estate.*required/i;
const RETRY = /retry/i;

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("@/routes/__root", async () => {
  const { createRootRouteWithContext, Outlet } = await import(
    "@tanstack/react-router"
  );
  return {
    Route: createRootRouteWithContext<{ queryClient: QueryClient }>()({
      component: Outlet,
    }),
  };
});
const { access, session } = vi.hoisted(() => ({
  access: { response: {} as unknown },
  session: { user: { id: "caller" }, loading: false },
}));
vi.mock("@/lib/api", () => ({
  api: {
    GET: apiGet,
    POST: vi.fn(),
    PUT: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
  },
}));
vi.mock("@/lib/access-server", () => ({
  getSessionIdentity: () => Promise.resolve(session.user),
  getSessionAccess: () =>
    Promise.resolve({ user: session.user, access: access.response }),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => session,
}));

const estateId = "00000000-0000-0000-0000-000000000001";
const roleId = "00000000-0000-0000-0000-000000000002";
const permissions = [
  {
    code: "VIEW_ESTATE",
    label: "View estate",
    description: "View estate details and dashboard.",
    requires: [],
  },
  {
    code: "EDIT_ESTATE",
    label: "Edit estate",
    description: "Edit estate details.",
    requires: ["VIEW_ESTATE"],
  },
  {
    code: "VIEW_FAULT_REPORTS",
    label: "View fault reports",
    description: "Read reports and their images.",
    requires: [],
  },
];
const saved = {
  id: roleId,
  estateId,
  name: "Fault reviewer",
  description: null,
  permissions: ["VIEW_FAULT_REPORTS"],
  version: 1,
  canEdit: true,
  canDelete: true,
  createdAt: "2026-10-24T00:00:00Z",
  updatedAt: "2026-10-24T00:00:00Z",
};

function serve({
  delegated = false,
  ownRole = false,
  inactive = false,
  hasMembers = false,
  catalogueError = false,
  existing = false,
} = {}) {
  access.response = {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: [
      {
        estateId,
        estateName: "Maple Estate",
        role: delegated ? "CUSTOM" : "MANAGER",
        customRoleId: ownRole ? roleId : null,
        canViewManagement: !delegated,
        canManageEstate: !delegated,
        canViewEstateRoles: true,
        canCreateRoles: !inactive,
        canEditRoles: !inactive,
        canDeleteRoles: !(delegated || inactive),
        canReassignRoles: !(delegated || inactive),
        canManageInvitationPermissions: !delegated,
      },
    ],
  };
  let definitions =
    existing || ownRole
      ? [
          {
            ...saved,
            canEdit: !(ownRole || inactive),
            canDelete: !(delegated || inactive || hasMembers),
          },
        ]
      : [];
  vi.mocked(api.GET).mockImplementation((path) => {
    const route = String(path);
    if (route === "/access/context") {
      return Promise.resolve({
        data: access.response,
        response: new Response(),
      }) as never;
    }
    if (route.endsWith("/role-permissions")) {
      return Promise.resolve(
        catalogueError
          ? {
              error: { message: "Permission catalogue is unavailable." },
              response: new Response(null, { status: 503 }),
            }
          : { data: permissions, response: new Response() }
      ) as never;
    }
    if (route.endsWith("/roles")) {
      return Promise.resolve({
        data: definitions,
        response: new Response(),
      }) as never;
    }
    return Promise.resolve(
      delegated
        ? {
            error: { message: "Estate details are unavailable." },
            response: new Response(null, { status: 403 }),
          }
        : {
            data: {
              id: estateId,
              name: "Maple Estate",
              owned: false,
              deactivatedAt: inactive ? saved.createdAt : null,
            },
            response: new Response(),
          }
    ) as never;
  });
  vi.mocked(api.POST).mockImplementation(() => {
    definitions = [saved];
    return Promise.resolve({
      data: saved,
      response: new Response(null, { status: 201 }),
    }) as never;
  });
  vi.mocked(api.PUT).mockResolvedValue({
    data: { ...saved, version: 2 },
    response: new Response(),
  } as never);
  vi.mocked(api.DELETE).mockImplementation(() => {
    definitions = [];
    return Promise.resolve({
      data: undefined,
      response: new Response(null, { status: 204 }),
    }) as never;
  });
}

async function openRoles() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [`/estates/${estateId}/roles`],
    }),
    context: { queryClient },
    defaultPendingMinMs: 0,
    defaultNotFoundComponent: () => <p role="alert">Page unavailable</p>,
  });
  await router.load();
  return renderWithProviders(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  serve();
});

it("opens the permissions dropdown to reveal the unchecked permissions table", async () => {
  await openRoles();
  await screen.findByRole("textbox", { name: "Role name" });
  screen.getByRole("textbox", { name: "Description" });
  expect(screen.queryByRole("table", { name: "Permissions" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Permissions", expanded: false })
  );
  const table = within(screen.getByRole("table", { name: "Permissions" }));
  table.getByRole("columnheader", { name: "Select" });
  table.getByRole("columnheader", { name: "Permission name" });
  table.getByRole("columnheader", { name: "Description" });
  for (const permission of permissions) {
    const checkbox = table.getByRole<HTMLInputElement>("checkbox", {
      name: permission.label,
    });
    expect(
      checkbox.checked || checkbox.getAttribute("aria-checked") === "true"
    ).toBe(false);
    table.getByText(permission.label);
    table.getByRole("cell", {
      name: (name) => name.startsWith(permission.description),
    });
  }
});

it("creates the exact selected permission set and shows the saved role", async () => {
  await openRoles();
  fireEvent.change(await screen.findByRole("textbox", { name: "Role name" }), {
    target: { value: "Fault reviewer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Permissions" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "View fault reports" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Permissions", expanded: true })
  );
  expect(screen.queryByRole("table", { name: "Permissions" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Permissions", expanded: false })
  );
  expect(
    screen
      .getByRole("checkbox", { name: "View fault reports" })
      .getAttribute("aria-checked")
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: CREATE_ROLE }));
  await waitFor(() =>
    expect(api.POST).toHaveBeenCalledWith(
      "/estates/{estateId}/roles",
      expect.objectContaining({
        params: { path: { estateId } },
        body: expect.objectContaining({
          name: "Fault reviewer",
          permissions: ["VIEW_FAULT_REPORTS"],
        }),
      })
    )
  );
  await screen.findByText("Fault reviewer");
});

it("explains a missing prerequisite without silently selecting it", async () => {
  await openRoles();
  fireEvent.change(await screen.findByRole("textbox", { name: "Role name" }), {
    target: { value: "Editor" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Permissions" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Edit estate" }));
  fireEvent.click(screen.getByRole("button", { name: CREATE_ROLE }));
  await screen.findByText(PREREQUISITE);
  expect(
    screen
      .getByRole("checkbox", { name: "View estate" })
      .getAttribute("aria-checked")
  ).not.toBe("true");
  expect(api.POST).not.toHaveBeenCalled();
});

it("retains the entered role and permissions after a save error", async () => {
  vi.mocked(api.POST).mockResolvedValue({
    error: { message: "A role with this name already exists." },
    response: new Response(null, { status: 409 }),
  } as never);
  await openRoles();
  fireEvent.change(await screen.findByRole("textbox", { name: "Role name" }), {
    target: { value: "Fault reviewer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Permissions" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "View fault reports" }));
  fireEvent.click(screen.getByRole("button", { name: CREATE_ROLE }));
  await screen.findByRole("alert");
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "Role name" }).value
  ).toBe("Fault reviewer");
  const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
    name: "View fault reports",
  });
  expect(
    checkbox.checked || checkbox.getAttribute("aria-checked") === "true"
  ).toBe(true);
});

it("prevents duplicate saves while a role request is pending", async () => {
  vi.mocked(api.POST).mockImplementation(() => new Promise(() => undefined));
  await openRoles();
  fireEvent.change(await screen.findByRole("textbox", { name: "Role name" }), {
    target: { value: "Fault reviewer" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Permissions" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "View fault reports" }));
  fireEvent.click(screen.getByRole("button", { name: CREATE_ROLE }));
  const saving = await screen.findByRole<HTMLButtonElement>("button", {
    name: SAVING,
  });
  expect(saving.disabled).toBe(true);
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "Permissions" })
      .disabled
  ).toBe(true);
  fireEvent.click(saving);
  expect(api.POST).toHaveBeenCalledTimes(1);
});

it("opens the permissions dropdown while editing with saved selections intact", async () => {
  serve({ existing: true });
  await openRoles();
  fireEvent.click(await screen.findByRole("button", { name: EDIT_REVIEWER }));
  const editor = within(
    await screen.findByRole("form", { name: "Edit Fault reviewer" })
  );
  expect(editor.queryByRole("table", { name: "Permissions" })).toBeNull();
  fireEvent.click(
    editor.getByRole("button", { name: "Permissions", expanded: false })
  );
  editor.getByRole("table", { name: "Permissions" });
  expect(
    editor
      .getByRole("checkbox", { name: "View fault reports" })
      .getAttribute("aria-checked")
  ).toBe("true");
  expect(api.PUT).not.toHaveBeenCalled();
});

it("opens role authoring for a delegated member without fetching estate details or the roster", async () => {
  serve({ delegated: true });
  await openRoles();
  await screen.findByRole("textbox", { name: "Role name" });
  expect(apiGet.mock.calls.map(([path]) => String(path))).not.toContain(
    "/estates/{id}"
  );
  expect(apiGet.mock.calls.map(([path]) => String(path))).not.toContain(
    "/estates/{estateId}/members"
  );
});

it("confirms deletion with the role name and permanent invitation-history loss", async () => {
  serve({ existing: true });
  await openRoles();
  fireEvent.click(await screen.findByRole("button", { name: DELETE_REVIEWER }));
  const confirmation = within(await screen.findByRole("dialog"));
  confirmation.getByText(REVIEWER_NAME);
  confirmation.getByText(INVITATION_HISTORY);
  confirmation.getByText(PERMANENT);
  expect(api.DELETE).not.toHaveBeenCalled();
  fireEvent.click(confirmation.getByRole("button", { name: DELETE_ROLE }));
  await waitFor(() =>
    expect(api.DELETE).toHaveBeenCalledWith(
      "/estates/{estateId}/roles/{roleId}",
      {
        params: { path: { estateId, roleId } },
      }
    )
  );
  await waitFor(() => expect(screen.queryByText("Fault reviewer")).toBeNull());
});

it("blocks deletion for assigned members and explains reassignment", async () => {
  serve({ existing: true, hasMembers: true });
  await openRoles();
  const deletion = await screen.findByRole<HTMLButtonElement>("button", {
    name: DELETE_REVIEWER,
  });
  expect(deletion.disabled).toBe(true);
  screen.getByText(REASSIGN);
  expect(api.DELETE).not.toHaveBeenCalled();
});

it("keeps the saved definition and explains a stale deletion conflict", async () => {
  serve({ existing: true });
  vi.mocked(api.DELETE).mockResolvedValue({
    error: { message: "Reassign the members holding this role first." },
    response: new Response(null, { status: 409 }),
  } as never);
  await openRoles();
  fireEvent.click(await screen.findByRole("button", { name: DELETE_REVIEWER }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: DELETE_ROLE,
    })
  );
  await screen.findByRole("alert");
  expect(screen.getAllByText("Fault reviewer").length).toBeGreaterThan(0);
});

it("prevents a delegated author from editing their own role or deleting any role", async () => {
  serve({ delegated: true, ownRole: true });
  await openRoles();
  await screen.findByText("Fault reviewer");
  const edit = screen.queryByRole<HTMLButtonElement>("button", {
    name: EDIT_REVIEWER,
  });
  expect(edit === null || edit.disabled).toBe(true);
  screen.getByText(OWN_ROLE);
  expect(screen.queryByRole("button", { name: DELETE_REVIEWER })).toBeNull();
});

it("disables writes for an inactive estate while displaying saved definitions", async () => {
  serve({ existing: true, inactive: true });
  await openRoles();
  await screen.findByText("Fault reviewer");
  screen.getByText(INACTIVE);
  const deletion = screen.queryByRole<HTMLButtonElement>("button", {
    name: DELETE_REVIEWER,
  });
  expect(deletion === null || deletion.disabled).toBe(true);
  expect(api.POST).not.toHaveBeenCalled();
});

it("does not allow saving when the permission catalogue fails", async () => {
  serve({ catalogueError: true });
  await openRoles();
  await screen.findByRole("alert");
  screen.getByRole("button", { name: RETRY });
  expect(api.POST).not.toHaveBeenCalled();
});
