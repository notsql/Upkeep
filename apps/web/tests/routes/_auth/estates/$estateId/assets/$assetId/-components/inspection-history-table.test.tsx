import type { components, operations } from "@proj/api/schema";
import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent } from "@testing-library/react";
import {
  crewEstateAccess,
  ownerEstateAccess,
  unassignedAccess,
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

const estateId = "00000000-0000-0000-0000-000000000001";
const assetId = "00000000-0000-0000-0000-000000000002";
const inspectionId = "00000000-0000-0000-0000-000000000003";
const locationId = "00000000-0000-0000-0000-000000000004";
const workOrderId = "00000000-0000-0000-0000-000000000005";
const olderId = "00000000-0000-0000-0000-000000000006";
const otherAssetId = "00000000-0000-0000-0000-000000000007";
const assetPath = `/estates/${estateId}/assets/${assetId}`;
const historyEndpoint = "/estates/{estateId}/assets/{assetId}/inspections";
const historyKey = ["tester", "inspection-results", estateId, assetId, "list"];
const cursor = "opaque-history-page-two";
const ALEX_ROW = /Alex Tan/;
const MUTATION_ACTION = /edit|delete/i;

const inspection: components["schemas"]["InspectionResultResponse"] = {
  id: inspectionId,
  estateId,
  assetId,
  locationId,
  locationPath: "Block A / Level 1",
  outcome: "FAIL",
  inspectedOn: "2026-10-26",
  notes: "Cracked seal",
  recordedByUserId: "private-inspector-account",
  recordedByName: "Alex Tan",
  createdAt: "2026-10-26T00:30:00Z",
  photos: [],
  workOrder: null,
};
const olderInspection: components["schemas"]["InspectionResultResponse"] = {
  ...inspection,
  id: olderId,
  inspectedOn: "2026-10-20",
  recordedByName: "Mei Lim",
  outcome: "PASS",
};
const asset: components["schemas"]["AssetResponse"] = {
  id: assetId,
  estateId,
  locationId,
  reference: "OAK-A0001",
  name: "Water Pump",
  category: "LIFT",
  locationPath: "Block A / Level 1",
  installedOn: "2020-01-01",
  createdAt: "2020-01-01T00:00:00Z",
  updatedAt: "2026-10-26T00:00:00Z",
  lifecycleVersion: 0,
};
const state = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  history: vi.fn(),
  role: "MANAGER",
  canView: true,
  canCreateWorkOrders: true,
  canViewWorkOrders: true,
  estateActive: true,
  assetActive: true,
  locationActive: true,
}));

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
vi.mock("@/lib/api", () => ({ api: { GET: state.get, POST: state.post } }));
vi.mock("@/lib/access-server", () => ({
  getSessionIdentity: async () => ({ id: "tester" }),
  getSessionAccess: async () => ({
    user: { id: "tester" },
    access: (await state.get("/access/context")).data,
  }),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "tester" }, loading: false }),
}));

function access() {
  return {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: [
      {
        ...(state.role === "OWNER" ? ownerEstateAccess : crewEstateAccess),
        estateId,
        estateName: "Oak Park",
        role: state.role === "OWNER" ? "MANAGER" : state.role,
        canViewAssets: state.role === "OWNER",
        canViewInspectionResults: state.canView,
        canCreateInspectionResults: state.canView && state.estateActive,
        canCreateWorkOrders:
          state.role !== "CREW" &&
          state.canCreateWorkOrders &&
          state.estateActive,
        canViewWorkOrders: state.canViewWorkOrders,
      },
    ],
  };
}

async function setup(path = assetPath) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: {
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
    },
    defaultPendingMinMs: 0,
    defaultErrorComponent: () => <p role="alert">Asset unavailable</p>,
  });
  await router.load();
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

function page(items = [inspection], nextCursor: string | null = null) {
  const data: components["schemas"]["InspectionResultPageResponse"] = {
    items,
    nextCursor,
  };
  return { data, response: new Response() };
}

beforeEach(() => {
  state.role = "MANAGER";
  state.canView = true;
  state.canCreateWorkOrders = true;
  state.canViewWorkOrders = true;
  state.estateActive = true;
  state.assetActive = true;
  state.locationActive = true;
  state.history.mockReset().mockResolvedValue(page());
  state.post.mockReset().mockResolvedValue({
    data: { ...inspection, outcome: "PASS" },
    response: new Response(null, { status: 201 }),
  });
  state.get.mockReset().mockImplementation(
    (
      path: string,
      options?: {
        params?: operations["listInspectionResults"]["parameters"];
      }
    ) => {
      if (path === historyEndpoint) {
        return state.history(options);
      }
      let data: unknown = [];
      switch (path) {
        case "/access/context":
          data = access();
          break;
        case "/estates/{estateId}":
          data = {
            id: estateId,
            name: "Oak Park",
            owned: state.role === "OWNER",
            deactivatedAt: state.estateActive ? null : "2026-10-26T01:00:00Z",
          };
          break;
        case "/estates/{estateId}/assets/{id}":
          data = {
            ...asset,
            deactivatedAt: state.assetActive ? null : "2026-10-26T01:00:00Z",
          };
          break;
        case "/estates/{estateId}/inspection-assets/{assetId}":
          data = {
            ...asset,
            id: options?.params?.path.assetId ?? assetId,
            estateActive: state.estateActive,
            assetActive: state.assetActive,
            locationActive: state.locationActive,
          };
          break;
        case "/estates/{estateId}/assets/{assetId}/inspections/{inspectionId}":
          data = { ...inspection, outcome: "PASS" };
          break;
        default:
          break;
      }
      return Promise.resolve({ data, response: new Response() });
    }
  );
});

// Exercise the actual asset routes. The missing table must fail assertions,
// rather than fail to import an implementation that has not been written yet.
it.each(["OWNER", "MANAGER", "CREW"])(
  "shows the inspection table and saved-detail link on the %s asset screen",
  async (role) => {
    state.role = role;
    await setup();
    const table = await screen.findByRole("table", {
      name: "Inspection records",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent)
    ).toEqual([
      "Inspection date",
      "Outcome",
      "Follow-up / work order",
      "Inspector",
      "View record",
    ]);
    const row = within(table).getByRole("row", { name: ALEX_ROW });
    within(row).getByRole("cell", { name: "2026-10-26" });
    within(row).getByText("Fail");
    expect(
      within(row)
        .getByRole("link", { name: "View record" })
        .getAttribute("href")
    ).toBe(`${assetPath}/inspections/${inspectionId}`);
    expect(state.history).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          path: { estateId, assetId },
          query: expect.objectContaining({ limit: 20 }),
        },
      })
    );
    if (role !== "OWNER") {
      expect(
        state.get.mock.calls.some(([path]) =>
          [
            "/estates/{estateId}/assets/{id}",
            "/estates/{estateId}/assets/{assetId}/assessments",
            "/estates/{estateId}/assets/{assetId}/events",
            "/estates/{estateId}/assets/{assetId}/failure-risk",
            "/estates/{estateId}/devices",
          ].includes(path)
        )
      ).toBe(false);
      expect(screen.queryByRole("link", { name: "Edit asset" })).toBeNull();
    }
  }
);

it("preserves canonical server order and distinct same-day inspection links", async () => {
  const sameDay = {
    ...inspection,
    id: olderId,
    createdAt: "2026-10-26T00:00:00Z",
  };
  const backdated = { ...olderInspection, id: workOrderId };
  state.history.mockResolvedValue(page([inspection, sameDay, backdated]));
  await setup();
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  expect(
    within(table)
      .getAllByRole("link", { name: "View record" })
      .map((link) => link.getAttribute("href"))
  ).toEqual(
    [inspectionId, olderId, workOrderId].map(
      (id) => `${assetPath}/inspections/${id}`
    )
  );
  expect(
    within(table).getAllByRole("cell", { name: "2026-10-26" })
  ).toHaveLength(2);
  within(table).getByRole("cell", { name: "2026-10-20" });
});

it("shows an unavailable inspector without exposing the account identifier", async () => {
  state.history.mockResolvedValue(
    page([{ ...inspection, recordedByName: null }])
  );
  await setup();
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  within(table).getByRole("cell", { name: "Inspector unavailable" });
  expect(within(table).queryByText(inspection.recordedByUserId)).toBeNull();
});

it("shows Pass as Closed without conversion or saved-record mutation controls", async () => {
  state.history.mockResolvedValue(page([{ ...inspection, outcome: "PASS" }]));
  await setup();
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  within(table).getByText("Pass");
  within(table).getByText("Closed");
  expect(within(table).queryByText("Awaiting work order")).toBeNull();
  expect(
    within(table).queryByRole("link", { name: "Create work order" })
  ).toBeNull();
  expect(
    within(table).queryByRole("button", { name: MUTATION_ACTION })
  ).toBeNull();
  expect(
    within(table).queryByRole("link", { name: MUTATION_ACTION })
  ).toBeNull();
});

it("offers saved-source conversion for an unlinked Fail without creating work", async () => {
  await setup();
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  expect(within(table).queryByText("Awaiting work order")).toBeNull();
  expect(
    within(table)
      .getByRole("link", { name: "Create work order" })
      .getAttribute("href")
  ).toBe(
    `/estates/${estateId}/work-orders/new?sourceInspectionId=${inspectionId}`
  );
  expect(state.post).not.toHaveBeenCalled();
});

it("links existing work while preserving Fail and hiding fresh conversion", async () => {
  state.history.mockResolvedValue(
    page([
      {
        ...inspection,
        workOrder: { id: workOrderId, reference: "OAK-W0001" },
      },
    ])
  );
  await setup();
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  within(table).getByText("Fail");
  expect(
    within(table).getByRole("link", { name: "OAK-W0001" }).getAttribute("href")
  ).toBe(`/estates/${estateId}/work-orders/${workOrderId}`);
  expect(
    within(table).queryByRole("link", { name: "Create work order" })
  ).toBeNull();
  expect(within(table).queryByText("Awaiting work order")).toBeNull();
});

it("keeps the work-order reference as text when work-order read authority is absent", async () => {
  state.canViewWorkOrders = false;
  state.history.mockResolvedValue(
    page([
      {
        ...inspection,
        workOrder: { id: workOrderId, reference: "OAK-W0001" },
      },
    ])
  );
  await setup();
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  within(table).getByText("OAK-W0001");
  expect(within(table).queryByRole("link", { name: "OAK-W0001" })).toBeNull();
  expect(
    within(table).queryByRole("link", { name: "Create work order" })
  ).toBeNull();
});

it("leaves follow-up empty without creation authority", async () => {
  state.canCreateWorkOrders = false;
  await setup();
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  expect(within(table).queryByText("Awaiting work order")).toBeNull();
  within(table).getByRole("link", { name: "View record" });
  expect(
    within(table).queryByRole("link", { name: "Create work order" })
  ).toBeNull();
});

it("keeps Crew inspection history readable without a work-order creation action", async () => {
  state.role = "CREW";
  await setup();
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  within(table).getByText("Fail");
  within(table).getByRole("link", { name: "View record" });
  expect(
    within(table).queryByRole("link", { name: "Create work order" })
  ).toBeNull();
  expect(state.post).not.toHaveBeenCalled();
});

it.each(["estateActive", "assetActive", "locationActive"] as const)(
  "keeps saved history readable without conversion when %s is false",
  async (flag) => {
    state[flag] = false;
    await setup();
    const table = await screen.findByRole("table", {
      name: "Inspection records",
    });
    expect(within(table).queryByText("Awaiting work order")).toBeNull();
    within(table).getByRole("link", { name: "View record" });
    expect(
      within(table).queryByRole("link", { name: "Create work order" })
    ).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Create inspection record" })
    ).toBeNull();
  }
);

it("shows loading separately from a successful empty history", async () => {
  let resolveHistory: (value: ReturnType<typeof page>) => void = () =>
    undefined;
  state.history.mockReturnValue(
    new Promise<ReturnType<typeof page>>((resolve) => {
      resolveHistory = resolve;
    })
  );
  await setup();
  const loading = await screen.findByText("Loading inspection records…");
  expect(loading.getAttribute("role")).toBe("status");
  expect(screen.queryByText("No inspection records yet")).toBeNull();
  expect(screen.queryByRole("link", { name: "Create work order" })).toBeNull();
  resolveHistory(page([]));
  await screen.findByText("No inspection records yet");
  expect(screen.queryByText("Loading inspection records…")).toBeNull();
  expect(screen.queryByRole("link", { name: "View record" })).toBeNull();
});

it("shows the empty message only after a successful empty first page", async () => {
  state.history.mockResolvedValue(page([]));
  await setup();
  await screen.findByText("No inspection records yet");
  expect(screen.queryByRole("link", { name: "View record" })).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("retries a failed history read while retaining asset context and recording access", async () => {
  state.history.mockResolvedValueOnce({
    error: { message: "Inspection history is unavailable." },
    response: new Response(null, { status: 503 }),
  });
  await setup();
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Inspection history is unavailable.");
  screen.getByRole("heading", { name: "Water Pump" });
  screen.getByRole("link", { name: "Create inspection record" });
  expect(screen.queryByText("No inspection records yet")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry inspections" }));
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  within(table).getByRole("cell", { name: "Alex Tan" });
  expect(screen.queryByRole("alert")).toBeNull();
});

it("replaces pages using opaque cursors and returns to the first page with Previous", async () => {
  state.history
    .mockResolvedValueOnce(page([inspection], cursor))
    .mockResolvedValueOnce(page([olderInspection]))
    .mockResolvedValue(page([inspection], cursor));
  await setup();
  await screen.findByRole("table", { name: "Inspection records" });
  expect(
    screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled")
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("cell", { name: "Mei Lim" });
  expect(state.history).toHaveBeenLastCalledWith(
    expect.objectContaining({
      params: { path: { estateId, assetId }, query: { cursor, limit: 20 } },
    })
  );
  expect(screen.queryByRole("cell", { name: "Alex Tan" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Previous" }));
  await screen.findByRole("cell", { name: "Alex Tan" });
  expect(screen.queryByRole("cell", { name: "Mei Lim" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Previous" }).hasAttribute("disabled")
  ).toBe(true);
});

it("retries a failed second page with its cursor instead of restarting history", async () => {
  state.history
    .mockResolvedValueOnce(page([inspection], cursor))
    .mockResolvedValueOnce({
      error: { message: "Second page unavailable." },
      response: new Response(null, { status: 503 }),
    })
    .mockResolvedValue(page([olderInspection]));
  await setup();
  await screen.findByRole("table", { name: "Inspection records" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("alert");
  expect(screen.queryByRole("cell", { name: "Alex Tan" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry inspections" }));
  await screen.findByRole("cell", { name: "Mei Lim" });
  expect(state.history).toHaveBeenLastCalledWith(
    expect.objectContaining({
      params: { path: { estateId, assetId }, query: { cursor, limit: 20 } },
    })
  );
});

it("resets pagination and hides old rows while another asset loads", async () => {
  state.history
    .mockResolvedValueOnce(page([inspection], cursor))
    .mockResolvedValueOnce(page([olderInspection]))
    .mockReturnValue(new Promise(() => undefined));
  const view = await setup();
  await screen.findByRole("table", { name: "Inspection records" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("cell", { name: "Mei Lim" });
  await view.router.navigate({
    to: "/estates/$estateId/assets/$assetId",
    params: { estateId, assetId: otherAssetId },
  });
  await waitFor(() =>
    expect(state.history).toHaveBeenLastCalledWith(
      expect.objectContaining({
        params: {
          path: { estateId, assetId: otherAssetId },
          query: expect.objectContaining({ cursor: undefined, limit: 20 }),
        },
      })
    )
  );
  expect(screen.queryByRole("cell", { name: "Mei Lim" })).toBeNull();
  expect(screen.queryByRole("cell", { name: "Alex Tan" })).toBeNull();
});

it("does not request or expose inspection history without inspection read authority", async () => {
  state.role = "OWNER";
  state.canView = false;
  await setup();
  await screen.findByRole("heading", { name: "Water Pump" });
  expect(
    screen.queryByRole("table", { name: "Inspection records" })
  ).toBeNull();
  expect(state.history).not.toHaveBeenCalled();
});

it("removes cached rows and follow-up actions when inspection authority is revoked", async () => {
  // Keep asset authority so the route stays mounted while inspection access changes.
  state.role = "OWNER";
  const view = await setup();
  await screen.findByRole("cell", { name: "Alex Tan" });
  state.canView = false;
  await view.queryClient.invalidateQueries({
    queryKey: ["tester", "app-access"],
  });
  await waitFor(() =>
    expect(screen.queryByRole("cell", { name: "Alex Tan" })).toBeNull()
  );
  expect(screen.queryByRole("link", { name: "Create work order" })).toBeNull();
  expect(screen.queryByRole("link", { name: "View record" })).toBeNull();
});

it.each([403, 503])(
  "hides cached rows after a history refetch fails with %s",
  async (status) => {
    const view = await setup();
    await screen.findByRole("cell", { name: "Alex Tan" });
    state.history.mockResolvedValue({
      error: { message: "Inspection history is unavailable." },
      response: new Response(null, { status }),
    });
    await view.queryClient.invalidateQueries({ queryKey: historyKey });
    await screen.findByRole("alert");
    expect(screen.queryByRole("cell", { name: "Alex Tan" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Create work order" })
    ).toBeNull();
    expect(screen.queryByText("No inspection records yet")).toBeNull();
  }
);

it("shows the saved Pass once when returning to asset history", async () => {
  state.history.mockResolvedValue(page([{ ...inspection, outcome: "PASS" }]));
  const view = await setup(`${assetPath}/inspections/new`);
  await chooseOption(
    await screen.findByRole("combobox", { name: "Outcome" }),
    "Pass"
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save inspection record" })
  );
  await waitFor(() =>
    expect(view.router.state.location.pathname).toBe(
      `${assetPath}/inspections/${inspectionId}`
    )
  );
  await view.router.navigate({
    to: "/estates/$estateId/assets/$assetId",
    params: { estateId, assetId },
  });
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  expect(
    within(table).getAllByRole("link", { name: "View record" })
  ).toHaveLength(1);
  within(table).getByText("Pass");
  within(table).getByText("Closed");
});

it("replaces awaiting follow-up with the linked reference after history invalidation", async () => {
  const view = await setup();
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  expect(within(table).queryByText("Awaiting work order")).toBeNull();
  state.history.mockResolvedValue(
    page([
      {
        ...inspection,
        workOrder: { id: workOrderId, reference: "OAK-W0001" },
      },
    ])
  );
  await view.queryClient.invalidateQueries({ queryKey: historyKey });
  await within(table).findByRole("link", { name: "OAK-W0001" });
  within(table).getByText("Fail");
  expect(
    within(table).getAllByRole("link", { name: "View record" })
  ).toHaveLength(1);
  expect(within(table).queryByText("Awaiting work order")).toBeNull();
  expect(
    within(table).queryByRole("link", { name: "Create work order" })
  ).toBeNull();
});

it("provides a named focusable scroll region and native links for keyboard users", async () => {
  await setup();
  const table = await screen.findByRole("table", {
    name: "Inspection records",
  });
  const region = screen.getByRole("region", {
    name: "Inspection records table",
  });
  expect(region.contains(table)).toBe(true);
  expect(region.tabIndex).toBe(0);
  region.focus();
  expect(document.activeElement).toBe(region);
  const link = within(table).getByRole("link", { name: "View record" });
  link.focus();
  expect(document.activeElement).toBe(link);
  expect(link.tagName).toBe("A");
  expect(link.tabIndex).toBe(0);
});
