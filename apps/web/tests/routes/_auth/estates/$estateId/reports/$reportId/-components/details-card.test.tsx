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

const { get, post, put, auth, state } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  auth: { user: { id: "manager" }, loading: false },
  state: { role: "MANAGER", routing: null as unknown },
}));
vi.mock("@/lib/api", () => ({ api: { GET: get, POST: post, PUT: put } }));
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
const timestamp = "2026-10-01T00:00:00Z";

const review = {
  state: "NEEDS_REVIEW",
  reason: "Water near the lift lobby needs an on-site check",
  classification: {
    outcome: "INCONCLUSIVE",
    equipmentType: "LIFT",
    confidence: 0.62,
    reason: "Water near the lift lobby needs an on-site check",
    category: "WATER_LEAK",
    manual: false,
    classifiedByName: null,
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
  urgency: "MEDIUM",
  isSafety: false,
  createdAt: timestamp,
  updatedAt: timestamp,
  images: [],
  confirmedDuplicateCount: 0,
  suspectedDuplicateCount: 0,
  duplicateOf: null,
  duplicates: [],
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
      data: {
        contractors: [
          {
            id: "acme",
            name: "Acme Lifts",
            email: "faults@acmelifts.example",
            defaultFor: ["LIFT"],
          },
        ],
      },
    });
  }
  if (requested === "/estates/{estateId}/locations") {
    return Promise.resolve({ data: [] });
  }
  if (requested === "/estates/{estateId}/reports") {
    // The duplicate section's report picker (ID-74) lists the estate's reports.
    return Promise.resolve({ data: { items: [], nextCursor: null } });
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

async function detailsCard() {
  const heading = await screen.findByRole("heading", { name: "Details" });
  return within(heading.closest("[data-slot=card]") as HTMLElement);
}

beforeEach(() => {
  auth.user = { id: "manager" };
  state.role = "MANAGER";
  state.routing = review;
  get.mockReset().mockImplementation(serve);
  post.mockReset();
  put.mockReset().mockResolvedValue({ data: review });
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

it("titles the page with the report and shows its status and urgency in plain words", async () => {
  await setup();

  await screen.findByRole("heading", { level: 1, name: "Water near lift" });
  screen.getByText("Submitted", { selector: "[data-slot=badge]" });
  screen.getByText("Medium urgency");
  expect(screen.queryByText("SUBMITTED")).toBeNull();
});

it("shows what was reported", async () => {
  await setup();
  const heading = await screen.findByRole("heading", {
    name: "What was reported",
  });
  const card = within(heading.closest("[data-slot=card]") as HTMLElement);

  card.getByText("water dripping near lift lobby");
  card.getByText("No photos.");
});

it("shows the estate, location and the automatically chosen type", async () => {
  await setup();
  const card = await detailsCard();

  card.getByText("Maple Estate");
  card.getByText("Block A › Level 4 › Lift lobby");
  card.getByText("Water leak");
  card.getByText("Sorted automatically, 62% sure");
});

it("says who changed the type by hand", async () => {
  state.routing = {
    ...review,
    classification: {
      ...review.classification,
      category: "RUBBISH",
      manual: true,
      classifiedByName: "Jane Tan",
    },
  };
  await setup();
  const card = await detailsCard();

  card.getByText("Rubbish or litter");
  card.getByText(
    `Changed by Jane Tan, ${new Date(timestamp).toLocaleString()}`
  );
});

it("says when a report has not been sorted into a type", async () => {
  state.routing = {
    ...review,
    classification: { ...review.classification, category: null },
  };
  await setup();
  const card = await detailsCard();

  card.getByText("Not sorted into a type yet");
});

it("lets a manager change the report's type", async () => {
  await setup();
  const card = await detailsCard();
  fireEvent.click(card.getByRole("button", { name: "Change type" }));
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.getAllByRole("radio")).toHaveLength(10);
  const before = get.mock.calls.length;

  fireEvent.click(dialog.getByRole("radio", { name: "Rubbish or litter" }));
  fireEvent.click(dialog.getByRole("button", { name: "Save type" }));

  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/category",
      {
        params: { path: { estateId, reportId } },
        body: { category: "RUBBISH" },
      }
    )
  );
  await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(before));
});

it("shows why the type could not be changed", async () => {
  put.mockResolvedValue({
    error: {
      message: "This report is still being sorted. Try again in a minute.",
    },
    response: { status: 409 },
  });
  await setup();
  const card = await detailsCard();
  fireEvent.click(card.getByRole("button", { name: "Change type" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByRole("radio", { name: "Noise" }));
  fireEvent.click(dialog.getByRole("button", { name: "Save type" }));

  await dialog.findByText(
    "This report is still being sorted. Try again in a minute."
  );
});

it("does not let crew change the type", async () => {
  state.role = "CREW";
  await setup();
  const card = await detailsCard();

  card.getByText("Water leak");
  expect(card.queryByRole("button", { name: "Change type" })).toBeNull();
});

it("does not offer a type change while the report is being sorted", async () => {
  state.routing = { ...review, state: "CLASSIFYING", classification: null };
  await setup();
  const card = await detailsCard();

  expect(card.queryByRole("button", { name: "Change type" })).toBeNull();
});
