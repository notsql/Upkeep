import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent } from "@testing-library/react";
import {
  councilEstateAccess,
  crewEstateAccess,
  ownerEstateAccess,
  workspaceAccess,
} from "@tests/fixtures/access";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

const ACE = /Ace Plumbing/u;
const BOLT = /Bolt Electrical/u;

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

const { get, put, post, del, auth, state } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
  auth: { user: { id: "manager" }, loading: false },
  state: { role: "MANAGER" },
}));
vi.mock("@/lib/api", () => ({
  api: { GET: get, PUT: put, POST: post, DELETE: del },
}));
vi.mock("@/lib/access-server", () => ({
  getSessionIdentity: () => Promise.resolve(auth.user),
  getSessionAccess: async () => {
    const result = await get("/access/context");
    return { user: auth.user, access: result.data };
  },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => auth,
}));

const estateId = "00000000-0000-0000-0000-000000000001";
const path = `/estates/${estateId}/contractors`;
const ace = {
  id: "ace",
  name: "Ace Plumbing",
  email: "jobs@ace.example",
  defaultFor: ["LIFT", "PUMP"],
};
const bolt = {
  id: "bolt",
  name: "Bolt Electrical",
  email: "hello@bolt.example",
  defaultFor: [],
};

function serve(requested: string) {
  if (requested === "/access/context") {
    const permissions = {
      MANAGER: ownerEstateAccess,
      CREW: crewEstateAccess,
      COUNCIL: councilEstateAccess,
    } as const;
    const permission = {
      ...permissions[state.role as keyof typeof permissions],
      estateId,
    };
    return Promise.resolve({
      data: { ...workspaceAccess, estates: [permission] },
    });
  }
  if (requested === "/estates/{estateId}/contractors") {
    return Promise.resolve({ data: { contractors: [ace, bolt] } });
  }
  return Promise.resolve({ data: [] });
}

async function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
    defaultPendingMinMs: 0,
    defaultNotFoundComponent: () => <p role="alert">Page unavailable</p>,
  });
  await router.load();
  return renderWithProviders(<RouterProvider router={router} />);
}

const WATER_LEAK = /water.leak/iu;

beforeEach(() => {
  auth.user = { id: "manager" };
  state.role = "MANAGER";
  get.mockReset().mockImplementation(serve);
  put.mockReset().mockResolvedValue({ data: ace });
  post.mockReset().mockResolvedValue({ data: bolt });
  del.mockReset().mockResolvedValue({ data: undefined });
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

it("lists the estate's contractors with what they are the default for", async () => {
  await setup();

  const table = within(
    await screen.findByRole("table", { name: "Contractors" })
  );
  const row = table.getByRole("row", { name: ACE });
  within(row).getByText("jobs@ace.example");
  within(row).getByText("Default for: Lift, Pump");
  table.getByRole("row", { name: BOLT });
});

it("adds a contractor", async () => {
  await setup();
  fireEvent.click(
    await screen.findByRole("button", { name: "Add contractor" })
  );
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByRole("textbox", { name: "Name" }), {
    target: { value: "Cool Air" },
  });
  fireEvent.change(dialog.getByRole("textbox", { name: "Email" }), {
    target: { value: "jobs@coolair.example" },
  });
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));

  await waitFor(() =>
    expect(post).toHaveBeenCalledWith("/estates/{estateId}/contractors", {
      params: { path: { estateId } },
      body: { name: "Cool Air", email: "jobs@coolair.example" },
    })
  );
});

it("edits a contractor", async () => {
  await setup();
  fireEvent.click(
    await screen.findByRole("button", { name: "Edit Ace Plumbing" })
  );
  const dialog = within(await screen.findByRole("dialog"));
  const name = dialog.getByRole("textbox", {
    name: "Name",
  }) as HTMLInputElement;
  expect(name.value).toBe("Ace Plumbing");
  fireEvent.change(name, { target: { value: "Ace Plumbing Ltd" } });
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      "/estates/{estateId}/contractors/{contractorId}",
      {
        params: { path: { estateId, contractorId: "ace" } },
        body: { name: "Ace Plumbing Ltd", email: "jobs@ace.example" },
      }
    )
  );
});

it("explains when a contractor still has open jobs", async () => {
  del.mockResolvedValue({
    error: {
      message: "Ace Plumbing still has 2 open jobs. Reassign them first.",
    },
    response: new Response(null, { status: 409 }),
  });
  await setup();
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove Ace Plumbing" })
  );
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Remove" }));

  await dialog.findByText(
    "Ace Plumbing still has 2 open jobs. Reassign them first."
  );
  expect(del).toHaveBeenCalledWith(
    "/estates/{estateId}/contractors/{contractorId}",
    { params: { path: { estateId, contractorId: "ace" } } }
  );
});

it("sets the default contractor for an equipment type", async () => {
  await setup();
  await screen.findByRole("heading", { name: "Default contractors" });

  await chooseOption(
    screen.getByRole("combobox", {
      name: "Send new reports of gate problems to...",
    }),
    "Bolt Electrical"
  );

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      "/estates/{estateId}/contractors/defaults/{equipmentType}",
      {
        params: { path: { estateId, equipmentType: "GATE" } },
        body: { contractorId: "bolt" },
      }
    )
  );
});

it.each(["CREW", "COUNCIL"])(
  "is for managers only and never loads contractors for %s",
  async (role) => {
    state.role = role;
    await setup();

    await screen.findByRole("alert", { name: "" });
    screen.getByText("Page unavailable");
    expect(
      get.mock.calls.some(
        (call) => call[0] === "/estates/{estateId}/contractors"
      )
    ).toBe(false);
  }
);

it("offers a default contractor for every type of problem, without assuming a water leak", async () => {
  await setup();
  await screen.findByRole("heading", { name: "Default contractors" });

  screen.getByRole("combobox", {
    name: "Send new reports of cleaning jobs to...",
  });
  screen.getByRole("combobox", {
    name: "Send new reports of painting and repair jobs to...",
  });
  screen.getByRole("combobox", {
    name: "Send new reports of security problems to...",
  });
  expect(screen.queryByText(WATER_LEAK)).toBeNull();
});
