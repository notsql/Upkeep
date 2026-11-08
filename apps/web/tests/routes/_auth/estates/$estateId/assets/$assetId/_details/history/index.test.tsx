import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  type ErrorComponentProps,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent } from "@testing-library/react";
import { councilEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import {
  historyInvoice,
  historyPage,
  invoiceEntry,
} from "@tests/fixtures/asset-history";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { refreshAssetHistory } from "@/lib/asset-history";
import { routeTree } from "@/routeTree.gen";

// Use the existing route tree: missing date behaviour must fail as an HTTP/UI
// expectation, not as an import of an implementation that does not exist yet.
const { apiGet } = vi.hoisted(() => ({
  apiGet: vi.fn<(path: string, options?: unknown) => Promise<unknown>>(),
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
vi.mock("@/lib/api", () => ({ api: { GET: apiGet } }));
vi.mock("@/lib/access-server", () => ({
  getSessionIdentity: () => Promise.resolve({ id: "council" }),
  getSessionAccess: () => Promise.resolve({ user: { id: "council" }, access }),
}));
vi.mock("@/lib/access", () => ({
  useAuthenticatedSession: () => ({ userId: "council", ready: true }),
  useAppAccess: () => ({
    data: access,
    isPending: false,
    isError: false,
  }),
}));
vi.mock(
  "@/components/forms/date-picker",
  () => import("@tests/date-picker-stubs")
);

const access = {
  ...unassignedAccess,
  canEnterWorkspace: true,
  estates: [
    {
      ...councilEstateAccess,
      estateId: "estate",
      canViewAssetHistory: true,
      canViewDocuments: true,
      canUploadDocuments: false,
    },
  ],
};
const historyPath = "/estates/{estateId}/assets/{assetId}/history";
const contentPath = "/estates/{estateId}/documents/{documentId}/content";
const url = "/estates/estate/assets/pump/history";
const marchSearch = "?from=2026-03-01&to=2026-03-31";
const aprilSearch = "?from=2026-04-01&to=2026-04-30";
const SINGAPORE = /Singapore/u;
const DATE_ERROR = /date|range/iu;
const aprilInvoice = {
  ...invoiceEntry,
  id: "INVOICE:april",
  sourceId: "april",
  title: "April invoice uploaded",
  summary: "april.pdf",
  occurredAt: "2026-04-02T02:00:00Z",
  recordedAt: "2026-04-02T02:00:00Z",
  details: {
    kind: "DOCUMENT" as const,
    document: {
      ...historyInvoice,
      id: "april",
      originalFilename: "april.pdf",
      createdAt: "2026-04-02T02:00:00Z",
    },
  },
};
const olderInvoice = {
  ...invoiceEntry,
  id: "INVOICE:older-march",
  sourceId: "older-march",
  title: "Older March invoice uploaded",
};

function queryOf(options: unknown): Record<string, unknown> {
  return (
    (options as { params?: { query?: Record<string, unknown> } })?.params
      ?.query ?? {}
  );
}

function historyQueries() {
  return apiGet.mock.calls
    .filter(([path]) => path === historyPath)
    .map(([, options]) => queryOf(options));
}

function success(data: unknown) {
  return { data, response: new Response() };
}

function pageFor(options: unknown) {
  const { from, to } = queryOf(options);
  if (from === "2030-01-01") {
    return { ...historyPage, items: [] };
  }
  if (from === "2026-04-01") {
    return { ...historyPage, items: [aprilInvoice] };
  }
  if (from === "2026-03-01" || to === "2026-03-31") {
    return historyPage;
  }
  return { ...historyPage, items: [aprilInvoice, ...historyPage.items] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

function DateRouteError({ error }: ErrorComponentProps) {
  return (
    <p role="alert">{error instanceof Error ? error.message : String(error)}</p>
  );
}

async function openHistory(search = "") {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [`${url}${search}`] }),
    defaultPendingMinMs: 0,
    defaultErrorComponent: DateRouteError,
  });
  await router.load();
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

function editDates(from: string, to: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "From date" }), {
    target: { value: from },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "To date" }), {
    target: { value: to },
  });
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockImplementation((path, options) => {
    if (path === historyPath) {
      return Promise.resolve(success(pageFor(options)));
    }
    if (path === contentPath) {
      return Promise.resolve(
        success(new Blob(["pdf"], { type: "application/pdf" }))
      );
    }
    return Promise.reject(new Error(`Unexpected API request: ${path}`));
  });
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.stubGlobal(
    "URL",
    Object.assign(URL, {
      createObjectURL: vi.fn(() => "blob:date-history"),
      revokeObjectURL: vi.fn(),
    })
  );
});

it("keeps draft dates unapplied until Apply dates and explains Singapore calendar days", async () => {
  const { router } = await openHistory();
  await screen.findByRole("heading", { name: "April invoice uploaded" });
  editDates("2026-03-01", "2026-03-31");
  screen.getByText(SINGAPORE);
  expect(router.state.location.searchStr).toBe("");
  screen.getByRole("heading", { name: "April invoice uploaded" });
  expect(historyQueries().every((query) => !(query.from || query.to))).toBe(
    true
  );

  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  await waitFor(() =>
    expect(router.state.location.search).toMatchObject({
      from: "2026-03-01",
      to: "2026-03-31",
    })
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { name: "April invoice uploaded" })
    ).toBeNull()
  );
  screen.getByRole("heading", { name: "Condition assessed" });
  expect(historyQueries()).toContainEqual(
    expect.objectContaining({ from: "2026-03-01", to: "2026-03-31" })
  );
});

it.each([
  ["2026-03-01", ""],
  ["", "2026-03-31"],
  ["2026-03-01", "2026-03-01"],
])("applies optional and same-day bounds (%s, %s)", async (from, to) => {
  await openHistory();
  await screen.findByRole("heading", { name: "April invoice uploaded" });
  editDates(from, to);
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  await waitFor(() => {
    expect(
      historyQueries().some(
        (query) =>
          query.from === (from || undefined) && query.to === (to || undefined)
      )
    ).toBe(true);
  });
  await waitFor(() =>
    expect(
      screen.queryByRole("heading", { name: "April invoice uploaded" })
    ).toBeNull()
  );
});

it("restores applied dates from the URL and uses that range for both the Council frame and timeline", async () => {
  await openHistory(marchSearch);
  await screen.findByRole("heading", { level: 1, name: "Water pump" });
  await screen.findByRole("list", { name: "Recorded asset history" });
  expect(historyQueries().length).toBeGreaterThan(0);
  expect(
    historyQueries().every(
      (query) => query.from === "2026-03-01" && query.to === "2026-03-31"
    )
  ).toBe(true);
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "From date" }).value
  ).toBe("2026-03-01");
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "To date" }).value
  ).toBe("2026-03-31");
  expect(
    apiGet.mock.calls.some(
      ([path]) => path === "/estates/{estateId}/assets/{id}"
    )
  ).toBe(false);
});

it("Clear dates removes URL bounds, clears drafts and restores all history", async () => {
  const { router } = await openHistory(marchSearch);
  await screen.findByRole("heading", { name: "Condition assessed" });
  fireEvent.click(screen.getByRole("button", { name: "Clear dates" }));
  await screen.findByRole("heading", { name: "April invoice uploaded" });
  expect(router.state.location.search).not.toHaveProperty("from");
  expect(router.state.location.search).not.toHaveProperty("to");
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "From date" }).value
  ).toBe("");
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "To date" }).value
  ).toBe("");
});

it("restores the fields and matching results with browser Back and Forward", async () => {
  const { router } = await openHistory(marchSearch);
  await screen.findByRole("heading", { name: "Condition assessed" });
  editDates("2026-04-01", "2026-04-30");
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  await screen.findByRole("heading", { name: "April invoice uploaded" });
  await act(() => router.history.back());
  await screen.findByRole("heading", { name: "Condition assessed" });
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "From date" }).value
  ).toBe("2026-03-01");
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "To date" }).value
  ).toBe("2026-03-31");
  expect(
    screen.queryByRole("heading", { name: "April invoice uploaded" })
  ).toBeNull();
  await act(() => router.history.forward());
  await screen.findByRole("heading", { name: "April invoice uploaded" });
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "From date" }).value
  ).toBe("2026-04-01");
  expect(
    screen.getByRole<HTMLInputElement>("textbox", { name: "To date" }).value
  ).toBe("2026-04-30");
  expect(
    screen.queryByRole("heading", { name: "Condition assessed" })
  ).toBeNull();
});

it("rejects reversed drafts accessibly without replacing the applied results", async () => {
  const { router } = await openHistory(marchSearch);
  await screen.findByRole("heading", { name: "Condition assessed" });
  editDates("2026-04-30", "2026-04-01");
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  const error = await screen.findByRole("alert");
  expect(error.textContent).toMatch(DATE_ERROR);
  expect(router.state.location.search).toMatchObject({
    from: "2026-03-01",
    to: "2026-03-31",
  });
  expect(
    historyQueries().every(
      (query) => query.from === "2026-03-01" && query.to === "2026-03-31"
    )
  ).toBe(true);
  screen.getByRole("heading", { name: "Condition assessed" });
});

it.each([
  "?from=2026-02-30",
  "?to=2025-02-29",
  "?from=tomorrow",
  "?from=",
  "?from=2026-04-30&to=2026-04-01",
])(
  "shows invalid URL dates as an error instead of loading unfiltered history (%s)",
  async (search) => {
    await openHistory(search);
    const error = await screen.findByRole("alert");
    expect(error.textContent).toMatch(DATE_ERROR);
    expect(historyQueries()).toEqual([]);
    expect(
      screen.queryByRole("list", { name: "Recorded asset history" })
    ).toBeNull();
  }
);

it("distinguishes an empty range and retains asset identity with Clear dates available", async () => {
  await openHistory("?from=2030-01-01&to=2030-01-31");
  await screen.findByText("No recorded history in this date range");
  screen.getByRole("heading", { level: 1, name: "Water pump" });
  expect(screen.queryByText("No recorded history")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Clear dates" }));
  await screen.findByRole("heading", { name: "April invoice uploaded" });
});

it("preserves the range when loading more fails and Retry loads the same filtered page", async () => {
  let failed = false;
  apiGet.mockImplementation((_path, options) => {
    const query = queryOf(options);
    if (query.cursor && !failed) {
      failed = true;
      return Promise.resolve({
        error: { message: "Older March history unavailable" },
        response: new Response(null, { status: 500 }),
      });
    }
    return Promise.resolve(
      success(
        query.cursor
          ? { ...historyPage, items: [olderInvoice] }
          : { ...historyPage, nextCursor: "older-march" }
      )
    );
  });
  await openHistory(marchSearch);
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await screen.findByRole("alert");
  screen.getByRole("heading", { name: "Condition assessed" });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("heading", { name: "Older March invoice uploaded" });
  expect(
    historyQueries().every(
      (query) => query.from === "2026-03-01" && query.to === "2026-03-31"
    )
  ).toBe(true);
  expect(
    historyQueries()
      .filter((query) => query.cursor)
      .every((query) => query.cursor === "older-march")
  ).toBe(true);
  expect(
    within(
      screen.getByRole("list", { name: "Recorded asset history" })
    ).getAllByRole("listitem")
  ).toHaveLength(3);
});

it("changing the applied range closes a loaded document viewer and releases its object URL", async () => {
  const { router } = await openHistory(marchSearch);
  fireEvent.click(
    await screen.findByRole("button", { name: "Open invoice report.pdf" })
  );
  await screen.findByTitle("Preview report.pdf");
  // Browser navigation can change the range while focus is trapped in the modal.
  await act(() => router.history.push(`${url}${aprilSearch}`));
  await screen.findByRole("heading", { name: "April invoice uploaded" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:date-history");
  expect(
    screen.queryByRole("heading", { name: "Condition assessed" })
  ).toBeNull();
});

it("discards a late page response after changing the range and starts the new range at page one", async () => {
  const older = deferred<ReturnType<typeof success>>();
  apiGet.mockImplementation((_path, options) => {
    if (queryOf(options).cursor) {
      return older.promise;
    }
    const result = pageFor(options);
    return Promise.resolve(
      success({
        ...result,
        nextCursor:
          queryOf(options).from === "2026-04-01" ? null : "older-march",
      })
    );
  });
  await openHistory(marchSearch);
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await waitFor(() =>
    expect(
      historyQueries().some((query) => query.cursor === "older-march")
    ).toBe(true)
  );
  editDates("2026-04-01", "2026-04-30");
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  await screen.findByRole("heading", { name: "April invoice uploaded" });
  await act(async () => {
    older.resolve(success({ ...historyPage, items: [olderInvoice] }));
    await older.promise;
  });
  expect(
    screen.queryByRole("heading", { name: "Older March invoice uploaded" })
  ).toBeNull();
  expect(
    screen.queryByRole("heading", { name: "Condition assessed" })
  ).toBeNull();
  expect(
    historyQueries()
      .filter((query) => query.from === "2026-04-01")
      .every((query) => !query.cursor)
  ).toBe(true);
});

it("aborts a pending file read and ignores its late result when the range changes", async () => {
  const file = deferred<ReturnType<typeof success>>();
  let fileSignal: AbortSignal | undefined;
  apiGet.mockImplementation((path, options) => {
    if (path === contentPath) {
      fileSignal = (options as { signal?: AbortSignal }).signal;
      return file.promise;
    }
    return Promise.resolve(success(pageFor(options)));
  });
  const { router } = await openHistory(marchSearch);
  fireEvent.click(
    await screen.findByRole("button", { name: "Open invoice report.pdf" })
  );
  await screen.findByRole("dialog");
  await waitFor(() => expect(fileSignal).toBeDefined());
  await act(() => router.history.push(`${url}${aprilSearch}`));
  await screen.findByRole("heading", { name: "April invoice uploaded" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(fileSignal?.aborted).toBe(true);
  await act(async () => {
    file.resolve(success(new Blob(["late pdf"], { type: "application/pdf" })));
    await file.promise;
  });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("the source-write refresh prefix restarts a loaded filtered timeline from its first page", async () => {
  let refreshed = false;
  apiGet.mockImplementation((_path, options) => {
    if (refreshed) {
      return Promise.resolve(
        success({
          ...historyPage,
          items: [{ ...invoiceEntry, title: "Refreshed March history" }],
        })
      );
    }
    return Promise.resolve(
      success(
        queryOf(options).cursor
          ? { ...historyPage, items: [olderInvoice] }
          : { ...historyPage, nextCursor: "older-march" }
      )
    );
  });
  const { queryClient } = await openHistory(marchSearch);
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await screen.findByRole("heading", { name: "Older March invoice uploaded" });
  refreshed = true;
  await act(() => refreshAssetHistory(queryClient, "council", "estate"));
  await screen.findByRole("heading", { name: "Refreshed March history" });
  expect(
    screen.queryByRole("heading", { name: "Older March invoice uploaded" })
  ).toBeNull();
  expect(
    historyQueries().every(
      (query) => query.from === "2026-03-01" && query.to === "2026-03-31"
    )
  ).toBe(true);
});

it("applying a previously loaded range restarts at page one instead of restoring its cached tail", async () => {
  apiGet.mockImplementation((_path, options) => {
    const query = queryOf(options);
    if (query.from === "2026-04-01") {
      return Promise.resolve(success(pageFor(options)));
    }
    return Promise.resolve(
      success(
        query.cursor
          ? { ...historyPage, items: [olderInvoice] }
          : { ...historyPage, nextCursor: "older-march" }
      )
    );
  });
  await openHistory(marchSearch);
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await screen.findByRole("heading", { name: "Older March invoice uploaded" });
  editDates("2026-04-01", "2026-04-30");
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  await screen.findByRole("heading", { name: "April invoice uploaded" });
  editDates("2026-03-01", "2026-03-31");
  fireEvent.click(screen.getByRole("button", { name: "Apply dates" }));
  await screen.findByRole("heading", { name: "Condition assessed" });
  expect(
    screen.queryByRole("heading", { name: "Older March invoice uploaded" })
  ).toBeNull();
  screen.getByRole("button", { name: "Load more" });
});
