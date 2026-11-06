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
const CREATE_ROLE = /^create role$/iu;
const CREATE = /^create$/iu;
const NEW_ROLE = /^create role$/iu;
const PREREQUISITE = /requires.*view estate|view estate.*required/iu;
const SAVING = /creating|saving/iu;
const DELETE_REVIEWER = /delete.*fault reviewer/iu;
const REVIEWER_NAME = /Fault reviewer/u;
const INVITATION_HISTORY = /invitation.*history|history.*invitation/iu;
const PERMANENT = /permanent|cannot be undone/iu;
const DELETE_ROLE = /^delete role$/iu;
const REASSIGN = /reassign|remove.*members/iu;
const EDIT_REVIEWER = /edit.*fault reviewer/iu;
const OWN_ROLE = /own.*role|role.*assigned/iu;
const INACTIVE = /inactive|active estate.*required/iu;
const RETRY = /retry/iu;

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

let router: ReturnType<typeof createRouter>;

async function openAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
    defaultPendingMinMs: 0,
    defaultNotFoundComponent: () => <p role="alert">Page unavailable</p>,
  });
  await router.load();
  return renderWithProviders(<RouterProvider router={router} />);
}

const rolesPath = `/estates/${estateId}/roles`;
const openRoles = () => openAt(rolesPath);
const openNewRole = (search = "") => openAt(`${rolesPath}/new${search}`);

function choose(label: string) {
  fireEvent.click(screen.getByRole("checkbox", { name: label }));
}

function checked(label: string): boolean {
  const box = screen.getByRole<HTMLInputElement>("checkbox", { name: label });
  return box.checked || box.getAttribute("aria-checked") === "true";
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  serve();
});

// Roles list

it("links the header create action to the new-role page", async () => {
  await openRoles();
  await screen.findByText("No custom roles yet");
  expect(screen.queryByText("Maple Estate")).toBeNull();
  const links = screen.getAllByRole("link", { name: CREATE });
  expect(links).toHaveLength(1);
  expect(links[0]?.getAttribute("href")).toBe(`${rolesPath}/new`);
  expect(screen.queryByRole("textbox", { name: "Role name" })).toBeNull();
});

it("lists custom roles in a table with a permissions summary and filters by search", async () => {
  serve({ existing: true });
  await openRoles();
  const table = within(
    await screen.findByRole("table", { name: "Custom roles" })
  );
  table.getByRole("cell", { name: "Fault reviewer" });
  table.getByText("View fault reports");
  expect(screen.queryByRole("search", { name: "Filter roles" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search roles" }), {
    target: { value: "zzz" },
  });
  await screen.findByText("No matching roles");
  expect(screen.queryByRole("table", { name: "Custom roles" })).toBeNull();
  const filters = within(screen.getByRole("search", { name: "Filter roles" }));
  filters.getByText("1 active");
  screen.getByRole("button", { name: "Filters, 1 active" });
  fireEvent.click(filters.getByRole("button", { name: "Clear filters" }));
  await screen.findByRole("table", { name: "Custom roles" });
});

it("links Edit to the role's edit page", async () => {
  serve({ existing: true });
  await openRoles();
  const edit = await screen.findByRole("link", { name: EDIT_REVIEWER });
  expect(edit.getAttribute("href")).toBe(`${rolesPath}/${roleId}/edit`);
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
      { params: { path: { estateId, roleId } } }
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
  expect(screen.queryByRole("link", { name: EDIT_REVIEWER })).toBeNull();
  screen.getByText(OWN_ROLE);
  expect(screen.queryByRole("button", { name: DELETE_REVIEWER })).toBeNull();
});

it("disables writes for an inactive estate while displaying saved definitions", async () => {
  serve({ existing: true, inactive: true });
  await openRoles();
  await screen.findByText("Fault reviewer");
  screen.getByText(INACTIVE);
  expect(screen.queryByRole("link", { name: CREATE })).toBeNull();
  const deletion = screen.queryByRole<HTMLButtonElement>("button", {
    name: DELETE_REVIEWER,
  });
  expect(deletion === null || deletion.disabled).toBe(true);
});

it("shows Retry when the permission catalogue fails", async () => {
  serve({ catalogueError: true });
  await openRoles();
  await screen.findByRole("alert");
  screen.getByRole("button", { name: RETRY });
});

// New role page

it("shows the new-role page with details and permissions grouped by area", async () => {
  await openNewRole();
  await screen.findByRole("heading", { level: 1, name: NEW_ROLE });
  expect(
    within(screen.getByRole("navigation", { name: "Breadcrumbs" }))
      .getByRole("link", { name: "Roles" })
      .getAttribute("href")
  ).toBe(rolesPath);
  expect(screen.queryByText("Maple Estate")).toBeNull();
  await screen.findByRole("heading", { name: "Details" });
  screen.getByRole("textbox", { name: "Role name" });
  screen.getByRole("textbox", { name: "Description" });
  screen.getByRole("heading", { name: "Permissions" });
  within(screen.getByRole("group", { name: "Estate" })).getByRole("checkbox", {
    name: "Edit estate",
  });
  within(screen.getByRole("group", { name: "Fault reports" })).getByRole(
    "checkbox",
    { name: "View fault reports" }
  );
  for (const permission of permissions) {
    expect(checked(permission.label)).toBe(false);
    screen.getByText(permission.description);
  }
});

it("creates the exact selected permission set and returns to the roles list", async () => {
  await openNewRole();
  fireEvent.change(await screen.findByRole("textbox", { name: "Role name" }), {
    target: { value: "Fault reviewer" },
  });
  choose("View fault reports");
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
  await waitFor(() => expect(router.state.location.pathname).toBe(rolesPath));
  await screen.findByRole("table", { name: "Custom roles" });
});

it("returns to the invite dialog with the new role when opened from it", async () => {
  await openNewRole("?returnTo=council");
  const cancel = await screen.findByRole("link", { name: "Cancel" });
  expect(cancel.getAttribute("href")).toBe(`/estates/${estateId}/council`);
  expect(
    within(screen.getByRole("navigation", { name: "Breadcrumbs" }))
      .getByRole("link", { name: "Members" })
      .getAttribute("href")
  ).toBe(`/estates/${estateId}/council`);
  fireEvent.change(await screen.findByRole("textbox", { name: "Role name" }), {
    target: { value: "Fault reviewer" },
  });
  choose("View fault reports");
  fireEvent.click(screen.getByRole("button", { name: CREATE_ROLE }));
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(`/estates/${estateId}/council`)
  );
  expect(router.state.location.search).toEqual({ inviteRole: roleId });
});

it("explains a missing prerequisite without silently selecting it", async () => {
  await openNewRole();
  fireEvent.change(await screen.findByRole("textbox", { name: "Role name" }), {
    target: { value: "Editor" },
  });
  choose("Edit estate");
  fireEvent.click(screen.getByRole("button", { name: CREATE_ROLE }));
  await screen.findByText(PREREQUISITE);
  expect(checked("View estate")).toBe(false);
  expect(api.POST).not.toHaveBeenCalled();
});

it("retains the entered role and permissions after a save error", async () => {
  vi.mocked(api.POST).mockResolvedValue({
    error: { message: "A role with this name already exists." },
    response: new Response(null, { status: 409 }),
  } as never);
  await openNewRole();
  fireEvent.change(await screen.findByRole("textbox", { name: "Role name" }), {
    target: { value: "Fault reviewer" },
  });
  choose("View fault reports");
  fireEvent.click(screen.getByRole("button", { name: CREATE_ROLE }));
  await screen.findByRole("alert");
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "Role name" }).value
  ).toBe("Fault reviewer");
  expect(checked("View fault reports")).toBe(true);
});

it("prevents duplicate saves while a role request is pending", async () => {
  vi.mocked(api.POST).mockImplementation(() => new Promise(() => undefined));
  await openNewRole();
  fireEvent.change(await screen.findByRole("textbox", { name: "Role name" }), {
    target: { value: "Fault reviewer" },
  });
  choose("View fault reports");
  fireEvent.click(screen.getByRole("button", { name: CREATE_ROLE }));
  const saving = await screen.findByRole<HTMLButtonElement>("button", {
    name: SAVING,
  });
  expect(saving.disabled).toBe(true);
  fireEvent.click(saving);
  expect(api.POST).toHaveBeenCalledTimes(1);
});

it("opens role authoring for a delegated member without fetching estate details or the roster", async () => {
  serve({ delegated: true });
  await openNewRole();
  await screen.findByRole("textbox", { name: "Role name" });
  const paths = apiGet.mock.calls.map(([path]) => String(path));
  expect(paths).not.toContain("/estates/{id}");
  expect(paths).not.toContain("/estates/{estateId}/members");
});

// Edit role page

it("edits a role on its own page with saved selections and the observed version", async () => {
  serve({ existing: true });
  await openAt(`${rolesPath}/${roleId}/edit`);
  await screen.findByRole("heading", { level: 1, name: EDIT_REVIEWER });
  expect(
    within(screen.getByRole("navigation", { name: "Breadcrumbs" }))
      .getByRole("link", { name: "Roles" })
      .getAttribute("href")
  ).toBe(rolesPath);
  expect(screen.queryByText("Maple Estate")).toBeNull();
  expect(checked("View fault reports")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Save role" }));
  await waitFor(() =>
    expect(api.PUT).toHaveBeenCalledWith(
      "/estates/{estateId}/roles/{roleId}",
      expect.objectContaining({
        params: { path: { estateId, roleId } },
        body: expect.objectContaining({ expectedVersion: 1 }),
      })
    )
  );
  await waitFor(() => expect(router.state.location.pathname).toBe(rolesPath));
});

it("blocks editing your own assigned role", async () => {
  serve({ delegated: true, ownRole: true });
  await openAt(`${rolesPath}/${roleId}/edit`);
  await screen.findByText(OWN_ROLE);
  expect(screen.queryByRole("button", { name: "Save role" })).toBeNull();
});
