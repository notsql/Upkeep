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
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

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

const { get, put, del, auth, state } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  auth: { user: { id: "manager" }, loading: false },
  state: { role: "MANAGER" },
}));
vi.mock("@/lib/api", () => ({ api: { GET: get, PUT: put, DELETE: del } }));
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
const LIFT_NAME = /Lift contractor name/;
const LIFT_EMAIL = /Lift contractor email/;
const PUMP_NAME = /Pump contractor name/;
const SAVE_LIFT = /Save lift contractor/;
const REMOVE_LIFT = /Remove lift contractor/;
const NO_LONGER_RECEIVES = /Acme Lifts will no longer receive lift work orders/;

const lift = {
  equipmentType: "LIFT",
  name: "Acme Lifts",
  email: "faults@acmelifts.example",
  updatedAt: "2026-10-01T00:00:00Z",
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
    return Promise.resolve({ data: [lift] });
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

beforeEach(() => {
  auth.user = { id: "manager" };
  state.role = "MANAGER";
  get.mockReset().mockImplementation(serve);
  put.mockReset().mockResolvedValue({ data: lift });
  del.mockReset().mockResolvedValue({ data: undefined });
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

it("shows one row per equipment type, filled from the saved contractors", async () => {
  await setup();

  const name = (await screen.findByRole("textbox", {
    name: LIFT_NAME,
  })) as HTMLInputElement;
  expect(name.value).toBe("Acme Lifts");
  expect(
    (screen.getByRole("textbox", { name: LIFT_EMAIL }) as HTMLInputElement)
      .value
  ).toBe("faults@acmelifts.example");
  expect(
    (screen.getByRole("textbox", { name: PUMP_NAME }) as HTMLInputElement).value
  ).toBe("");
  for (const type of ["Pump", "Lift", "Gate", "Common-area light"]) {
    screen.getByRole("heading", { name: type });
  }
});

it("saves a contractor for its equipment type and reloads the list", async () => {
  await setup();
  const name = await screen.findByRole("textbox", { name: LIFT_NAME });
  fireEvent.change(name, { target: { value: "Better Lifts" } });
  fireEvent.change(screen.getByRole("textbox", { name: LIFT_EMAIL }), {
    target: { value: "jobs@betterlifts.example" },
  });
  get.mockClear();

  fireEvent.click(screen.getByRole("button", { name: SAVE_LIFT }));

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      "/estates/{estateId}/contractors/{equipmentType}",
      {
        params: { path: { estateId, equipmentType: "LIFT" } },
        body: { name: "Better Lifts", email: "jobs@betterlifts.example" },
      }
    )
  );
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      "/estates/{estateId}/contractors",
      expect.anything()
    )
  );
  await screen.findByText("Lift contractor saved.");
});

it("shows the server's message when a contractor cannot be saved", async () => {
  put.mockResolvedValue({
    error: { message: "Enter a contractor name and a valid email address." },
    response: new Response(null, { status: 400 }),
  });
  await setup();
  await screen.findByRole("textbox", { name: LIFT_NAME });

  fireEvent.click(screen.getByRole("button", { name: SAVE_LIFT }));

  await screen.findByText("Enter a contractor name and a valid email address.");
});

it("asks for confirmation before removing a contractor", async () => {
  await setup();
  fireEvent.click(await screen.findByRole("button", { name: REMOVE_LIFT }));
  const dialog = within(await screen.findByRole("dialog"));
  dialog.getByText(NO_LONGER_RECEIVES);
  expect(del).not.toHaveBeenCalled();

  fireEvent.click(dialog.getByRole("button", { name: "Remove" }));

  await waitFor(() =>
    expect(del).toHaveBeenCalledWith(
      "/estates/{estateId}/contractors/{equipmentType}",
      { params: { path: { estateId, equipmentType: "LIFT" } } }
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
