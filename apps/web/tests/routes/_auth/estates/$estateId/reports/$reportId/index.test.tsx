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

const { get, patch, put, state } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  state: { manager: true },
}));
vi.mock("@/lib/api", () => ({ api: { GET: get, PATCH: patch, PUT: put } }));
vi.mock("@/lib/access-server", () => ({
  getSessionIdentity: async () => ({ id: "staff" }),
  getSessionAccess: async () => ({
    user: { id: "staff" },
    access: (await get("/access/context")).data,
  }),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "staff" }, loading: false }),
}));

const estateId = "00000000-0000-0000-0000-000000000001";
const reportId = "00000000-0000-0000-0000-000000000010";
const originalId = "00000000-0000-0000-0000-000000000020";
const otherId = "00000000-0000-0000-0000-000000000030";
const timestamp = "2026-10-01T00:00:00Z";
const detailPath = `/estates/${estateId}/reports/${reportId}`;
const location = { id: "loc", label: "Block A › Level 4" };
const POSSIBLE_DUPLICATE_OF = /Possible duplicate of/u;
const DUPLICATE_OF = /^Duplicate of/u;
const CHANGED = /changed/iu;
const LINK_TO_ORIGINAL = /Link to its original instead/u;
const NO_OWN_WORK_ORDER = /cannot get its own work order/iu;
const REJECT_TO_ALLOW = /reject the link/iu;

const base = {
  id: reportId,
  title: "Water on floor",
  description: "Puddle by the lift",
  estateName: "Maple Estate",
  location,
  status: "SUBMITTED",
  createdAt: timestamp,
  updatedAt: timestamp,
  images: [],
  confirmedDuplicateCount: 0,
  suspectedDuplicateCount: 0,
  duplicateOf: null as null | {
    reportId: string;
    title: string;
    state: string;
  },
  duplicates: [] as {
    reportId: string;
    title: string;
    location: typeof location;
    state: string;
    createdAt: string;
  }[],
};
let report = base;

function access() {
  const estate = state.manager
    ? {
        ...ownerEstateAccess,
        canReviewFaultReportDuplicates: true,
      }
    : { ...crewEstateAccess, canReviewFaultReportDuplicates: false };
  return {
    ...workspaceAccess,
    estates: [{ ...estate, estateId, estateName: "Maple Estate" }],
  };
}

beforeEach(() => {
  state.manager = true;
  report = { ...base };
  patch.mockReset();
  put.mockReset();
  get.mockReset().mockImplementation((path: string) => {
    if (path === "/access/context") {
      return Promise.resolve({ data: access() });
    }
    if (path.endsWith("/reports/{reportId}")) {
      return Promise.resolve({ data: report });
    }
    if (path.endsWith("/reports")) {
      return Promise.resolve({
        data: {
          items: [
            { ...base, id: reportId, title: "Water on floor" },
            { ...base, id: originalId, title: "Leaking pipe" },
          ],
          nextCursor: null,
        },
      });
    }
    return Promise.resolve({ data: [] });
  });
});

async function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [detailPath] }),
    context: { queryClient },
    defaultPendingMinMs: 0,
  });
  await router.load();
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

function linkedTo(linkState: string) {
  report = {
    ...base,
    duplicateOf: {
      reportId: originalId,
      title: "Leaking pipe",
      state: linkState,
    },
  };
}

it("names the original of a suspected duplicate and links to it", async () => {
  linkedTo("SUSPECTED");
  await setup();
  const section = within(
    await screen.findByRole("region", { name: "Duplicate" })
  );
  section.getByText(POSSIBLE_DUPLICATE_OF);
  const link = section.getByRole("link", { name: "Leaking pipe" });
  expect(link.getAttribute("href")).toBe(
    `/estates/${estateId}/reports/${originalId}`
  );
});

it("lets managers confirm a suspected duplicate using the state they saw", async () => {
  linkedTo("SUSPECTED");
  patch.mockImplementation(() => {
    // The server persists the decision, so the follow-up refetch sees it too.
    linkedTo("CONFIRMED");
    return Promise.resolve({ data: report });
  });
  await setup();
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  await waitFor(() =>
    expect(patch).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/duplicate",
      {
        params: { path: { estateId, reportId } },
        body: { state: "CONFIRMED", expectedState: "SUSPECTED" },
      }
    )
  );
  await screen.findByText(DUPLICATE_OF);
});

it("lets managers reject a suspected duplicate", async () => {
  linkedTo("SUSPECTED");
  patch.mockResolvedValue({ data: base });
  await setup();
  fireEvent.click(
    await screen.findByRole("button", { name: "Not a duplicate" })
  );
  await waitFor(() =>
    expect(patch).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/duplicate",
      expect.objectContaining({
        body: { state: "REJECTED", expectedState: "SUSPECTED" },
      })
    )
  );
});

it("offers only Not a duplicate on a confirmed duplicate", async () => {
  linkedTo("CONFIRMED");
  await setup();
  const section = within(
    await screen.findByRole("region", { name: "Duplicate" })
  );
  section.getByText(DUPLICATE_OF);
  expect(section.queryByRole("button", { name: "Confirm" })).toBeNull();
  fireEvent.click(section.getByRole("button", { name: "Not a duplicate" }));
  await waitFor(() =>
    expect(patch).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/duplicate",
      expect.objectContaining({
        body: { state: "REJECTED", expectedState: "CONFIRMED" },
      })
    )
  );
});

it("shows no review or link controls without the review capability", async () => {
  state.manager = false;
  linkedTo("SUSPECTED");
  await setup();
  await screen.findByRole("link", { name: "Leaking pipe" });
  expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Not a duplicate" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Original report" })).toBeNull();
});

it("explains a review conflict and reloads the report", async () => {
  linkedTo("SUSPECTED");
  patch.mockResolvedValue({
    error: { message: "The duplicate link changed. Reload before deciding." },
    response: { status: 409 },
  });
  await setup();
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  const alert = await screen.findByRole("alert");
  within(alert).getByText(CHANGED);
  const calls = get.mock.calls.length;
  fireEvent.click(within(alert).getByRole("button", { name: "Reload" }));
  await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(calls));
});

it("lists an original's duplicates with their counts", async () => {
  report = {
    ...base,
    confirmedDuplicateCount: 1,
    suspectedDuplicateCount: 1,
    duplicates: [
      {
        reportId: otherId,
        title: "Leak again",
        location,
        state: "SUSPECTED",
        createdAt: timestamp,
      },
      {
        reportId: originalId,
        title: "Dripping ceiling",
        location,
        state: "CONFIRMED",
        createdAt: timestamp,
      },
    ],
  };
  await setup();
  const section = within(
    await screen.findByRole("region", { name: "Duplicates" })
  );
  section.getByText("1 confirmed");
  section.getByText("1 to review");
  const items = section.getAllByRole("listitem");
  expect(items).toHaveLength(2);
  within(items[0] as HTMLElement).getByRole("link", { name: "Leak again" });
  within(items[0] as HTMLElement).getByText("Possible duplicate");
  within(items[1] as HTMLElement).getByText("Duplicate");
  expect(screen.queryByRole("button", { name: "Original report" })).toBeNull();
});

it("lets managers link an unlinked report to an original by hand", async () => {
  put.mockImplementation(() => {
    linkedTo("CONFIRMED");
    return Promise.resolve({ data: report });
  });
  await setup();
  const link = await screen.findByRole("button", {
    name: "Link as duplicate",
  });
  expect(link.hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Original report" }));
  const dialog = within(await screen.findByRole("dialog"));
  expect(dialog.queryByRole("button", { name: "Water on floor" })).toBeNull();
  fireEvent.click(await dialog.findByRole("button", { name: "Leaking pipe" }));
  await waitFor(() => expect(link.hasAttribute("disabled")).toBe(false));
  fireEvent.click(link);
  await waitFor(() =>
    expect(put).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/duplicate",
      {
        params: { path: { estateId, reportId } },
        body: { originalReportId: originalId },
      }
    )
  );
  await screen.findByText(DUPLICATE_OF);
});

it("shows the server's reason when a manual link is refused", async () => {
  put.mockResolvedValue({
    error: {
      message:
        "That report is itself a duplicate. Link to its original instead.",
    },
    response: { status: 400 },
  });
  await setup();
  fireEvent.click(
    await screen.findByRole("button", { name: "Original report" })
  );
  fireEvent.click(
    await within(await screen.findByRole("dialog")).findByRole("button", {
      name: "Leaking pipe",
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "Link as duplicate" }));
  await screen.findByText(LINK_TO_ORIGINAL);
});

it("offers Create work order on an unlinked report", async () => {
  await setup();
  await screen.findByRole("link", { name: "Create work order" });
});

it("hides Create work order on a suspected duplicate and explains why", async () => {
  linkedTo("SUSPECTED");
  await setup();
  const section = within(
    await screen.findByRole("region", { name: "Duplicate" })
  );
  section.getByText(NO_OWN_WORK_ORDER);
  section.getByText(REJECT_TO_ALLOW);
  expect(screen.queryByRole("link", { name: "Create work order" })).toBeNull();
});

it("hides Create work order on a confirmed duplicate", async () => {
  linkedTo("CONFIRMED");
  await setup();
  const section = within(
    await screen.findByRole("region", { name: "Duplicate" })
  );
  section.getByText(NO_OWN_WORK_ORDER);
  expect(section.queryByText(REJECT_TO_ALLOW)).toBeNull();
  expect(screen.queryByRole("link", { name: "Create work order" })).toBeNull();
});
