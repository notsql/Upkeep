import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent } from "@testing-library/react";
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
const { state, session, listeners, apiGet, apiPost, apiDelete, apiPut } =
  vi.hoisted(() => ({
    apiGet: vi.fn<(path: unknown, options?: unknown) => Promise<unknown>>(),
    apiPost: vi.fn<(path: unknown, options?: unknown) => Promise<unknown>>(),
    apiPut: vi.fn<(path: unknown, options?: unknown) => Promise<unknown>>(),
    apiDelete: vi.fn<(path: unknown, options?: unknown) => Promise<unknown>>(),
    state: { access: {} as unknown },
    session: { user: { id: "caller" }, loading: false },
    listeners: new Set<() => void>(),
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
vi.mock("@/lib/api", () => ({
  api: { GET: apiGet, POST: apiPost, DELETE: apiDelete, PUT: apiPut },
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

const SELECT_ORDER = /select TT-W0001/i;
const SAVE_LINK = /^save link$/i;
const MUTATION_ACTIONS = /save link|change work order|remove link/i;
const DOWNLOAD_INVOICE = /download invoice.pdf/i;
const CHANGE_ORDER = /^change work order$/i;
const CORRECTION_REASON = /correction reason/i;
const REMOVE_LINK = /^remove link$/i;
const CONFIRM_REMOVAL = /^confirm removal$/i;
const UNLINKED = /not linked to a work order/i;
const ASSOCIATION_CHANGED = /association changed/i;
const REFRESH_ASSOCIATION = /refresh association/i;
const REVIEW_UPDATED = /reviewed the updated link/i;
const WRITE_ACTIONS = /save link|remove link|change work order/i;

const estateId = "00000000-0000-0000-0000-000000000001";
const documentId = "00000000-0000-0000-0000-000000000002";
const orderId = "00000000-0000-0000-0000-000000000003";
const document = {
  id: documentId,
  estateId,
  documentType: "INVOICE",
  originalFilename: "invoice.pdf",
  contentType: "application/pdf",
  sizeBytes: 100,
  createdAt: "2026-10-25T01:00:00Z",
  canDelete: false,
};
let association = {
  documentId,
  workOrderId: null as string | null,
  workOrderReference: null as string | null,
  associationVersion: 0,
};
const closedOrder = {
  id: orderId,
  reference: "TT-W0001",
  description: "Lift repair",
  status: "CLOSED",
  locationPath: "Block A / Level 1",
  category: "EQUIPMENT_FAULT",
  priority: "MEDIUM",
  createdAt: "2026-10-01T01:00:00Z",
};
const linkAction = /work-order link for invoice.pdf/i;

function allow(role = "MANAGER", orders = true) {
  state.access = {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: [
      {
        ...residentEstateAccess,
        estateId,
        estateName: "Testing",
        role,
        canViewDocuments: true,
        canUploadDocuments: true,
        canViewWorkOrders: orders,
        canCreateWorkOrders: role === "MANAGER",
        canUpdateWorkOrders: role === "MANAGER",
        canViewManagement: role === "MANAGER",
      },
    ],
  };
}
function success(data: unknown) {
  return { data, response: new Response(null, { status: 200 }) };
}
async function open(path = `/estates/${estateId}/documents`) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
    defaultPendingMinMs: 0,
  });
  await router.load();
  return renderWithProviders(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  allow();
  association = {
    documentId,
    workOrderId: null,
    workOrderReference: null,
    associationVersion: 0,
  };
  apiGet.mockImplementation((path) => {
    if (path === "/access/context") {
      return Promise.resolve(success(state.access));
    }
    if (path === "/estates/{estateId}/documents") {
      return Promise.resolve(success({ items: [document], nextCursor: null }));
    }
    if (path === "/estates/{estateId}/documents/{documentId}/work-order") {
      return Promise.resolve(success({ ...association }));
    }
    if (
      path === "/estates/{estateId}/documents/{documentId}/work-order/history"
    ) {
      return Promise.resolve(success({ items: [], nextCursor: null }));
    }
    if (path === "/estates/{estateId}/work-orders/{workOrderId}") {
      return Promise.resolve(
        success({
          ...closedOrder,
          estateId,
          source: "MANUAL",
          createdByName: "Alex",
          completion: null,
          version: 2,
        })
      );
    }
    if (
      path === "/estates/{estateId}/work-orders/{workOrderId}/status-history"
    ) {
      return Promise.resolve(success([]));
    }
    if (path === "/estates/{estateId}/work-orders/{workOrderId}/documents") {
      return Promise.resolve(success({ items: [document], nextCursor: null }));
    }
    if (path === "/estates/{estateId}/work-orders") {
      return Promise.resolve(
        success({ items: [closedOrder], nextCursor: null })
      );
    }
    return Promise.resolve(success({ items: [], nextCursor: null }));
  });
  apiPut.mockImplementation((_path, options) => {
    const request = options as { body: { workOrderId: string | null } };
    association = {
      documentId,
      workOrderId: request.body.workOrderId,
      workOrderReference: request.body.workOrderId ? "TT-W0001" : null,
      associationVersion: association.associationVersion + 1,
    };
    return Promise.resolve(success({ ...association }));
  });
});

it("lets a Manager select a Closed order and save a document association", async () => {
  await open();
  fireEvent.click(await screen.findByRole("button", { name: linkAction }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    await within(dialog).findByRole("button", { name: SELECT_ORDER })
  );
  fireEvent.click(within(dialog).getByRole("button", { name: SAVE_LINK }));
  await waitFor(() =>
    expect(apiPut).toHaveBeenCalledWith(
      "/estates/{estateId}/documents/{documentId}/work-order",
      expect.objectContaining({
        body: expect.objectContaining({
          workOrderId: orderId,
          expectedAssociationVersion: 0,
        }),
      })
    )
  );
  await within(dialog).findByText("TT-W0001");
});

it("lets Crew read an existing association without mutation or picker controls", async () => {
  allow("CREW");
  association = {
    documentId,
    workOrderId: orderId,
    workOrderReference: "TT-W0001",
    associationVersion: 1,
  };
  await open();
  fireEvent.click(await screen.findByRole("button", { name: linkAction }));
  const dialog = await screen.findByRole("dialog");
  await within(dialog).findByText("TT-W0001");
  expect(
    within(dialog).queryByRole("button", {
      name: MUTATION_ACTIONS,
    })
  ).toBeNull();
  expect(
    apiGet.mock.calls.some(
      ([path]) => path === "/estates/{estateId}/work-orders"
    )
  ).toBe(false);
});

it("does not expose work-order linking to a document-only Council member", async () => {
  allow("COUNCIL", false);
  await open();
  await screen.findByRole("button", { name: DOWNLOAD_INVOICE });
  expect(screen.queryByRole("button", { name: linkAction })).toBeNull();
});

it("requires a reason to change an existing link and submits the reviewed association version", async () => {
  association = {
    documentId,
    workOrderId: "00000000-0000-0000-0000-000000000004",
    workOrderReference: "TT-W0002",
    associationVersion: 4,
  };
  await open();
  fireEvent.click(await screen.findByRole("button", { name: linkAction }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    await within(dialog).findByRole("button", { name: CHANGE_ORDER })
  );
  fireEvent.click(
    await within(dialog).findByRole("button", { name: SELECT_ORDER })
  );
  const reason = within(dialog).getByRole("textbox", {
    name: CORRECTION_REASON,
  });
  expect((reason as HTMLTextAreaElement).required).toBe(true);
  fireEvent.change(reason, { target: { value: "Wrong job selected" } });
  fireEvent.click(within(dialog).getByRole("button", { name: SAVE_LINK }));
  await waitFor(() =>
    expect(apiPut).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.objectContaining({
          expectedAssociationVersion: 4,
          correctionReason: "Wrong job selected",
          workOrderId: orderId,
        }),
      })
    )
  );
});

it("removes a link with a reason while keeping the document available", async () => {
  association = {
    documentId,
    workOrderId: orderId,
    workOrderReference: "TT-W0001",
    associationVersion: 1,
  };
  await open();
  fireEvent.click(await screen.findByRole("button", { name: linkAction }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    await within(dialog).findByRole("button", { name: REMOVE_LINK })
  );
  fireEvent.change(
    within(dialog).getByRole("textbox", { name: CORRECTION_REASON }),
    { target: { value: "Attached to the wrong job" } }
  );
  fireEvent.click(
    within(dialog).getByRole("button", { name: CONFIRM_REMOVAL })
  );
  await waitFor(() =>
    expect(apiPut).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.objectContaining({
          workOrderId: null,
          expectedAssociationVersion: 1,
          correctionReason: "Attached to the wrong job",
        }),
      })
    )
  );
  expect(apiDelete).not.toHaveBeenCalled();
  await within(dialog).findByText(UNLINKED);
});

it("retains a failed selection, does not retry automatically, and asks for review after a conflict", async () => {
  apiPut.mockResolvedValue({
    error: { message: "The association changed. Refresh and review." },
    response: new Response(null, { status: 409 }),
  });
  await open();
  fireEvent.click(await screen.findByRole("button", { name: linkAction }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    await within(dialog).findByRole("button", { name: SELECT_ORDER })
  );
  fireEvent.click(within(dialog).getByRole("button", { name: SAVE_LINK }));
  await within(dialog).findByText(ASSOCIATION_CHANGED);
  expect(apiPut).toHaveBeenCalledTimes(1);
  expect(
    within(dialog).getByRole<HTMLButtonElement>("button", {
      name: SAVE_LINK,
    }).disabled
  ).toBe(true);
  association = {
    documentId,
    workOrderId: orderId,
    workOrderReference: "TT-W0001",
    associationVersion: 1,
  };
  fireEvent.click(
    within(dialog).getByRole("button", { name: REFRESH_ASSOCIATION })
  );
  await within(dialog).findByRole("button", {
    name: REVIEW_UPDATED,
  });
  expect(apiPut).toHaveBeenCalledTimes(1);
});

it("shows documents attached to a work order for Crew with document access", async () => {
  allow("CREW");
  await open(`/estates/${estateId}/work-orders/${orderId}`);
  await screen.findByRole("heading", { name: "Documents" });
  await screen.findByRole("button", { name: DOWNLOAD_INVOICE });
  expect(
    screen.queryByRole("button", {
      name: WRITE_ACTIONS,
    })
  ).toBeNull();
});

it("does not query or show attachment metadata without document read access", async () => {
  allow("CREW");
  state.access = {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: [
      {
        ...residentEstateAccess,
        estateId,
        estateName: "Testing",
        role: "CREW",
        canViewWorkOrders: true,
        canViewDocuments: false,
        canUploadDocuments: false,
      },
    ],
  };
  await open(`/estates/${estateId}/work-orders/${orderId}`);
  await screen.findByRole("heading", { name: "TT-W0001" });
  expect(screen.queryByRole("heading", { name: "Documents" })).toBeNull();
  expect(
    apiGet.mock.calls.some(
      ([path]) =>
        path === "/estates/{estateId}/work-orders/{workOrderId}/documents"
    )
  ).toBe(false);
});

it("lets a Manager correct a validation error without requiring a stale-link refresh", async () => {
  association = {
    documentId,
    workOrderId: "00000000-0000-0000-0000-000000000004",
    workOrderReference: "TT-W0002",
    associationVersion: 1,
  };
  apiPut.mockResolvedValueOnce({
    error: { message: "Enter a correction reason." },
    response: new Response(null, { status: 400 }),
  });
  await open();
  fireEvent.click(await screen.findByRole("button", { name: linkAction }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    await within(dialog).findByRole("button", { name: CHANGE_ORDER })
  );
  fireEvent.click(
    await within(dialog).findByRole("button", { name: SELECT_ORDER })
  );
  const reason = within(dialog).getByRole("textbox", {
    name: CORRECTION_REASON,
  });
  fireEvent.change(reason, { target: { value: "   " } });
  fireEvent.click(within(dialog).getByRole("button", { name: SAVE_LINK }));
  await within(dialog).findByText("Enter a correction reason.");
  fireEvent.change(reason, { target: { value: "Corrected job selection" } });
  expect(
    within(dialog).getByRole<HTMLButtonElement>("button", { name: SAVE_LINK })
      .disabled
  ).toBe(false);
});

it("retains an uncertain-save selection and explains checking the saved association before retrying", async () => {
  apiPut.mockRejectedValueOnce(new TypeError("Failed to fetch"));
  await open();
  fireEvent.click(await screen.findByRole("button", { name: linkAction }));
  const dialog = await screen.findByRole("dialog");
  fireEvent.click(
    await within(dialog).findByRole("button", { name: SELECT_ORDER })
  );
  fireEvent.click(within(dialog).getByRole("button", { name: SAVE_LINK }));
  await within(dialog).findByText(
    "Link save could not be confirmed. Refresh the document link before retrying."
  );
  await within(dialog).findByText("Selected: TT-W0001");
  expect(apiPut).toHaveBeenCalledTimes(1);
  expect(
    within(dialog).getByRole<HTMLButtonElement>("button", { name: SAVE_LINK })
      .disabled
  ).toBe(true);
});

it("shows readable status labels in the association picker", async () => {
  await open();
  fireEvent.click(await screen.findByRole("button", { name: linkAction }));
  const dialog = await screen.findByRole("dialog");
  const status = await within(dialog).findByRole("combobox", {
    name: "Work-order status",
  });
  expect(status.textContent).toContain("All statuses");
  await chooseOption(status, "In progress");
  expect(status.textContent).toContain("In progress");
});
