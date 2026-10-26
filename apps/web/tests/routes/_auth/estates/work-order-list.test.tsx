import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent } from "@testing-library/react";
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
const state = vi.hoisted(() => ({
  get: vi.fn(),
  crew: false,
  nextCursor: "page-two",
  empty: false,
}));
vi.mock("@/lib/api", () => ({ api: { GET: state.get } }));
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
const estateId = "00000000-0000-0000-0000-000000000001";
const basePath = `/estates/${estateId}/work-orders`;
const WORK_ORDER_WRITES = /start work|complete work|correct outcome/i;
const order = {
  id: "00000000-0000-0000-0000-000000000002",
  estateId,
  reference: "TEST-W0001",
  description: "Leaking pipe",
  locationPath: "Block A / Level 1",
  category: "CLEANLINESS",
  priority: "HIGH",
  source: "MANUAL",
  status: "OPEN",
  createdAt: "2026-10-22T00:00:00Z",
  createdByUserId: "tester",
  createdByName: "Alex Tan",
};
async function setup(path = basePath) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
    defaultPendingMinMs: 0,
    scrollRestoration: true,
    defaultErrorComponent: () => <p role="alert">Work orders unavailable</p>,
  });
  await router.load();
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}
beforeEach(() => {
  state.crew = false;
  state.empty = false;
  state.nextCursor = "page-two";
  state.get.mockReset().mockImplementation((path: string) => {
    if (path === "/access/context") {
      return Promise.resolve({
        data: {
          ...unassignedAccess,
          canEnterWorkspace: true,
          estates: [
            {
              ...(state.crew ? crewEstateAccess : ownerEstateAccess),
              estateId,
              estateName: "Testing",
            },
          ],
        },
        response: new Response(),
      });
    }
    if (path === "/estates/{estateId}/work-orders") {
      return Promise.resolve({
        data: {
          items: state.empty ? [] : [order],
          nextCursor: state.nextCursor || null,
        },
        response: new Response(),
      });
    }
    if (path === "/estates/{estateId}/work-orders/{workOrderId}") {
      return Promise.resolve({ data: order, response: new Response() });
    }
    return Promise.resolve({ data: [], response: new Response() });
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
});

it("lets Crew view work orders without creation or progress controls", async () => {
  state.crew = true;
  const { router } = await setup();
  const detail = await screen.findByRole("link", { name: "TEST-W0001" });
  expect(screen.queryByRole("link", { name: "Create work order" })).toBeNull();
  fireEvent.click(detail);
  await waitFor(() =>
    expect(router.state.location.pathname).toBe(`${basePath}/${order.id}`)
  );
  await screen.findByRole("heading", { name: "TEST-W0001" });
  expect(
    screen.queryByRole("button", {
      name: WORK_ORDER_WRITES,
    })
  ).toBeNull();
});

it.each(["work-orders", "assets"])(
  "keeps the page scroll position when sorting %s",
  async (feature) => {
    const serve = state.get.getMockImplementation();
    state.get.mockImplementation((path: string, ...options: unknown[]) => {
      if (path === "/estates/{estateId}/assets") {
        return Promise.resolve({
          data: [
            {
              id: "a",
              reference: "TEST-A0001",
              name: "Pump",
              category: "PUMP",
              locationPath: "Block A",
            },
          ],
          response: new Response(),
        });
      }
      return serve?.(path, ...options);
    });
    const { router } = await setup(`/estates/${estateId}/${feature}`);
    const button = await screen.findByRole("button", {
      name: "Sort by Reference",
    });
    vi.mocked(window.scrollTo).mockClear();
    fireEvent.click(button);
    await waitFor(() =>
      expect(router.state.location.search.sortBy).toBe("REFERENCE")
    );
    await screen.findByRole("button", { name: "Sort by Reference" });
    expect(window.scrollTo).not.toHaveBeenCalled();
  }
);

it("keeps the work-order table mounted while a new sort is loading", async () => {
  await setup();
  await screen.findByRole("table", { name: "Work orders" });
  const serve = state.get.getMockImplementation();
  let resolveRequest!: (value: unknown) => void;
  const pending = new Promise((resolve) => {
    resolveRequest = resolve;
  });
  state.get.mockImplementation((path: string, ...options: unknown[]) =>
    path === "/estates/{estateId}/work-orders"
      ? pending
      : serve?.(path, ...options)
  );
  fireEvent.click(screen.getByRole("button", { name: "Sort by Priority" }));
  await waitFor(() =>
    expect(
      screen
        .getByRole("table", { name: "Work orders" })
        .getAttribute("aria-busy")
    ).toBe("true")
  );
  screen.getByRole("link", { name: "TEST-W0001" });
  expect(
    screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")
  ).toBe(true);
  await act(async () =>
    resolveRequest({
      data: {
        items: [{ ...order, reference: "TEST-W0002" }],
        nextCursor: null,
      },
      response: new Response(),
    })
  );
  await screen.findByRole("link", { name: "TEST-W0002" });
  expect(screen.queryByRole("link", { name: "TEST-W0001" })).toBeNull();
});

it.each(["", "/new", `/${order.id}`])(
  "links the estate overview from work-order breadcrumbs on %s",
  async (suffix) => {
    await setup(basePath + suffix);
    const breadcrumbs = await screen.findByRole("navigation", {
      name: "Breadcrumbs",
    });
    expect(
      within(breadcrumbs)
        .getByRole("link", { name: "Testing" })
        .getAttribute("href")
    ).toBe(`/estates/${estateId}`);
  }
);

it("links the estate breadcrumb for Crew with read-only estate access", async () => {
  state.crew = true;
  await setup();
  const breadcrumbs = await screen.findByRole("navigation", {
    name: "Breadcrumbs",
  });
  within(breadcrumbs).getByText("Testing");
  expect(
    within(breadcrumbs)
      .getByRole("link", { name: "Testing" })
      .getAttribute("href")
  ).toBe(`/estates/${estateId}`);
});

it("applies priority and reference to the server query and URL and resets pagination", async () => {
  const { router } = await setup(`${basePath}?cursor=old-page`);
  await chooseOption(
    await screen.findByRole("combobox", { name: "Priority" }),
    "High"
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Search reference" }), {
    target: { value: "  test-w0001  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
  await waitFor(() =>
    expect(router.state.location.search).toEqual({
      priority: "HIGH",
      q: "test-w0001",
    })
  );
  await waitFor(() =>
    expect(state.get).toHaveBeenCalledWith(
      "/estates/{estateId}/work-orders",
      expect.objectContaining({
        params: {
          path: { estateId },
          query: {
            priority: "HIGH",
            q: "test-w0001",
            cursor: undefined,
            limit: 20,
          },
        },
      })
    )
  );
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(router.state.location.search).toEqual({
      priority: "HIGH",
      q: "test-w0001",
      cursor: "page-two",
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() => expect(router.state.location.search).toEqual({}));
  await waitFor(() =>
    expect(
      (
        screen.getByRole("textbox", {
          name: "Search reference",
        }) as HTMLInputElement
      ).value
    ).toBe("")
  );
});

it("restores applied filters from URL navigation and distinguishes no matches from an empty estate", async () => {
  state.empty = true;
  state.nextCursor = "";
  const { router } = await setup(`${basePath}?priority=URGENT&q=TEST`);
  expect(
    (
      (await screen.findByRole("textbox", {
        name: "Search reference",
      })) as HTMLInputElement
    ).value
  ).toBe("TEST");
  expect(
    screen.getByRole("combobox", { name: "Priority" }).textContent
  ).toContain("Urgent");
  await screen.findByText("No matching work orders");
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await screen.findByText("No work orders yet");
  await act(async () => router.history.back());
  await waitFor(() =>
    expect(
      (
        screen.getByRole("textbox", {
          name: "Search reference",
        }) as HTMLInputElement
      ).value
    ).toBe("TEST")
  );
  await screen.findByText("No matching work orders");
});

it.each(["priority=IMPORTANT", `q=${"x".repeat(201)}`])(
  "rejects invalid filters from the URL: %s",
  async (search) => {
    await setup(`${basePath}?${search}`);
    await screen.findByRole("alert");
    expect(
      state.get.mock.calls.some(
        ([path]) => path === "/estates/{estateId}/work-orders"
      )
    ).toBe(false);
  }
);

it("sorts work orders from headers while retaining filters, pages and browser history", async () => {
  const { router } = await setup(
    `${basePath}?priority=HIGH&q=TEST&cursor=page-two`
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Sort by Priority" })
  );
  await waitFor(() =>
    expect(router.state.location.search).toEqual({
      priority: "HIGH",
      q: "TEST",
      sortBy: "PRIORITY",
      direction: "DESC",
    })
  );
  await waitFor(() =>
    expect(state.get).toHaveBeenCalledWith(
      "/estates/{estateId}/work-orders",
      expect.objectContaining({
        params: {
          path: { estateId },
          query: {
            priority: "HIGH",
            q: "TEST",
            sortBy: "PRIORITY",
            direction: "DESC",
            cursor: undefined,
            limit: 20,
          },
        },
      })
    )
  );
  expect(
    (
      await screen.findByRole("columnheader", { name: "Priority" })
    ).getAttribute("aria-sort")
  ).toBe("descending");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(router.state.location.search).toEqual({
      priority: "HIGH",
      q: "TEST",
      sortBy: "PRIORITY",
      direction: "DESC",
      cursor: "page-two",
    })
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Sort by Priority" })
  );
  await waitFor(() =>
    expect(router.state.location.search.direction).toBe("ASC")
  );
  expect(router.state.location.search.cursor).toBeUndefined();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() =>
    expect(router.state.location.search).toEqual({
      sortBy: "PRIORITY",
      direction: "ASC",
    })
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Sort by Reference" })
  );
  await waitFor(() =>
    expect(router.state.location.search).toEqual({
      sortBy: "REFERENCE",
      direction: "ASC",
    })
  );
  await act(async () => router.history.back());
  await waitFor(() =>
    expect(router.state.location.search.sortBy).toBe("PRIORITY")
  );
  expect(
    (
      await screen.findByRole("columnheader", { name: "Priority" })
    ).getAttribute("aria-sort")
  ).toBe("ascending");
  expect(screen.queryByRole("button", { name: "Sort by Status" })).toBeNull();
});

it.each(["sortBy=STATUS", "direction=SIDEWAYS"])(
  "rejects invalid work-order sorting: %s",
  async (search) => {
    await setup(`${basePath}?${search}`);
    await screen.findByRole("alert");
    expect(
      state.get.mock.calls.some(
        ([path]) => path === "/estates/{estateId}/work-orders"
      )
    ).toBe(false);
  }
);

it("persists asset sorting in the URL while keeping sort state out of API filters", async () => {
  const serve = state.get.getMockImplementation();
  state.get.mockImplementation((path: string, ...options: unknown[]) => {
    if (path === "/estates/{estateId}/assets") {
      return Promise.resolve({
        data: [
          {
            id: "z",
            reference: "TEST-A0002",
            name: "Zulu pump",
            category: "PUMP",
            locationPath: "Block 2",
          },
          {
            id: "a",
            reference: "TEST-A0001",
            name: "Alpha pump",
            category: "PUMP",
            locationPath: "Block 1",
          },
        ],
        response: new Response(),
      });
    }
    return serve?.(path, ...options);
  });
  const { router } = await setup(
    `/estates/${estateId}/assets?q=pump&status=ALL&sortBy=NAME&direction=DESC`
  );
  const table = within(await screen.findByRole("table", { name: "Assets" }));
  expect(
    table
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[1].textContent)
  ).toEqual(["Zulu pump", "Alpha pump"]);
  const request = state.get.mock.calls.find(
    ([path]) => path === "/estates/{estateId}/assets"
  )?.[1] as { params: { query: Record<string, unknown> } };
  expect(request.params.query).toMatchObject({ q: "pump", status: "ALL" });
  expect(request.params.query).not.toHaveProperty("sortBy");
  expect(request.params.query).not.toHaveProperty("direction");
  fireEvent.click(screen.getByRole("button", { name: "Sort by Name" }));
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      q: "pump",
      status: "ALL",
      sortBy: "NAME",
      direction: "ASC",
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() => expect(router.state.location.search.q).toBeUndefined());
  expect(router.state.location.search).toMatchObject({
    sortBy: "NAME",
    direction: "ASC",
  });
  await act(async () => router.history.back());
  await waitFor(() => expect(router.state.location.search.q).toBe("pump"));
});

it.each(["sortBy=PRIORITY", "direction=SIDEWAYS"])(
  "rejects invalid asset sorting: %s",
  async (search) => {
    await setup(`/estates/${estateId}/assets?${search}`);
    await screen.findByRole("alert");
    expect(
      state.get.mock.calls.some(
        ([path]) => path === "/estates/{estateId}/assets"
      )
    ).toBe(false);
  }
);

it("returns to visited cursor pages without losing filters and resets the trail after a filter change", async () => {
  const { router } = await setup(`${basePath}?priority=HIGH&q=TEST`);
  await screen.findByRole("link", { name: "TEST-W0001" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(router.state.location.search.cursor).toBe("page-two")
  );
  fireEvent.click(await screen.findByRole("button", { name: "Previous" }));
  await waitFor(() =>
    expect(router.state.location.search).toEqual({
      priority: "HIGH",
      q: "TEST",
    })
  );
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(router.state.location.search.cursor).toBe("page-two")
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await waitFor(() => expect(router.state.location.search).toEqual({}));
  expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
  screen.getByText("1 work order on this page");
});

it("offers First page for a directly opened cursor without inventing a previous page", async () => {
  await setup(`${basePath}?cursor=direct-link`);
  await screen.findByRole("button", { name: "First page" });
  expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
  screen.getByText("1 work order on this page");
});
