import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent } from "@testing-library/react";
import { crewEstateAccess, workspaceAccess } from "@tests/fixtures/access";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

// Use the registered application routes, so missing report screens fail through
// visible behavior rather than imports of components that do not exist yet.
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

const { get, patch, auth, listeners } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  auth: { user: { id: "crew-user" }, loading: false },
  listeners: new Set<() => void>(),
}));
vi.mock("@/lib/api", () => ({ api: { GET: get, PATCH: patch } }));
vi.mock("@/lib/access-server", () => ({
  getSessionIdentity: () => Promise.resolve(auth.user),
  getSessionAccess: async () => {
    const result = await get("/access/context");
    return { user: auth.user, access: result.data };
  },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useAuth: () => ({
      ...auth,
      user: useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => auth.user
      ),
    }),
  };
});

const estateId = "00000000-0000-0000-0000-000000000001";
const blockA = "00000000-0000-0000-0000-000000000002";
const levelA = "00000000-0000-0000-0000-000000000003";
const lobbyA = "00000000-0000-0000-0000-000000000004";
const blockB = "00000000-0000-0000-0000-000000000005";
const levelB = "00000000-0000-0000-0000-000000000006";
const lobbyB = "00000000-0000-0000-0000-000000000007";
const oldArea = "00000000-0000-0000-0000-000000000008";
const courtyard = "00000000-0000-0000-0000-000000000009";
const reportId = "00000000-0000-0000-0000-000000000010";
const oldBlock = "00000000-0000-0000-0000-000000000012";
const imageId = "00000000-0000-0000-0000-000000000011";
const basePath = `/estates/${estateId}/reports`;
const timestamp = "2026-10-01T00:00:00Z";
const FILTERS_BUTTON = /Filters/iu;
const URGENCY_MEDIUM_HIGH = /Medium → High/u;
const CHANGE_AUTHOR = /Alex Tan/u;
const CHANGE_LOCATION = /Change location/iu;
const SAVE = /^Save/iu;
const NEXT = /^Next/iu;
const RETRY = /Retry/iu;
const RELOAD = /Reload/iu;
const LOCATION_CHANGED = /location.*changed|placement.*changed/iu;
const NO_MATCHES = /no.*reports.*location|no.*matching.*reports/iu;
const EMPTY_REPORTS = /no.*reports/iu;
const DUPLICATE_BADGE = /duplicate|to review/iu;

const LEVEL_TWO = /Level 2/u;
const NONE = /none|no common area|level only/iu;
const UNAVAILABLE = /unavailable|unable|not found/iu;
const NO_DESTINATIONS =
  /no.*locations.*in use|no.*active.*locations|no.*destinations|no.*locations.*available/iu;

const report = {
  id: reportId,
  title: "Lift lobby leak",
  description: "Water pooling near the lift",
  estateName: "Maple Estate",
  location: { id: lobbyA, label: "Block A › Level 4 › Lift lobby" },
  status: "SUBMITTED",
  createdAt: timestamp,
  updatedAt: timestamp,
  images: [{ id: imageId, contentType: "image/png" }],
  confirmedDuplicateCount: 0,
  suspectedDuplicateCount: 0,
  duplicateOf: null,
  duplicates: [],
};
const locations = [
  { id: blockA, type: "BLOCK", name: "Block A", parentId: null },
  {
    id: levelA,
    type: "LEVEL",
    name: "Level 4",
    parentId: blockA,
    sortOrder: 4,
  },
  { id: lobbyA, type: "COMMON_AREA", name: "Lift lobby", parentId: levelA },
  { id: blockB, type: "BLOCK", name: "Block B", parentId: null },
  {
    id: oldBlock,
    type: "BLOCK",
    name: "Old block",
    parentId: null,
    deactivatedAt: timestamp,
  },
  {
    id: levelB,
    type: "LEVEL",
    name: "Level 2",
    parentId: blockB,
    sortOrder: 2,
  },
  { id: lobbyB, type: "COMMON_AREA", name: "Stair lobby", parentId: levelB },
  { id: courtyard, type: "COMMON_AREA", name: "Courtyard", parentId: blockB },
  {
    id: oldArea,
    type: "COMMON_AREA",
    name: "Old lobby",
    parentId: levelA,
    deactivatedAt: timestamp,
  },
].map((location) => ({
  ...location,
  createdAt: timestamp,
  updatedAt: timestamp,
}));

function access(canRelocate = true) {
  return {
    ...workspaceAccess,
    canCreateEstate: false,
    estates: [
      {
        ...crewEstateAccess,
        estateId,
        canRelocateFaultReports: canRelocate,
      },
    ],
  };
}

function serve(path: string) {
  if (path === "/access/context") {
    return Promise.resolve({ data: access() });
  }
  if (path.endsWith("/locations")) {
    return Promise.resolve({ data: locations });
  }
  if (path.endsWith("/images/{imageId}")) {
    return Promise.resolve({
      data: new Blob(["image"], { type: "image/png" }),
    });
  }
  if (path.endsWith("/reports/{reportId}")) {
    return Promise.resolve({ data: report });
  }
  if (path.endsWith("/reports")) {
    return Promise.resolve({ data: { items: [report], nextCursor: null } });
  }
  return Promise.resolve({ data: [] });
}

async function setup(path = basePath) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
    defaultPendingMinMs: 0,
    defaultErrorComponent: () => <p role="alert">Report unavailable</p>,
    defaultNotFoundComponent: () => <p role="alert">Report unavailable</p>,
  });
  await router.load();
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

async function openCorrection() {
  await setup(`${basePath}/${reportId}`);
  fireEvent.click(await screen.findByRole("button", { name: CHANGE_LOCATION }));
  return within(await screen.findByRole("dialog"));
}

it("explains that no level requires a block common area", async () => {
  const dialog = await openCorrection();
  await chooseOption(
    dialog.getByRole("combobox", { name: "Level" }),
    "No level (block common area)"
  );
  await dialog.findByText(
    "Choose a common area under this block, or select a level."
  );
  expect(
    dialog.getByRole("combobox", { name: "Common area" }).textContent
  ).toContain("Choose a block common area");
  expect(
    dialog.getByRole("button", { name: SAVE }).hasAttribute("disabled")
  ).toBe(true);
});

beforeEach(() => {
  auth.user = { id: "crew-user" };
  get.mockReset().mockImplementation(serve);
  patch.mockReset().mockResolvedValue({
    data: {
      ...report,
      location: { id: lobbyB, label: "Block B › Level 2 › Stair lobby" },
    },
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:staff-report-image");
      static revokeObjectURL = vi.fn();
    }
  );
});

afterEach(() => vi.unstubAllGlobals());

it("starts report detail breadcrumbs at Fault reports and names the report", async () => {
  const { router } = await setup(`${basePath}/${reportId}`);
  await screen.findByRole("heading", { name: report.title });
  const breadcrumbs = within(
    screen.getByRole("navigation", { name: "Breadcrumbs" })
  );
  expect(
    breadcrumbs.getAllByRole("link").map((link) => link.textContent)
  ).toEqual(["Fault reports"]);
  expect(breadcrumbs.getByText(report.title).getAttribute("aria-current")).toBe(
    "page"
  );
  fireEvent.click(breadcrumbs.getByRole("link", { name: "Fault reports" }));
  await waitFor(() => expect(router.state.location.pathname).toBe(basePath));
  await screen.findByRole("link", { name: report.title });
});

it("shows no breadcrumbs on the top-level fault report list", async () => {
  await setup();
  await screen.findByRole("link", { name: report.title });
  expect(screen.queryByRole("navigation", { name: "Breadcrumbs" })).toBeNull();
});

it("labels each estate report's metadata like the resident report cards", async () => {
  await setup();
  await screen.findByRole("link", { name: report.title });
  for (const label of [
    "Estate name:",
    "Location:",
    "Status:",
    "Submission time:",
  ]) {
    screen.getByText(label);
  }
  screen.getByText(report.estateName);
  screen.getByText(report.location.label);
  screen.getByText(report.status);
  screen.getByText(new Date(report.createdAt).toLocaleString());
});

it("shows estate reports with full location paths and links to estate-scoped detail", async () => {
  await setup();
  const link = await screen.findByRole("link", { name: report.title });
  expect(link.getAttribute("href")).toBe(`${basePath}/${reportId}`);
  screen.getByText(report.location.label);
  screen.getByText(report.status);
  expect(get).toHaveBeenCalledWith(
    "/estates/{estateId}/reports",
    expect.objectContaining({
      params: expect.objectContaining({ path: { estateId } }),
    })
  );
});

it("restores block and position filters from the URL and requests historical blocks", async () => {
  await setup(
    `${basePath}?blockId=${blockA}&minLevelPosition=-1&maxLevelPosition=4`
  );
  const block = await screen.findByRole("combobox", { name: "Block" });
  expect((block as HTMLInputElement).value).toBe("Block A");
  expect(
    (
      screen.getByRole("combobox", {
        name: "Minimum position",
      }) as HTMLInputElement
    ).value
  ).toBe("-1");
  expect(
    (
      screen.getByRole("combobox", {
        name: "Maximum position",
      }) as HTMLInputElement
    ).value
  ).toBe("4");
  expect(get).toHaveBeenCalledWith(
    "/estates/{estateId}/reports",
    expect.objectContaining({
      params: {
        path: { estateId },
        query: expect.objectContaining({
          blockId: blockA,
          minLevelPosition: -1,
          maxLevelPosition: 4,
        }),
      },
    })
  );
  expect(get).toHaveBeenCalledWith(
    "/estates/{estateId}/locations",
    expect.objectContaining({
      params: { path: { estateId }, query: { includeInactive: true } },
    })
  );
});

it("searches block names, selects inactive blocks by ID and resets the cursor while keeping the range", async () => {
  const { router } = await setup(
    `${basePath}?minLevelPosition=-1&cursor=old-page`
  );
  const block = await screen.findByRole("combobox", { name: "Block" });
  fireEvent.keyDown(block, { key: "ArrowDown" });
  fireEvent.change(block, { target: { value: "Old" } });
  const option = await screen.findByRole("option", {
    name: "Old block (Inactive)",
  });
  expect(screen.queryByRole("option", { name: "Block A" })).toBeNull();
  expect(screen.queryByRole("option", { name: LEVEL_TWO })).toBeNull();
  await waitFor(() => {
    fireEvent.click(option);
    expect(router.state.location.search).toEqual({
      blockId: oldBlock,
      minLevelPosition: -1,
    });
  });
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      "/estates/{estateId}/reports",
      expect.objectContaining({
        params: {
          path: { estateId },
          query: expect.objectContaining({
            blockId: oldBlock,
            minLevelPosition: -1,
            cursor: undefined,
          }),
        },
      })
    )
  );
});

it("does not change the selected block or pending position bounds while clearing the block search", async () => {
  const { router } = await setup(`${basePath}?blockId=${blockA}`);
  const block = await screen.findByRole("combobox", { name: "Block" });
  fireEvent.change(screen.getByRole("combobox", { name: "Minimum position" }), {
    target: { value: "-1" },
  });
  await act(() => {
    fireEvent.change(block, { target: { value: "" } });
  });
  expect(router.state.location.search).toEqual({ blockId: blockA });
  expect(
    (
      screen.getByRole("combobox", {
        name: "Minimum position",
      }) as HTMLInputElement
    ).value
  ).toBe("-1");
});

it("applies numeric range bounds, resets pagination and keeps filters on next and first page", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/reports")
      ? Promise.resolve({ data: { items: [report], nextCursor: "next-page" } })
      : serve(path)
  );
  const { router } = await setup(
    `${basePath}?blockId=${blockA}&cursor=old-page`
  );
  fireEvent.change(
    await screen.findByRole("combobox", { name: "Minimum position" }),
    { target: { value: "-1" } }
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Maximum position" }), {
    target: { value: "0" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await waitFor(() =>
    expect(router.state.location.search).toEqual({
      blockId: blockA,
      minLevelPosition: -1,
      maxLevelPosition: 0,
    })
  );
  fireEvent.click(await screen.findByRole("button", { name: NEXT }));
  await waitFor(() =>
    expect(router.state.location.search).toEqual({
      blockId: blockA,
      minLevelPosition: -1,
      maxLevelPosition: 0,
      cursor: "next-page",
    })
  );
  fireEvent.click(await screen.findByRole("button", { name: "Previous page" }));
  await waitFor(() =>
    expect(router.state.location.search).toEqual({
      blockId: blockA,
      minLevelPosition: -1,
      maxLevelPosition: 0,
    })
  );
});

it("clears block and range filters together and restores the controls on browser back", async () => {
  const path = `${basePath}?blockId=${blockA}&minLevelPosition=0&maxLevelPosition=4`;
  const { router } = await setup(path);
  fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
  await waitFor(() => {
    expect(router.state.location.search).toEqual({});
    expect(
      (
        screen.getByRole("combobox", {
          name: "Minimum position",
        }) as HTMLInputElement
      ).value
    ).toBe("");
    expect(
      (screen.getByRole("combobox", { name: "Block" }) as HTMLInputElement)
        .value
    ).toBe("All blocks");
  });
  await act(() => {
    router.history.back();
  });
  await waitFor(() => {
    expect(
      (screen.getByRole("combobox", { name: "Block" }) as HTMLInputElement)
        .value
    ).toBe("Block A");
    expect(
      (
        screen.getByRole("combobox", {
          name: "Minimum position",
        }) as HTMLInputElement
      ).value
    ).toBe("0");
  });
});

it("keeps report filters collapsed until the Filters toggle opens them", async () => {
  await setup();
  const toggle = await screen.findByRole("button", { name: "Filters" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("search", { name: "Filter reports" })).toBeNull();
  fireEvent.click(toggle);
  await screen.findByRole("search", { name: "Filter reports" });
});

it("shows a range validation error without sending reversed bounds", async () => {
  await setup();
  fireEvent.click(await screen.findByRole("button", { name: "Filters" }));
  fireEvent.change(
    await screen.findByRole("combobox", { name: "Minimum position" }),
    { target: { value: "4" } }
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Maximum position" }), {
    target: { value: "-1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await screen.findByRole("alert");
  expect(
    get.mock.calls.some(
      ([path, options]) =>
        path.endsWith("/reports") &&
        options?.params?.query?.minLevelPosition === 4
    )
  ).toBe(false);
});

it.each([
  "minLevelPosition=1.5",
  "maxLevelPosition=abc",
  "minLevelPosition=2147483648",
  "minLevelPosition=2&maxLevelPosition=1",
])("rejects invalid URL bounds: %s", async (query) => {
  await setup(`${basePath}?${query}`);
  await screen.findByRole("alert");
  expect(
    get.mock.calls.some(([path]) => path === "/estates/{estateId}/reports")
  ).toBe(false);
});

it("distinguishes an empty estate from a filter with no matching reports", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/reports")
      ? Promise.resolve({ data: { items: [], nextCursor: null } })
      : serve(path)
  );
  const { router } = await setup();
  await screen.findByText(EMPTY_REPORTS);
  await act(async () => {
    await router.navigate({ href: `${basePath}?blockId=${blockA}` });
  });
  await screen.findByText(NO_MATCHES);
  screen.getByRole("button", { name: "Filters, 1 active" });
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await screen.findByText(EMPTY_REPORTS);
});

it("preserves the selected filter while retrying a failed list request", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/reports")
      ? Promise.resolve({
          error: { message: "Unavailable" },
          response: new Response(null, { status: 503 }),
        })
      : serve(path)
  );
  const { router } = await setup(`${basePath}?blockId=${blockA}`);
  await screen.findByRole("alert");
  get.mockImplementation(serve);
  fireEvent.click(screen.getByRole("button", { name: RETRY }));
  await screen.findByRole("link", { name: report.title });
  expect(router.state.location.search).toMatchObject({ blockId: blockA });
});

it.each(["URGENCY", "NEWEST", "OLDEST"])(
  "offers first-page recovery for an outdated cursor in %s order",
  async (sort) => {
    get.mockImplementation((path: string) =>
      path.endsWith("/reports")
        ? Promise.resolve({
            error: {
              message:
                "Invalid or mismatched report cursor. Reload the first page.",
            },
            response: new Response(null, { status: 400 }),
          })
        : serve(path)
    );
    const { router } = await setup(
      `${basePath}?sort=${sort}&openOnly=false&blockId=${blockA}&minLevelPosition=-1&maxLevelPosition=4&cursor=outdated-page`
    );
    const recover = await screen.findByRole("button", {
      name: "Return to first page",
    });
    get.mockImplementation(serve);
    fireEvent.click(recover);
    await screen.findByRole("link", { name: report.title });
    expect(router.state.location.search).toEqual({
      blockId: blockA,
      minLevelPosition: -1,
      maxLevelPosition: 4,
      openOnly: false,
      ...(sort === "URGENCY" ? {} : { sort }),
    });
    expect(screen.queryByRole("alert")).toBeNull();
  }
);

it("keeps Retry for a transient page failure during recovery", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/reports")
      ? Promise.resolve({
          error: { message: "Unavailable" },
          response: new Response(null, { status: 503 }),
        })
      : serve(path)
  );
  const { router } = await setup(
    `${basePath}?sort=OLDEST&blockId=${blockA}&cursor=current-page`
  );
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("button", { name: "Return to first page" })
  ).toBeNull();
  get.mockImplementation(serve);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("link", { name: report.title });
  expect(router.state.location.search).toMatchObject({
    sort: "OLDEST",
    blockId: blockA,
    cursor: "current-page",
  });
});

it("keeps Retry when no page cursor needs recovery", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/reports")
      ? Promise.resolve({
          error: { message: "Invalid request" },
          response: new Response(null, { status: 400 }),
        })
      : serve(path)
  );
  await setup();
  await screen.findByRole("button", { name: "Retry" });
  expect(
    screen.queryByRole("button", { name: "Return to first page" })
  ).toBeNull();
});

it("loads detail and private images through responder endpoints and revokes image URLs on unmount", async () => {
  const { unmount } = await setup(`${basePath}/${reportId}`);
  await screen.findByRole("heading", { name: report.title });
  screen.getByText(report.description);
  screen.getByText(report.location.label);
  expect(
    (await screen.findByRole("img", { name: "Submitted fault" })).getAttribute(
      "src"
    )
  ).toBe("blob:staff-report-image");
  expect(get).toHaveBeenCalledWith(
    "/estates/{estateId}/reports/{reportId}/images/{imageId}",
    expect.objectContaining({
      params: { path: { estateId, reportId, imageId } },
    })
  );
  expect(get.mock.calls.some(([path]) => path.startsWith("/resident/"))).toBe(
    false
  );
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:staff-report-image");
});

it("lets staff change block, level and common area while preserving the report text and images", async () => {
  const dialog = await openCorrection();
  expect(dialog.getByRole("combobox", { name: "Block" }).textContent).toContain(
    "Block A"
  );
  expect(dialog.getByRole("combobox", { name: "Level" }).textContent).toContain(
    "Level 4"
  );
  expect(
    dialog.getByRole("combobox", { name: "Common area" }).textContent
  ).toContain("Lift lobby");
  await chooseOption(
    dialog.getByRole("combobox", { name: "Block" }),
    "Block B"
  );
  expect(
    dialog.getByRole("combobox", { name: "Level" }).textContent
  ).not.toContain("Level 4");
  expect(
    dialog.getByRole("combobox", { name: "Common area" }).textContent
  ).not.toContain("Lift lobby");
  expect(
    (dialog.getByRole("button", { name: SAVE }) as HTMLButtonElement).disabled
  ).toBe(true);
  await chooseOption(
    dialog.getByRole("combobox", { name: "Level" }),
    "Level 2"
  );
  await chooseOption(
    dialog.getByRole("combobox", { name: "Common area" }),
    "Stair lobby"
  );
  expect(dialog.queryByRole("textbox")).toBeNull();
  fireEvent.click(dialog.getByRole("button", { name: SAVE }));
  await waitFor(() =>
    expect(patch).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/location",
      expect.objectContaining({
        params: { path: { estateId, reportId } },
        body: { locationId: lobbyB, expectedLocationId: lobbyA },
      })
    )
  );
});

it("can save a level without a common area", async () => {
  const dialog = await openCorrection();
  await chooseOption(
    dialog.getByRole("combobox", { name: "Common area" }),
    NONE
  );
  fireEvent.click(dialog.getByRole("button", { name: SAVE }));
  await waitFor(() =>
    expect(patch).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/location",
      expect.objectContaining({
        body: { locationId: levelA, expectedLocationId: lobbyA },
      })
    )
  );
});

it("supports a common area directly under a different block", async () => {
  const dialog = await openCorrection();
  await chooseOption(
    dialog.getByRole("combobox", { name: "Block" }),
    "Block B"
  );
  await chooseOption(
    dialog.getByRole("combobox", { name: "Common area" }),
    "Courtyard"
  );
  fireEvent.click(dialog.getByRole("button", { name: SAVE }));
  await waitFor(() =>
    expect(patch).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/location",
      expect.objectContaining({
        body: { locationId: courtyard, expectedLocationId: lobbyA },
      })
    )
  );
});

it("keeps the chosen destination after a failed save and does not optimistically change the report", async () => {
  patch.mockResolvedValue({
    error: { message: "Unavailable" },
    response: new Response(null, { status: 503 }),
  });
  const dialog = await openCorrection();
  await chooseOption(
    dialog.getByRole("combobox", { name: "Block" }),
    "Block B"
  );
  await chooseOption(
    dialog.getByRole("combobox", { name: "Level" }),
    "Level 2"
  );
  await chooseOption(
    dialog.getByRole("combobox", { name: "Common area" }),
    "Stair lobby"
  );
  fireEvent.click(dialog.getByRole("button", { name: SAVE }));
  await dialog.findByRole("alert");
  expect(
    dialog.getByRole("combobox", { name: "Common area" }).textContent
  ).toContain("Stair lobby");
  expect(screen.getAllByText(report.location.label).length).toBeGreaterThan(0);
});

it("explains a stale edit and reloads the current placement before another correction", async () => {
  patch.mockResolvedValue({
    error: { message: "Location changed" },
    response: new Response(null, { status: 409 }),
  });
  const dialog = await openCorrection();
  await chooseOption(
    dialog.getByRole("combobox", { name: "Common area" }),
    NONE
  );
  fireEvent.click(dialog.getByRole("button", { name: SAVE }));
  await dialog.findByText(LOCATION_CHANGED);
  expect(patch).toHaveBeenCalledTimes(1);
  get.mockImplementation((path: string) =>
    path.endsWith("/reports/{reportId}")
      ? Promise.resolve({
          data: {
            ...report,
            location: { id: lobbyB, label: "Block B › Level 2 › Stair lobby" },
          },
        })
      : serve(path)
  );
  fireEvent.click(dialog.getByRole("button", { name: RELOAD }));
  await screen.findByText("Block B › Level 2 › Stair lobby");
  expect(patch).toHaveBeenCalledTimes(1);
});

it("retains readable detail and images on inactive estates while hiding Change location", async () => {
  get.mockImplementation((path: string) =>
    path === "/access/context"
      ? Promise.resolve({ data: access(false) })
      : serve(path)
  );
  await setup(`${basePath}/${reportId}`);
  await screen.findByRole("heading", { name: report.title });
  await screen.findByRole("img", { name: "Submitted fault" });
  expect(screen.queryByRole("button", { name: CHANGE_LOCATION })).toBeNull();
});

it("discards another account's report text and images when the session changes", async () => {
  get.mockImplementation((path: string) =>
    auth.user.id === "crew-user"
      ? serve(path)
      : Promise.resolve({
          error: { message: "Not found" },
          response: new Response(null, { status: 404 }),
        })
  );
  await setup(`${basePath}/${reportId}`);
  await screen.findByRole("img", { name: "Submitted fault" });
  act(() => {
    auth.user = { id: "unrelated-user" };
    for (const listener of listeners) {
      listener();
    }
  });
  await waitFor(() => {
    expect(screen.queryByText(report.description)).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:staff-report-image");
  await screen.findByText(UNAVAILABLE);
});

it("refetches a previously visited filtered list after correction so the moved report disappears", async () => {
  let corrected = false;
  get.mockImplementation((path: string) => {
    if (path.endsWith("/reports")) {
      return Promise.resolve({
        data: { items: corrected ? [] : [report], nextCursor: null },
      });
    }
    if (path.endsWith("/reports/{reportId}") && corrected) {
      return Promise.resolve({
        data: {
          ...report,
          location: { id: lobbyB, label: "Block B › Level 2 › Stair lobby" },
        },
      });
    }
    return serve(path);
  });
  patch.mockImplementation(() => {
    corrected = true;
    return Promise.resolve({
      data: {
        ...report,
        location: { id: lobbyB, label: "Block B › Level 2 › Stair lobby" },
      },
    });
  });
  const { router } = await setup(`${basePath}?blockId=${blockA}`);
  fireEvent.click(await screen.findByRole("link", { name: report.title }));
  fireEvent.click(await screen.findByRole("button", { name: CHANGE_LOCATION }));
  const dialog = within(await screen.findByRole("dialog"));
  await chooseOption(
    dialog.getByRole("combobox", { name: "Block" }),
    "Block B"
  );
  await chooseOption(
    dialog.getByRole("combobox", { name: "Level" }),
    "Level 2"
  );
  await chooseOption(
    dialog.getByRole("combobox", { name: "Common area" }),
    "Stair lobby"
  );
  fireEvent.click(dialog.getByRole("button", { name: SAVE }));
  await screen.findByText("Block B › Level 2 › Stair lobby");
  await act(async () => {
    await router.navigate({ href: `${basePath}?blockId=${blockA}` });
  });
  await screen.findByText(NO_MATCHES);
  expect(screen.queryByRole("link", { name: report.title })).toBeNull();
});

it("prevents duplicate submissions while a correction is being saved", async () => {
  let complete: (() => void) | undefined;
  patch.mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = () =>
          resolve({
            data: {
              ...report,
              location: { id: levelA, label: "Block A › Level 4" },
            },
          });
      })
  );
  const dialog = await openCorrection();
  await chooseOption(
    dialog.getByRole("combobox", { name: "Common area" }),
    NONE
  );
  try {
    const save = dialog.getByRole("button", { name: SAVE });
    fireEvent.click(save);
    await waitFor(() =>
      expect((save as HTMLButtonElement).disabled).toBe(true)
    );
    fireEvent.click(save);
    expect(patch).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => complete?.());
  }
});

it("shows an inactive current placement but excludes inactive destinations from the picker", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/reports/{reportId}")
      ? Promise.resolve({
          data: {
            ...report,
            location: { id: oldArea, label: "Block A › Level 4 › Old lobby" },
          },
        })
      : serve(path)
  );
  const dialog = await openCorrection();
  expect(
    screen.getAllByText("Block A › Level 4 › Old lobby").length
  ).toBeGreaterThan(0);
  fireEvent.click(dialog.getByRole("combobox", { name: "Common area" }));
  await screen.findByRole("option", { name: "Lift lobby" });
  expect(screen.queryByRole("option", { name: "Old lobby" })).toBeNull();
});

it("explains when no active destination is available without hiding report history", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/locations")
      ? Promise.resolve({
          data: locations.map((location) => ({
            ...location,
            deactivatedAt: timestamp,
          })),
        })
      : serve(path)
  );
  const dialog = await openCorrection();
  await dialog.findByText(NO_DESTINATIONS);
  expect(
    (dialog.getByRole("button", { name: SAVE }) as HTMLButtonElement).disabled
  ).toBe(true);
  // A modal removes background content from the accessibility tree while open.
  screen.getByText(report.title, { selector: "h2" });
  expect(patch).not.toHaveBeenCalled();
});

it("leaves the report readable when its private image fails", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/images/{imageId}")
      ? Promise.resolve({
          error: { message: "Image storage is temporarily unavailable." },
          response: new Response(null, { status: 503 }),
        })
      : serve(path)
  );
  await setup(`${basePath}/${reportId}`);
  await screen.findByRole("heading", { name: report.title });
  const images = await screen.findByRole("region", { name: "Images" });
  await within(images).findByRole("alert");
  screen.getByText(report.description);
});

it("renders report text as plain text and shows when there are no submitted images", async () => {
  const description = "<script>alert('x')</script> Water pooling near the lift";
  get.mockImplementation((path: string) =>
    path.endsWith("/reports/{reportId}")
      ? Promise.resolve({ data: { ...report, description, images: [] } })
      : serve(path)
  );
  await setup(`${basePath}/${reportId}`);
  expect((await screen.findByText(description)).textContent).toBe(description);
  const images = screen.getByRole("region", { name: "Images" });
  within(images).getByText("No images submitted.");
  expect(within(images).queryByRole("img")).toBeNull();
});

it("restores the earlier block filter when navigating back", async () => {
  const { router } = await setup(`${basePath}?blockId=${blockA}`);
  const filter = await screen.findByRole("combobox", { name: "Block" });
  fireEvent.keyDown(filter, { key: "ArrowDown" });
  const option = await screen.findByRole("option", { name: "Block B" });
  await waitFor(() => {
    fireEvent.click(option);
    expect(filter.getAttribute("aria-expanded")).toBe("false");
  });
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ blockId: blockB })
  );
  act(() => router.history.back());
  await waitFor(() => {
    expect(router.state.location.search).toMatchObject({ blockId: blockA });
    expect((filter as HTMLInputElement).value).toBe("Block A");
  });
});

it("does not mount responder queries when access capability lookup fails", async () => {
  get.mockImplementation((path: string) =>
    path === "/access/context"
      ? Promise.resolve({
          error: { message: "Unavailable" },
          response: new Response(null, { status: 503 }),
        })
      : serve(path)
  );
  await setup();
  await screen.findByRole("alert");
  expect(
    get.mock.calls.some(([path]) =>
      path.startsWith("/estates/{estateId}/reports")
    )
  ).toBe(false);
});

it("shows urgency and safety labels in the existing estate report cards", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/reports")
      ? Promise.resolve({
          data: {
            items: [
              {
                ...report,
                urgency: "URGENT",
                isSafety: true,
                urgencyVersion: 0,
              },
            ],
            nextCursor: null,
          },
        })
      : serve(path)
  );
  await setup();
  await screen.findByRole("link", { name: report.title });
  screen.getByText("Urgent");
  screen.getByText("Safety");
});

it("opens the estate queue with open reports and lets staff include all reports", async () => {
  const { router } = await setup();
  fireEvent.click(await screen.findByRole("button", { name: FILTERS_BUTTON }));
  const view = await screen.findByRole("combobox", { name: "Reports" });
  expect(get).toHaveBeenCalledWith(
    "/estates/{estateId}/reports",
    expect.objectContaining({
      params: expect.objectContaining({
        query: expect.objectContaining({ openOnly: true }),
      }),
    })
  );
  await chooseOption(view, "All reports");
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({ openOnly: false })
  );
  expect(get).toHaveBeenCalledWith(
    "/estates/{estateId}/reports",
    expect.objectContaining({
      params: expect.objectContaining({
        query: expect.objectContaining({ openOnly: false }),
      }),
    })
  );
});

function managerUrgencyAccess() {
  const current = access();
  return {
    ...current,
    estates: current.estates.map((estate) => ({
      ...estate,
      role: "MANAGER",
      canChangeFaultReportUrgency: true,
    })),
  };
}

it("changes sorting while keeping filters and resets the page cursor", async () => {
  const { router } = await setup(
    `${basePath}?openOnly=false&blockId=${blockA}&cursor=old-page`
  );
  const sort = await screen.findByRole("combobox", { name: "Sort by" });
  await chooseOption(sort, "Newest first");
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      sort: "NEWEST",
      openOnly: false,
      blockId: blockA,
    })
  );
  expect(router.state.location.search.cursor).toBeUndefined();
  expect(get).toHaveBeenCalledWith(
    "/estates/{estateId}/reports",
    expect.objectContaining({
      params: expect.objectContaining({
        query: expect.objectContaining({
          sort: "NEWEST",
          openOnly: false,
          blockId: blockA,
        }),
      }),
    })
  );
  await chooseOption(sort, "Safety and urgency");
  await waitFor(() =>
    expect(router.state.location.search.sort).toBeUndefined()
  );
});

it("restores newest sorting from the URL and retains it across pagination", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/reports")
      ? Promise.resolve({ data: { items: [report], nextCursor: "next-page" } })
      : serve(path)
  );
  const { router } = await setup(`${basePath}?sort=NEWEST`);
  const sort = await screen.findByRole("combobox", { name: "Sort by" });
  expect(sort.textContent).toContain("Newest first");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      sort: "NEWEST",
      cursor: "next-page",
    })
  );
  fireEvent.click(await screen.findByRole("button", { name: "Previous page" }));
  await waitFor(() =>
    expect(router.state.location.search.cursor).toBeUndefined()
  );
  expect(router.state.location.search.sort).toBe("NEWEST");
});

it("selects oldest sorting while preserving filters and resetting pagination", async () => {
  const { router } = await setup(
    `${basePath}?openOnly=false&blockId=${blockA}&cursor=old-page`
  );
  await chooseOption(
    await screen.findByRole("combobox", { name: "Sort by" }),
    "Oldest first"
  );
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      sort: "OLDEST",
      openOnly: false,
      blockId: blockA,
    })
  );
  expect(router.state.location.search.cursor).toBeUndefined();
  expect(get).toHaveBeenCalledWith(
    "/estates/{estateId}/reports",
    expect.objectContaining({
      params: expect.objectContaining({
        query: expect.objectContaining({
          sort: "OLDEST",
          openOnly: false,
          blockId: blockA,
        }),
      }),
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() => expect(router.state.location.search).toEqual({}));
});

it("restores oldest sorting from the URL and preserves it across pages", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/reports")
      ? Promise.resolve({ data: { items: [report], nextCursor: "next-page" } })
      : serve(path)
  );
  const { router } = await setup(`${basePath}?sort=OLDEST`);
  expect(
    (await screen.findByRole("combobox", { name: "Sort by" })).textContent
  ).toContain("Oldest first");
  fireEvent.click(await screen.findByRole("button", { name: "Next page" }));
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      sort: "OLDEST",
      cursor: "next-page",
    })
  );
  fireEvent.click(await screen.findByRole("button", { name: "Previous page" }));
  await waitFor(() =>
    expect(router.state.location.search.cursor).toBeUndefined()
  );
  expect(router.state.location.search.sort).toBe("OLDEST");
});

function serveUrgencyManager(path: string) {
  if (path === "/access/context") {
    return Promise.resolve({ data: managerUrgencyAccess() });
  }
  if (path.endsWith("/reports/{reportId}")) {
    return Promise.resolve({
      data: {
        ...report,
        urgency: "MEDIUM",
        isSafety: false,
        urgencyVersion: 0,
        lastUrgencyChange: null,
      },
    });
  }
  return serve(path);
}

it("lets a Manager mark Safety and saves Urgent using the observed version", async () => {
  get.mockImplementation(serveUrgencyManager);
  patch.mockResolvedValue({
    data: {
      ...report,
      urgency: "URGENT",
      isSafety: true,
      urgencyVersion: 1,
      lastUrgencyChange: null,
    },
  });
  await setup(`${basePath}/${reportId}`);
  fireEvent.click(
    await screen.findByRole("button", { name: "Change urgency" })
  );
  const dialog = within(
    await screen.findByRole("dialog", { name: "Change urgency" })
  );
  fireEvent.click(dialog.getByRole("checkbox", { name: "Safety report" }));
  expect(
    dialog.getByRole("combobox", { name: "Urgency" }).hasAttribute("disabled")
  ).toBe(true);
  fireEvent.click(dialog.getByRole("button", { name: "Save urgency" }));
  await waitFor(() =>
    expect(patch).toHaveBeenCalledWith(
      "/estates/{estateId}/reports/{reportId}/urgency",
      expect.objectContaining({
        body: { urgency: "URGENT", isSafety: true, expectedVersion: 0 },
      })
    )
  );
});

it("requires a reload after an urgency conflict and preserves the failed draft", async () => {
  get.mockImplementation(serveUrgencyManager);
  patch.mockResolvedValue({
    error: {
      message: "The report urgency changed. Reload and review before saving.",
    },
    response: new Response(null, { status: 409 }),
  });
  await setup(`${basePath}/${reportId}`);
  fireEvent.click(
    await screen.findByRole("button", { name: "Change urgency" })
  );
  const dialog = within(
    await screen.findByRole("dialog", { name: "Change urgency" })
  );
  await chooseOption(dialog.getByRole("combobox", { name: "Urgency" }), "High");
  fireEvent.click(dialog.getByRole("button", { name: "Save urgency" }));
  await dialog.findByRole("alert");
  expect(
    dialog.getByRole("combobox", { name: "Urgency" }).textContent
  ).toContain("High");
  expect(
    dialog
      .getByRole("button", { name: "Save urgency" })
      .hasAttribute("disabled")
  ).toBe(true);
  dialog.getByRole("button", { name: "Reload" });
});

it("shows the latest urgency change without exposing a full history interface", async () => {
  get.mockImplementation((path: string) =>
    path.endsWith("/reports/{reportId}")
      ? Promise.resolve({
          data: {
            ...report,
            urgency: "HIGH",
            isSafety: false,
            urgencyVersion: 1,
            lastUrgencyChange: {
              id: reportId,
              version: 1,
              fromUrgency: "MEDIUM",
              toUrgency: "HIGH",
              fromIsSafety: false,
              toIsSafety: false,
              changedByName: "Alex Tan",
              changedAt: timestamp,
            },
          },
        })
      : serve(path)
  );
  await setup(`${basePath}/${reportId}`);
  await screen.findByText(URGENCY_MEDIUM_HIGH);
  screen.getByText(CHANGE_AUTHOR);
  expect(screen.queryByRole("button", { name: "Change urgency" })).toBeNull();
});

it("badges originals with duplicate counts and linked reports with their state", async () => {
  const original = {
    ...report,
    id: "00000000-0000-0000-0000-000000000040",
    title: "Original leak",
    confirmedDuplicateCount: 2,
    suspectedDuplicateCount: 1,
    duplicateOf: null,
  };
  const suspected = {
    ...report,
    id: "00000000-0000-0000-0000-000000000041",
    title: "Leak again",
    confirmedDuplicateCount: 0,
    suspectedDuplicateCount: 0,
    duplicateOf: {
      reportId: original.id,
      title: original.title,
      state: "SUSPECTED",
    },
  };
  const confirmed = {
    ...suspected,
    id: "00000000-0000-0000-0000-000000000042",
    title: "Same leak",
    duplicateOf: { ...suspected.duplicateOf, state: "CONFIRMED" },
  };
  const plain = {
    ...report,
    id: "00000000-0000-0000-0000-000000000043",
    title: "Broken light",
    confirmedDuplicateCount: 0,
    suspectedDuplicateCount: 0,
    duplicateOf: null,
  };
  get.mockImplementation((path: string) =>
    path.endsWith("/reports")
      ? Promise.resolve({
          data: {
            items: [original, suspected, confirmed, plain],
            nextCursor: null,
          },
        })
      : serve(path)
  );
  await setup();
  const card = async (title: string) => {
    const link = await screen.findByRole("link", { name: title });
    const found = link.closest("li");
    expect(found).not.toBeNull();
    return within(found as HTMLElement);
  };
  const originalCard = await card("Original leak");
  originalCard.getByText("2 repeat reports");
  originalCard.getByText("1 to review");
  (await card("Leak again")).getByText("May already be reported");
  (await card("Same leak")).getByText("Already reported");
  expect((await card("Broken light")).queryByText(DUPLICATE_BADGE)).toBeNull();
});

it("shows each report's routing state and filters the list by it", async () => {
  get.mockImplementation((path: string) => {
    if (path.endsWith("/reports")) {
      return Promise.resolve({
        data: {
          items: [
            {
              ...report,
              routing: {
                state: "NEEDS_REVIEW",
                reason: "Needs a check",
                classification: null,
                workOrder: null,
                decidedAt: null,
              },
            },
          ],
          nextCursor: null,
        },
      });
    }
    return serve(path);
  });
  const { router } = await setup();
  await screen.findByText("Routing: Needs review");

  await chooseOption(
    screen.getByRole("combobox", { name: "Routing" }),
    "Needs review"
  );

  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      routingState: "NEEDS_REVIEW",
    })
  );
  await waitFor(() =>
    expect(get).toHaveBeenCalledWith(
      "/estates/{estateId}/reports",
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({ routingState: "NEEDS_REVIEW" }),
        }),
      })
    )
  );
});
