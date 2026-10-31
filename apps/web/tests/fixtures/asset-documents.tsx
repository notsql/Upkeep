import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { residentEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import { renderWithProviders } from "@tests/test-utils";
import { afterEach, beforeEach, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";

// Raw HTTP fixtures describe the plan before contract generation. No production
// DTOs or future components are invented to make these tests compile.
const { apiGet, apiPut, apiDelete, session, listeners, state } = vi.hoisted(
  () => ({
    apiGet: vi.fn<(path: string, options?: unknown) => Promise<unknown>>(),
    apiPut: vi.fn<(path: string, options?: unknown) => Promise<unknown>>(),
    apiDelete: vi.fn(),
    session: { user: { id: "owner" }, loading: false },
    listeners: new Set<() => void>(),
    state: { access: {} as unknown },
  })
);

export { apiDelete, apiGet, apiPut, listeners, session, state };

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
  api: {
    GET: apiGet,
    PUT: apiPut,
    DELETE: apiDelete,
    POST: vi.fn(),
    PATCH: vi.fn(),
  },
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

export const estateId = "00000000-0000-0000-0000-000000000001";
export const documentId = "00000000-0000-0000-0000-000000000002";
export const assetId = "00000000-0000-0000-0000-000000000003";
export const secondAssetId = "00000000-0000-0000-0000-000000000004";
export const locationId = "00000000-0000-0000-0000-000000000005";
export const associationPath =
  "/estates/{estateId}/documents/{documentId}/asset";
export const attachmentsPath = "/estates/{estateId}/assets/{assetId}/documents";
export const assetsPath = "/estates/{estateId}/assets";
export const assetAction = /associate asset for invoice\.pdf/i;
export const saveAction = /^save(?: link)?$/i;
export const unlinkAction = /^(?:confirm )?unlink(?: document)?$/i;
export const selectAsset = /select TT-A0001/i;

export const document = {
  id: documentId,
  estateId,
  documentType: "INVOICE",
  originalFilename: "invoice.pdf",
  contentType: "application/pdf",
  sizeBytes: 100,
  createdAt: "2026-10-25T01:00:00Z",
  canDelete: false,
};
export const asset = {
  id: assetId,
  estateId,
  reference: "TT-A0001",
  name: "Water pump",
  category: "PUMP",
  locationId,
  locationPath: "Block A › Level 1",
  condition: "UNASSESSED",
  lifecycleVersion: 0,
  deactivatedAt: null as string | null,
};
export const fixture = {
  association: {
    documentId,
    assetId: null as string | null,
    assetReference: null as string | null,
    assetName: null as string | null,
    associationVersion: 0,
    changedAt: null as string | null,
  },
  assets: [asset],
  owned: true,
  estateInactive: false as boolean,
  retired: false as boolean,
};

export function allow({
  owner = true,
  documents = true,
  editDocuments = true,
} = {}) {
  fixture.owned = owner;
  state.access = {
    ...unassignedAccess,
    canEnterWorkspace: true,
    estates: [
      {
        ...residentEstateAccess,
        estateId,
        estateName: "Testing Estate",
        role: "MANAGER",
        canViewManagement: true,
        canManageEstate: owner,
        canViewAssets: owner,
        canViewEstateDetails: true,
        canViewInspectionResults: true,
        canViewDocuments: documents,
        canUploadDocuments: editDocuments,
      },
    ],
  };
}

export function linked(id = assetId, version = 1) {
  fixture.association = {
    documentId,
    assetId: id,
    assetReference: id === assetId ? "TT-A0001" : "TT-A0002",
    assetName: "Water pump",
    associationVersion: version,
    changedAt: "2026-10-26T01:00:00Z",
  };
}

export function success(data: unknown) {
  return { data, response: new Response(null, { status: 200 }) };
}

export function failure(message: string, status: number) {
  return { error: { message }, response: new Response(null, { status }) };
}

export async function openAssetDocuments(
  page: "asset" | "documents" = "documents"
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [
        page === "asset"
          ? `/estates/${estateId}/assets/${assetId}`
          : `/estates/${estateId}/documents`,
      ],
    }),
    context: { queryClient },
    defaultPendingMinMs: 0,
  });
  await router.load();
  return { router, ...renderWithProviders(<RouterProvider router={router} />) };
}

function assetDetails() {
  return {
    ...asset,
    deactivatedAt: fixture.retired ? "2026-10-26T01:00:00Z" : null,
  };
}

function estateDetails() {
  return {
    id: estateId,
    name: "Testing Estate",
    code: "TT",
    owned: fixture.owned,
    address: "Road",
    postalCode: "123456",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    deactivatedAt: fixture.estateInactive ? "2026-10-26T01:00:00Z" : null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockReset();
  apiPut.mockReset();
  session.user = { id: "owner" };
  allow();
  fixture.estateInactive = false;
  fixture.retired = false;
  fixture.assets = [asset];
  fixture.association = {
    documentId,
    assetId: null,
    assetReference: null,
    assetName: null,
    associationVersion: 0,
    changedAt: null,
  };
  const responses: Record<string, () => unknown> = {
    "/access/context": () => state.access,
    "/estates/{id}": estateDetails,
    "/estates/{estateId}/documents": () => ({
      items: [document],
      nextCursor: null,
    }),
    [associationPath]: () => ({ ...fixture.association }),
    [attachmentsPath]: () => ({
      items: fixture.association.assetId === assetId ? [document] : [],
      nextCursor: null,
    }),
    [assetsPath]: () => fixture.assets,
    "/estates/{estateId}/assets/{id}": assetDetails,
    "/estates/{estateId}/inspection-assets/{assetId}": assetDetails,
    "/asset-categories": () => [{ code: "PUMP", label: "Pump" }],
    "/estates/{estateId}/locations": () => [
      {
        id: locationId,
        estateId,
        type: "BLOCK",
        name: "Block A",
        parentId: null,
        children: [],
      },
    ],
    "/estates/{estateId}/documents/{documentId}/content": () =>
      new Blob(["%PDF-test"], { type: "application/pdf" }),
    "/estates/{estateId}/documents/{documentId}/work-order": () => ({
      documentId,
      workOrderId: null,
      workOrderReference: null,
      associationVersion: 0,
    }),
  };
  apiGet.mockImplementation((path) => {
    const response = responses[path];
    if (response) {
      return Promise.resolve(success(response()));
    }
    // Unrelated asset sections stay pending; these tests exercise documents only.
    return new Promise(() => undefined);
  });
  apiPut.mockImplementation((path, options) => {
    if (path !== associationPath) {
      throw new Error(`Unexpected mutation: ${path}`);
    }
    const request = options as { body: { assetId: string | null } };
    const version = fixture.association.associationVersion + 1;
    if (request.body.assetId) {
      linked(request.body.assetId, version);
    } else {
      fixture.association = {
        documentId,
        assetId: null,
        assetReference: null,
        assetName: null,
        associationVersion: version,
        changedAt: "2026-10-26T02:00:00Z",
      };
    }
    return Promise.resolve(success({ ...fixture.association }));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
