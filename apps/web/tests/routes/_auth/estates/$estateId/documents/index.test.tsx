import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, fireEvent } from "@testing-library/react";
import { residentEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

// Raw response fixtures describe the agreed contract ahead of generation.
// Import the existing route tree so missing behaviour fails as a missing screen,
// rather than importing a document component which has not been implemented.
const { state, session, listeners, apiGet, apiPost, apiDelete } = vi.hoisted(
  () => ({
    apiGet: vi.fn<(path: unknown, options?: unknown) => Promise<unknown>>(),
    apiPost: vi.fn<(path: unknown, options?: unknown) => Promise<unknown>>(),
    apiDelete: vi.fn<(path: unknown, options?: unknown) => Promise<unknown>>(),
    state: { access: {} as unknown },
    session: { user: { id: "caller" }, loading: false },
    listeners: new Set<() => void>(),
  })
);

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
vi.mock("@/lib/api", () => ({
  api: { GET: apiGet, POST: apiPost, DELETE: apiDelete },
}));
vi.mock("@/lib/access-server", () => ({
  getSessionIdentity: () => Promise.resolve(session.user),
  getSessionAccess: () =>
    Promise.resolve({ user: session.user, access: state.access }),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useAuth: () => ({
      ...session,
      user: useSyncExternalStore(
        (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        () => session.user
      ),
    }),
  };
});

const FILE_INPUT = /^file$|choose file|file to upload/i;
const DOCUMENT_TYPE = /document type/i;
const DELETE_INVOICE = /delete.*April Invoice/i;
const DELETE_FILE = /^delete$|^delete file$/i;
const DOCUMENTS_HEADING = /documents/i;
const SUPPORTED_FORMATS = /PDF.*JPEG.*PNG/i;
const MAX_FILE_SIZE = /5 MB/;
const UPLOAD_FILE = /^upload$|^upload file$/i;
const UPLOAD_SUCCESS = /invoice\.pdf.*uploaded successfully/i;
const UPLOADING = /uploading/i;
const EMPTY_FILE = /empty|at least one byte/i;
const STORAGE_UNAVAILABLE = /storage.*unavailable/i;
const ANY_UPLOAD_SUCCESS = /uploaded successfully/i;
const UNCERTAIN_UPLOAD = /refresh|check.*list|confirm.*upload/i;
const RETRY = /retry/i;
const UPLOAD_FAILED = /upload failed/i;
const DOWNLOAD_INVOICE = /download.*April Invoice/i;
const UPLOAD_CONTROL = /upload/i;
const SEARCH = /^search$/i;
const CLEAR_SEARCH = /^clear$|^clear search$/i;
const NO_MATCHES = /no files match your search/i;
const NO_DOCUMENTS = /no documents uploaded/i;
const CANCEL = /^cancel$/i;
const DELETE_SUCCESS = /April Invoice\.pdf.*removed/i;
const DELETION_DESCRIPTION = /will be removed/;
const DELETE_DENIED = /only the uploader/i;
const TYPE_FILTER = "Filter by type";
const DOCUMENT_ROW = /April Invoice\.pdf/;

const estateId = "00000000-0000-0000-0000-000000000001";
const documentId = "00000000-0000-0000-0000-000000000002";
const otherEstateId = "00000000-0000-0000-0000-000000000003";
const documentsPath = "/estates/{estateId}/documents";
const contentPath = "/estates/{estateId}/documents/{documentId}/content";
const deletionPath = "/estates/{estateId}/documents/{documentId}";
const filename = "April Invoice.pdf";
const saved = {
  id: documentId,
  estateId,
  documentType: "INVOICE",
  originalFilename: filename,
  contentType: "application/pdf",
  sizeBytes: 1234,
  createdAt: "2026-10-25T01:00:00Z",
  canDelete: true,
};
let items = [saved];
let nextCursor: string | null = null;
let listFailure = false;

function allowDocuments({
  role = "CUSTOM",
  read = true,
  edit = true,
  inactive = false,
} = {}) {
  state.access = {
    ...unassignedAccess,
    canEnterWorkspace: read,
    estates: [
      {
        ...residentEstateAccess,
        estateId,
        estateName: "Maple Estate",
        role,
        customRoleId: role === "CUSTOM" ? "document-role" : null,
        customRoleName: role === "CUSTOM" ? "Document access" : null,
        canViewDocuments: read,
        canUploadDocuments: edit && !inactive,
      },
    ],
  };
}

function success(data: unknown, status = 200) {
  return { data, response: new Response(null, { status }) };
}

function failure(message: string, status = 503) {
  return {
    error: { message },
    response: new Response(null, { status }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function openDocuments(search = "") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [`/estates/${estateId}/documents${search}`],
    }),
    context: { queryClient },
    defaultPendingMinMs: 0,
    defaultNotFoundComponent: () => <p role="alert">Page unavailable</p>,
  });
  await router.load();
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

function selectedFile(
  name = "invoice.pdf",
  type = "application/pdf",
  size = 100
) {
  return new File([new Uint8Array(size)], name, { type });
}

function fileInput() {
  // File inputs have no implicit ARIA role; their accessible label is the query.
  return screen.getByLabelText<HTMLInputElement>(FILE_INPUT);
}

async function chooseFile(file = selectedFile()) {
  await chooseOption(
    screen.getByRole("combobox", { name: DOCUMENT_TYPE }),
    "Invoice"
  );
  fireEvent.change(fileInput(), { target: { files: [file] } });
}

function filenameSearch() {
  return (
    screen.queryByRole<HTMLInputElement>("searchbox", {
      name: "Search by filename",
    }) ??
    screen.getByRole<HTMLInputElement>("textbox", {
      name: "Search by filename",
    })
  );
}

async function confirmDeletion() {
  fireEvent.click(await screen.findByRole("button", { name: DELETE_INVOICE }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: DELETE_FILE }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  session.user = { id: "caller" };
  session.loading = false;
  items = [{ ...saved }];
  nextCursor = null;
  listFailure = false;
  allowDocuments();
  apiGet.mockImplementation((path) => {
    if (String(path) === "/access/context") {
      return Promise.resolve(success(state.access)) as never;
    }
    if (String(path) === documentsPath) {
      return Promise.resolve(
        listFailure
          ? failure("Unable to load documents. Try again.")
          : success({ items, nextCursor })
      ) as never;
    }
    if (String(path) === contentPath) {
      return Promise.resolve(success(new Blob(["private document"]))) as never;
    }
    return Promise.resolve(failure("Unexpected endpoint", 404)) as never;
  });
  apiPost.mockImplementation((path) => {
    if (String(path) !== documentsPath) {
      return Promise.resolve(failure("Unexpected endpoint", 404)) as never;
    }
    items = [{ ...saved, originalFilename: "invoice.pdf" }, ...items];
    return Promise.resolve(success(items[0], 201)) as never;
  });
  apiDelete.mockImplementation((path) => {
    if (String(path) !== deletionPath) {
      return Promise.resolve(failure("Unexpected endpoint", 404)) as never;
    }
    items = [];
    return Promise.resolve(success(undefined, 204)) as never;
  });
});

it.each(["MANAGER", "COUNCIL", "CREW", "CUSTOM"])(
  "opens Documents for %s without management-only estate queries",
  async (role) => {
    allowDocuments({ role });
    await openDocuments();

    await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
    await screen.findByText(filename);
    const paths = apiGet.mock.calls.map(([path]) => String(path));
    expect(paths).not.toContain("/estates/{id}");
    expect(paths).not.toContain("/estates/{estateId}/members");
  }
);

it("shows accepted formats, the 5 MB cap and a single-file chooser", async () => {
  await openDocuments();
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });

  screen.getByText(SUPPORTED_FORMATS);
  screen.getByText(MAX_FILE_SIZE);
  expect(fileInput().multiple).toBe(false);
});

it("uploads one file and document type through the generated client", async () => {
  await openDocuments();
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
  const file = selectedFile();
  await chooseFile(file);
  fireEvent.click(screen.getByRole("button", { name: UPLOAD_FILE }));

  await screen.findByText(UPLOAD_SUCCESS);
  const [request] = apiPost.mock.calls;
  expect(request?.[0]).toBe(documentsPath);
  const options: unknown = request?.[1];
  expect(options).toEqual(
    expect.objectContaining({ params: { path: { estateId } } })
  );
  if (!(options && typeof options === "object" && "body" in options)) {
    throw new Error("Expected multipart request options");
  }
  const { body } = options;
  expect(body).toBeInstanceOf(FormData);
  if (!(body instanceof FormData)) {
    throw new Error("Expected multipart document data");
  }
  expect(body.get("documentType")).toBe("INVOICE");
  expect(body.getAll("file")).toEqual([file]);
});

it("shows pending feedback and prevents duplicate upload submissions", async () => {
  const upload = deferred<ReturnType<typeof success>>();
  apiPost.mockImplementation(() => upload.promise as never);
  await openDocuments();
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
  await chooseFile();
  fireEvent.click(screen.getByRole("button", { name: UPLOAD_FILE }));

  const pending = await screen.findByRole("button", { name: UPLOADING });
  expect((pending as HTMLButtonElement).disabled).toBe(true);
  expect(
    screen
      .getAllByRole("status")
      .some((element) => UPLOADING.test(element.textContent ?? ""))
  ).toBe(true);
  fireEvent.click(pending);
  expect(apiPost).toHaveBeenCalledTimes(1);
  await act(async () => upload.resolve(success(saved, 201)));
});

it.each([
  ["unsafe.svg", "image/svg+xml", 100, SUPPORTED_FORMATS],
  ["large.pdf", "application/pdf", 5_000_001, MAX_FILE_SIZE],
  ["empty.pdf", "application/pdf", 0, EMPTY_FILE],
] as const)(
  "explains why %s cannot be uploaded",
  async (name, type, size, message) => {
    await openDocuments();
    await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
    await chooseFile(selectedFile(name, type, size));
    fireEvent.click(screen.getByRole("button", { name: UPLOAD_FILE }));

    const alerts = await screen.findAllByRole("alert");
    expect(
      alerts.some((element) => message.test(element.textContent ?? ""))
    ).toBe(true);
    expect(apiPost).not.toHaveBeenCalled();
  }
);

it("accepts a file exactly 5 MB in size", async () => {
  await openDocuments();
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
  await chooseFile(selectedFile("limit.pdf", "application/pdf", 5_000_000));
  fireEvent.click(screen.getByRole("button", { name: UPLOAD_FILE }));

  await waitFor(() => expect(apiPost).toHaveBeenCalled());
});

it("retains the selection and shows an actionable server upload error", async () => {
  apiPost.mockResolvedValue(
    failure("Document storage is temporarily unavailable.") as never
  );
  await openDocuments();
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
  const file = selectedFile();
  await chooseFile(file);
  fireEvent.click(screen.getByRole("button", { name: UPLOAD_FILE }));

  await screen.findByRole("alert");
  screen.getByText(STORAGE_UNAVAILABLE);
  expect(fileInput().files?.[0]).toBe(file);
  expect(screen.queryByText(ANY_UPLOAD_SUCCESS)).toBeNull();
  expect(apiPost).toHaveBeenCalledTimes(1);
});

it("explains uncertain completion without automatically resubmitting", async () => {
  apiPost.mockRejectedValue(new TypeError("Failed to fetch"));
  await openDocuments();
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
  await chooseFile();
  fireEvent.click(screen.getByRole("button", { name: UPLOAD_FILE }));

  await screen.findByRole("alert");
  screen.getByText(UNCERTAIN_UPLOAD);
  expect(apiPost).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(ANY_UPLOAD_SUCCESS)).toBeNull();
});

it("keeps confirmed upload success when refreshing the list fails", async () => {
  apiPost.mockImplementation(() => {
    listFailure = true;
    return Promise.resolve(success(saved, 201)) as never;
  });
  await openDocuments();
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
  await chooseFile();
  fireEvent.click(screen.getByRole("button", { name: UPLOAD_FILE }));

  await screen.findByText(UPLOAD_SUCCESS);
  await screen.findByRole("alert");
  screen.getByRole("button", { name: RETRY });
  expect(screen.queryByText(UPLOAD_FAILED)).toBeNull();
});

it("announces a confirmed upload without waiting for the list refresh", async () => {
  const refresh = deferred<ReturnType<typeof success>>();
  apiPost.mockImplementation(() => {
    apiGet.mockImplementation((path) =>
      String(path) === documentsPath
        ? refresh.promise
        : Promise.resolve(success(state.access))
    );
    return Promise.resolve(success(saved, 201));
  });
  await openDocuments();
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
  await chooseFile();
  fireEvent.click(screen.getByRole("button", { name: UPLOAD_FILE }));

  try {
    await screen.findByText(UPLOAD_SUCCESS);
    expect(
      (screen.getByRole("button", { name: UPLOAD_FILE }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
  } finally {
    await act(async () => refresh.resolve(success({ items, nextCursor })));
  }
});

it("gives a read-only user search and downloads without write controls", async () => {
  allowDocuments({ edit: false });
  items = [{ ...saved, canDelete: false }];
  await openDocuments();

  await screen.findByText(filename);
  filenameSearch();
  screen.getByRole("button", { name: DOWNLOAD_INVOICE });
  expect(screen.queryByRole("button", { name: UPLOAD_CONTROL })).toBeNull();
  expect(screen.queryByRole("button", { name: DELETE_INVOICE })).toBeNull();
});

it("does not infer deletion rights merely from edit access", async () => {
  items = [{ ...saved, canDelete: false }];
  await openDocuments();

  await screen.findByText(filename);
  screen.getByRole("button", { name: UPLOAD_FILE });
  expect(screen.queryByRole("button", { name: DELETE_INVOICE })).toBeNull();
});

it("sends a trimmed filename search and preserves it in the URL", async () => {
  const { router } = await openDocuments();
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
  fireEvent.change(filenameSearch(), { target: { value: "  invoice  " } });
  fireEvent.click(screen.getByRole("button", { name: SEARCH }));

  await waitFor(() =>
    expect(apiGet).toHaveBeenCalledWith(
      documentsPath,
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({ filename: "invoice" }),
        }),
      })
    )
  );
  expect(router.state.location.search).toHaveProperty("filename", "invoice");
});

it("restores the filename search from a direct link", async () => {
  await openDocuments("?filename=invoice");
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });

  expect(filenameSearch().value).toBe("invoice");
  expect(apiGet).toHaveBeenCalledWith(
    documentsPath,
    expect.objectContaining({
      params: expect.objectContaining({
        query: expect.objectContaining({ filename: "invoice" }),
      }),
    })
  );
});

it("clearing a filename search resets its pagination cursor", async () => {
  const { router } = await openDocuments(
    "?filename=invoice&cursor=previous-page"
  );
  await screen.findByRole("heading", { name: DOCUMENTS_HEADING });
  fireEvent.click(screen.getByRole("button", { name: CLEAR_SEARCH }));

  await waitFor(() => {
    expect(router.state.location.search).not.toHaveProperty("filename");
    expect(router.state.location.search).not.toHaveProperty("cursor");
  });
  expect(filenameSearch().value).toBe("");
});

it.each([false, true])(
  "explains an empty list with search active=%s",
  async (searching) => {
    items = [];
    await openDocuments(searching ? "?filename=missing" : "");

    await screen.findByText(searching ? NO_MATCHES : NO_DOCUMENTS);
    if (searching) {
      screen.getByRole("button", { name: CLEAR_SEARCH });
    }
  }
);

it("names the file in deletion confirmation and Cancel leaves it untouched", async () => {
  await openDocuments();
  fireEvent.click(await screen.findByRole("button", { name: DELETE_INVOICE }));
  const confirmation = within(await screen.findByRole("dialog"));
  confirmation.getByText(new RegExp(filename.replace(".", "\\.")));
  fireEvent.click(confirmation.getByRole("button", { name: CANCEL }));

  expect(apiDelete).not.toHaveBeenCalled();
  screen.getByText(filename);
});

it("deletes the confirmed file and refreshes the list", async () => {
  await openDocuments();
  await confirmDeletion();

  await waitFor(() =>
    expect(apiDelete).toHaveBeenCalledWith(
      deletionPath,
      expect.objectContaining({
        params: { path: { estateId, documentId } },
      })
    )
  );
  await waitFor(() => expect(screen.queryByText(filename)).toBeNull());
  await screen.findByText(DELETE_SUCCESS);
});

it("refreshes every cached filename search after deletion", async () => {
  const { queryClient } = await openDocuments();
  queryClient.setQueryData(
    ["caller", "documents", estateId, { filename: "April" }],
    { items: [saved], nextCursor: null }
  );
  await confirmDeletion();

  await waitFor(() =>
    expect(
      queryClient.getQueryState([
        "caller",
        "documents",
        estateId,
        { filename: "April" },
      ])?.isInvalidated
    ).toBe(true)
  );
});

it("retains the delete dialog and file after a denied deletion", async () => {
  apiDelete.mockResolvedValue(
    failure(
      "Only the uploader or an estate Manager can delete this file.",
      403
    ) as never
  );
  await openDocuments();
  await confirmDeletion();

  const confirmation = within(await screen.findByRole("dialog"));
  await confirmation.findByRole("alert");
  screen.getByText(DELETE_DENIED);
  expect(screen.getAllByText(filename).length).toBeGreaterThan(0);
  expect(apiDelete).toHaveBeenCalledTimes(1);
});

it("downloads through the authenticated client and releases the temporary object URL", async () => {
  const createObjectURL = vi.fn(() => "blob:document-download");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    }
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    () => undefined
  );
  await openDocuments();
  fireEvent.click(
    await screen.findByRole("button", { name: DOWNLOAD_INVOICE })
  );

  await waitFor(() =>
    expect(apiGet).toHaveBeenCalledWith(
      contentPath,
      expect.objectContaining({
        params: { path: { estateId, documentId } },
        parseAs: "blob",
      })
    )
  );
  expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  await waitFor(() =>
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:document-download")
  );
});

it("removes write controls after edit permission is revoked", async () => {
  const { queryClient } = await openDocuments();
  await screen.findByRole("button", { name: DELETE_INVOICE });
  allowDocuments({ edit: false });
  items = [{ ...saved, canDelete: false }];
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ["caller", "app-access"] });
    await queryClient.invalidateQueries({
      queryKey: ["caller", "documents", estateId],
    });
  });

  await waitFor(() => {
    expect(screen.queryByRole("button", { name: UPLOAD_CONTROL })).toBeNull();
    expect(screen.queryByRole("button", { name: DELETE_INVOICE })).toBeNull();
  });
  screen.getByText(filename);
});

it("does not carry the previous estates file list into another estate", async () => {
  const { router } = await openDocuments();
  await screen.findByText(filename);
  state.access = {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: [estateId, otherEstateId].map((id) => ({
      ...residentEstateAccess,
      estateId: id,
      estateName: id === estateId ? "Maple Estate" : "Oak Estate",
      role: "CUSTOM",
      canViewDocuments: true,
      canUploadDocuments: false,
    })),
  };
  items = [];
  await act(async () =>
    router.navigate({ href: `/estates/${otherEstateId}/documents` })
  );

  await waitFor(() => expect(screen.queryByText(filename)).toBeNull());
});

it("a second account never sees the previous accounts file list", async () => {
  await openDocuments();
  await screen.findByText(filename);
  items = [];
  await act(() => {
    session.user = { id: "another-account" };
    for (const listener of listeners) {
      listener();
    }
  });

  await waitFor(() => expect(screen.queryByText(filename)).toBeNull());
});

it("a denied document deep link does not start a protected list request", async () => {
  allowDocuments({ read: false, edit: false });
  await openDocuments();

  await screen.findByRole("alert");
  expect(apiGet.mock.calls.map(([path]) => String(path))).not.toContain(
    documentsPath
  );
  expect(apiPost).not.toHaveBeenCalled();
});

it.each([true, false])(
  "shows mobile document details and only permitted actions: canDelete=%s",
  async (canDelete) => {
    const original = window.matchMedia;
    vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
      ...original(query),
      matches: query === "(max-width: 767px)",
    }));
    allowDocuments({ edit: false });
    items = [{ ...saved, canDelete }];
    nextCursor = "more-documents";
    const { router } = await openDocuments("?filename=Invoice");
    const list = within(await screen.findByRole("list", { name: "Documents" }));
    list.getByText(filename);
    list.getByText("Invoice");
    expect(list.queryByText("1,234 bytes")).toBeNull();
    list.getByRole("button", { name: `Download ${filename}` });
    expect(
      list.queryByRole("button", { name: `Delete ${filename}` }) !== null
    ).toBe(canDelete);
    expect(
      list.queryByRole("button", { name: `Work-order link for ${filename}` })
    ).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    if (canDelete) {
      fireEvent.click(list.getByRole("button", { name: `Delete ${filename}` }));
      const dialog = within(
        await screen.findByRole("dialog", { name: "Delete file" })
      );
      dialog.getByText(DELETION_DESCRIPTION);
      fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
      expect(apiDelete).not.toHaveBeenCalled();
    }
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        filename: "Invoice",
        cursor: "more-documents",
      })
    );
  }
);
it("shows the Documents table without a Size column or size cells", async () => {
  await openDocuments();
  const table = within(await screen.findByRole("table"));
  expect(
    table.getAllByRole("columnheader").map((header) => header.textContent)
  ).toEqual(["Filename", "Type", "Uploaded", "Asset", "Actions"]);
  const row = within(table.getByRole("row", { name: DOCUMENT_ROW }));
  expect(row.getAllByRole("cell")).toHaveLength(5);
});

it("offers All types, Invoice and Service report in the type filter", async () => {
  await openDocuments();
  const filter = await screen.findByRole("combobox", { name: TYPE_FILTER });
  expect(filter.textContent).toContain("All types");
  fireEvent.click(filter);
  expect(screen.getAllByRole("option")).toHaveLength(3);
  screen.getByRole("option", { name: "All types" });
  screen.getByRole("option", { name: "Invoice" });
  screen.getByRole("option", { name: "Service report" });
});

it.each([
  ["Invoice", "INVOICE"],
  ["Service report", "SERVICE_REPORT"],
])(
  "filters by %s while retaining filename and resetting pagination",
  async (label, type) => {
    const { router } = await openDocuments("?filename=invoice&cursor=old-page");
    await chooseOption(
      await screen.findByRole("combobox", { name: TYPE_FILTER }),
      label
    );
    await waitFor(() => {
      expect(router.state.location.search).toHaveProperty("documentType", type);
      expect(router.state.location.search).toHaveProperty(
        "filename",
        "invoice"
      );
      expect(router.state.location.search).not.toHaveProperty("cursor");
      expect(apiGet).toHaveBeenCalledWith(
        documentsPath,
        expect.objectContaining({
          params: expect.objectContaining({
            path: { estateId },
            query: expect.objectContaining({
              filename: "invoice",
              documentType: type,
            }),
          }),
        })
      );
    });
  }
);

it("restores the type from a direct link and browser back navigation", async () => {
  const { router } = await openDocuments("?documentType=SERVICE_REPORT");
  const filter = await screen.findByRole("combobox", { name: TYPE_FILTER });
  expect(filter.textContent).toContain("Service report");
  await chooseOption(filter, "All types");
  await waitFor(() =>
    expect(router.state.location.search).not.toHaveProperty("documentType")
  );
  await act(() => {
    router.history.back();
  });
  await waitFor(() =>
    expect(
      screen.getByRole("combobox", { name: TYPE_FILTER }).textContent
    ).toContain("Service report")
  );
});

it.each(["search", "clear"])(
  "retains the selected type when applying filename action %s",
  async (action) => {
    const { router } = await openDocuments(
      "?filename=invoice&documentType=SERVICE_REPORT&cursor=old-page"
    );
    await screen.findByRole("combobox", { name: TYPE_FILTER });
    if (action === "search") {
      fireEvent.change(filenameSearch(), { target: { value: "maintenance" } });
      fireEvent.click(screen.getByRole("button", { name: SEARCH }));
    } else {
      fireEvent.click(screen.getByRole("button", { name: CLEAR_SEARCH }));
    }
    await waitFor(() => {
      expect(router.state.location.search).toHaveProperty(
        "documentType",
        "SERVICE_REPORT"
      );
      expect(router.state.location.search).not.toHaveProperty("cursor");
      if (action === "search") {
        expect(router.state.location.search).toHaveProperty(
          "filename",
          "maintenance"
        );
      } else {
        expect(router.state.location.search).not.toHaveProperty("filename");
      }
    });
  }
);

it("preserves type and filename through Next and First page", async () => {
  nextCursor = "next-type-page";
  const { router } = await openDocuments(
    "?filename=invoice&documentType=INVOICE"
  );
  fireEvent.click(await screen.findByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(apiGet).toHaveBeenCalledWith(
      documentsPath,
      expect.objectContaining({
        params: expect.objectContaining({
          query: {
            filename: "invoice",
            documentType: "INVOICE",
            cursor: "next-type-page",
          },
        }),
      })
    )
  );
  fireEvent.click(await screen.findByRole("button", { name: "First page" }));
  await waitFor(() => {
    expect(router.state.location.search).toHaveProperty("filename", "invoice");
    expect(router.state.location.search).toHaveProperty(
      "documentType",
      "INVOICE"
    );
    expect(router.state.location.search).not.toHaveProperty("cursor");
  });
});

it("shows the filtered empty state and clears the type back to All types", async () => {
  items = [];
  const { router } = await openDocuments(
    "?documentType=INVOICE&cursor=old-page"
  );
  await screen.findByText(NO_MATCHES);
  await chooseOption(
    screen.getByRole("combobox", { name: TYPE_FILTER }),
    "All types"
  );
  await screen.findByText(NO_DOCUMENTS);
  expect(router.state.location.search).not.toHaveProperty("documentType");
  expect(router.state.location.search).not.toHaveProperty("cursor");
});

it("omits unsupported type values from URL filters", async () => {
  const { router } = await openDocuments("?documentType=OTHERS");
  const filter = await screen.findByRole("combobox", { name: TYPE_FILTER });
  expect(filter.textContent).toContain("All types");
  expect(router.state.location.search).not.toHaveProperty("documentType");
});

it("deletion invalidates cached pages for each document type", async () => {
  const { queryClient } = await openDocuments();
  const keys = ["INVOICE", "SERVICE_REPORT"].map((documentType) => [
    "caller",
    "documents",
    estateId,
    { documentType },
  ]);
  for (const key of keys) {
    queryClient.setQueryData(key, { items: [saved], nextCursor: null });
  }
  await confirmDeletion();
  await waitFor(() => {
    for (const key of keys) {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    }
  });
});
