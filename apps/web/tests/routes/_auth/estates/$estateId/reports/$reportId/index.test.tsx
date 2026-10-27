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
  workspaceAccess,
} from "@tests/fixtures/access";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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

const { get, post, auth, state } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  auth: { user: { id: "manager" }, loading: false },
  state: { role: "MANAGER", routing: null as unknown },
}));
vi.mock("@/lib/api", () => ({ api: { GET: get, POST: post } }));
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
const reportId = "00000000-0000-0000-0000-000000000010";
const workOrderId = "00000000-0000-0000-0000-000000000020";
const timestamp = "2026-10-01T00:00:00Z";
const SEND = /Send to contractor/;
const DISMISS = /^Dismiss/;
const RETRY = /Retry sending/;
const ROUTING = /^Routing$/;

const dispatch = {
  equipmentType: "LIFT",
  contractorName: "Acme Lifts",
  contractorEmail: "faults@acmelifts.example",
  approval: "MANAGER",
  status: "PENDING",
  sentAt: null,
  createdAt: timestamp,
};
const workOrder = {
  id: workOrderId,
  reference: "MG-W0042",
  status: "ASSIGNED",
  dispatch,
};
const review = {
  state: "NEEDS_REVIEW",
  reason: "Water near the lift lobby needs an on-site check",
  classification: {
    outcome: "INCONCLUSIVE",
    equipmentType: "LIFT",
    confidence: 0.62,
    reason: "Water near the lift lobby needs an on-site check",
    createdAt: timestamp,
  },
  workOrder: null,
  decidedAt: null,
};
const report = {
  id: reportId,
  title: "Water near lift",
  description: "water dripping near lift lobby",
  estateName: "Maple Estate",
  location: { id: reportId, label: "Block A › Level 4 › Lift lobby" },
  status: "SUBMITTED",
  createdAt: timestamp,
  updatedAt: timestamp,
  images: [],
};

function serve(requested: string) {
  if (requested === "/access/context") {
    const permission =
      state.role === "MANAGER"
        ? { ...ownerEstateAccess, estateId }
        : { ...crewEstateAccess, estateId };
    return Promise.resolve({
      data: { ...workspaceAccess, estates: [permission] },
    });
  }
  if (requested === "/estates/{estateId}/reports/{reportId}") {
    return Promise.resolve({ data: { ...report, routing: state.routing } });
  }
  if (requested === "/estates/{estateId}/contractors") {
    return Promise.resolve({
      data: [
        {
          equipmentType: "LIFT",
          name: "Acme Lifts",
          email: "faults@acmelifts.example",
          updatedAt: timestamp,
        },
      ],
    });
  }
  if (requested === "/estates/{estateId}/locations") {
    return Promise.resolve({ data: [] });
  }
  return Promise.resolve({ data: [] });
}

async function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [`/estates/${estateId}/reports/${reportId}`],
    }),
    context: { queryClient },
    defaultPendingMinMs: 0,
  });
  await router.load();
  return renderWithProviders(<RouterProvider router={router} />);
}

async function routingCard() {
  const heading = await screen.findByRole("heading", { name: ROUTING });
  return within(heading.closest("[data-slot=card]") as HTMLElement);
}

function detailRequests() {
  return get.mock.calls.filter(
    (call) => call[0] === "/estates/{estateId}/reports/{reportId}"
  ).length;
}

beforeEach(() => {
  auth.user = { id: "manager" };
  state.role = "MANAGER";
  state.routing = review;
  get.mockReset().mockImplementation(serve);
  post
    .mockReset()
    .mockResolvedValue({ data: { ...review, state: "WORK_ORDER", workOrder } });
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

afterEach(() => vi.useRealTimers());

it("shows why the system escalated the report and the model's assessment", async () => {
  await setup();
  const card = await routingCard();

  card.getByText("Needs review");
  card.getByText("Water near the lift lobby needs an on-site check", {
    selector: "dd",
  });
  card.getByText("Inconclusive · Lift · 62% confidence");
});

it("lets a manager send the report to the contractor for the chosen type", async () => {
  await setup();
  const card = await routingCard();
  fireEvent.click(card.getByRole("button", { name: SEND }));
  const dialog = within(await screen.findByRole("dialog"));
  const type = dialog.getByRole("combobox", { name: "Equipment type" });
  await chooseOption(type, "Lift");
  dialog.getByText(
    "Acme Lifts (faults@acmelifts.example) will receive the resident's words and photos."
  );
  const before = detailRequests();

  fireEvent.click(dialog.getByRole("button", { name: "Send work order" }));

  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/work-order",
      {
        params: { path: { estateId, reportId } },
        body: { equipmentType: "LIFT", priority: "MEDIUM" },
      }
    )
  );
  await waitFor(() => expect(detailRequests()).toBeGreaterThan(before));
});

it("lets a manager choose the work order's priority before sending", async () => {
  await setup();
  const card = await routingCard();
  fireEvent.click(card.getByRole("button", { name: SEND }));
  const dialog = within(await screen.findByRole("dialog"));
  await chooseOption(
    dialog.getByRole("combobox", { name: "Equipment type" }),
    "Lift"
  );
  await chooseOption(
    dialog.getByRole("combobox", { name: "Priority" }),
    "High"
  );

  fireEvent.click(dialog.getByRole("button", { name: "Send work order" }));

  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/work-order",
      {
        params: { path: { estateId, reportId } },
        body: { equipmentType: "LIFT", priority: "HIGH" },
      }
    )
  );
});

it("says when no contractor is set up for the chosen type and does not send", async () => {
  await setup();
  const card = await routingCard();
  fireEvent.click(card.getByRole("button", { name: SEND }));
  const dialog = within(await screen.findByRole("dialog"));

  await chooseOption(
    dialog.getByRole("combobox", { name: "Equipment type" }),
    "Gate"
  );

  dialog.getByText("No gate contractor is set up for this estate.");
  expect(
    (
      dialog.getByRole("button", {
        name: "Send work order",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
});

it("links to contractor setup when the chosen type has no contractor", async () => {
  await setup();
  const card = await routingCard();
  fireEvent.click(card.getByRole("button", { name: SEND }));
  const dialog = within(await screen.findByRole("dialog"));

  await chooseOption(
    dialog.getByRole("combobox", { name: "Equipment type" }),
    "Gate"
  );

  expect(
    dialog
      .getByRole("link", { name: "Set up contractors" })
      .getAttribute("href")
  ).toBe(`/estates/${estateId}/contractors`);
});

it("dismisses an escalated report only after confirmation", async () => {
  post.mockResolvedValue({
    data: { ...review, state: "DISMISSED", decidedAt: timestamp },
  });
  await setup();
  const card = await routingCard();
  fireEvent.click(card.getByRole("button", { name: DISMISS }));
  const dialog = within(await screen.findByRole("dialog"));
  expect(post).not.toHaveBeenCalled();

  fireEvent.click(dialog.getByRole("button", { name: "Dismiss report" }));

  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/dismiss",
      { params: { path: { estateId, reportId } } }
    )
  );
});

it("shows the work order and lets a manager retry one that failed to send", async () => {
  state.routing = {
    ...review,
    state: "WORK_ORDER",
    workOrder: { ...workOrder, dispatch: { ...dispatch, status: "FAILED" } },
  };
  await setup();
  const card = await routingCard();

  card.getByText("Work order created");
  const link = card.getByRole("link", { name: "MG-W0042" });
  expect(link.getAttribute("href")).toBe(
    `/estates/${estateId}/work-orders/${workOrderId}`
  );
  card.getByText("· Assigned", { exact: false });
  card.getByText("Acme Lifts (faults@acmelifts.example)");
  card.getByText("Failed to send");
  expect(card.queryByRole("button", { name: SEND })).toBeNull();
  fireEvent.click(card.getByRole("button", { name: RETRY }));

  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      "/estates/{estateId}/work-orders/{workOrderId}/dispatch/retry",
      { params: { path: { estateId, workOrderId } } }
    )
  );
});

it("says when the system sent the work order on its own", async () => {
  state.routing = {
    ...review,
    state: "WORK_ORDER",
    workOrder: {
      ...workOrder,
      dispatch: {
        ...dispatch,
        approval: "AUTOMATIC",
        status: "SENT",
        sentAt: timestamp,
      },
    },
  };
  await setup();
  const card = await routingCard();

  card.getByText("Sent automatically");
  card.getByText(`Sent ${new Date(timestamp).toLocaleString()}`);
});

it("shows crew the routing and the contractor but no decisions", async () => {
  state.role = "CREW";
  state.routing = {
    ...review,
    state: "WORK_ORDER",
    workOrder: { ...workOrder, dispatch: { ...dispatch, status: "FAILED" } },
  };
  await setup();
  const card = await routingCard();

  card.getByText("Acme Lifts (faults@acmelifts.example)");
  expect(card.queryByRole("button", { name: RETRY })).toBeNull();
  expect(card.queryByRole("button", { name: SEND })).toBeNull();
  expect(card.queryByRole("button", { name: DISMISS })).toBeNull();
});

it("shows no routing for a report submitted before routing existed", async () => {
  state.routing = null;
  await setup();
  await screen.findByRole("heading", { name: "Water near lift" });

  expect(screen.queryByRole("heading", { name: ROUTING })).toBeNull();
});

it("checks again every few seconds while the report is being classified", async () => {
  state.routing = {
    ...review,
    state: "CLASSIFYING",
    reason: null,
    classification: null,
  };
  await setup();
  const card = await routingCard();
  card.getByText("Classifying");
  const before = detailRequests();

  await waitFor(() => expect(detailRequests()).toBeGreaterThan(before), {
    timeout: 7000,
  });
}, 10_000);
