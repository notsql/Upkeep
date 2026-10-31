import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { fireEvent } from "@testing-library/react";
import { residentEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { AppNavigation, EstateNavigation } from "@/components/app-navigation";

const { apiGet, access } = vi.hoisted(() => ({
  apiGet: vi.fn<(path: unknown, options?: unknown) => Promise<unknown>>(),
  access: { response: {} as unknown },
}));
vi.mock("@/lib/api", () => ({ api: { GET: apiGet } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "caller" }, loading: false }),
}));

function NavigationLayout() {
  return (
    <>
      <AppNavigation />
      <EstateNavigation />
      <Outlet />
    </>
  );
}

function DocumentsDestination() {
  return <h1>Documents</h1>;
}

async function openNavigation() {
  const root = createRootRoute({ component: NavigationLayout });
  const routes = [
    "/",
    "/estates",
    "/estates/$estateId/documents",
    "/reports/new",
  ].map((path) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: DocumentsDestination,
    })
  );
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({
      initialEntries: ["/estates/maple/documents"],
    }),
  });
  await router.load();
  return renderWithProviders(<RouterProvider router={router} />);
}

function documentAccess(role: string, read: boolean) {
  access.response = {
    ...unassignedAccess,
    canEnterWorkspace: read,
    estates: [
      {
        ...residentEstateAccess,
        estateId: "maple",
        estateName: "Maple Estate",
        role,
        customRoleId: role === "CUSTOM" ? "document-role" : null,
        customRoleName: role === "CUSTOM" ? "Document reader" : null,
        canViewDocuments: read,
        canUploadDocuments: false,
      },
    ],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  const originalMedia = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    ...originalMedia(query),
    matches: query === "(max-width: 767px)",
  }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  documentAccess("CUSTOM", true);
  apiGet.mockImplementation((path) =>
    Promise.resolve(
      String(path) === "/access/context"
        ? { data: access.response, response: new Response() }
        : {
            error: { message: "No management access" },
            response: new Response(null, { status: 403 }),
          }
    )
  );
});

it.each(["MANAGER", "COUNCIL", "CREW", "CUSTOM"])(
  "shows document navigation for %s with document read access",
  async (role) => {
    documentAccess(role, true);
    await openNavigation();

    const desktop = within(
      await screen.findByRole("navigation", { name: "Desktop navigation" })
    );
    const link = await desktop.findByRole("link", { name: "Documents" });
    expect(link.getAttribute("href")).toBe("/estates/maple/documents");
    expect(link.getAttribute("aria-current")).toBe("page");
    const local = within(
      screen.getByRole("navigation", { name: "Estate navigation" })
    );
    fireEvent.click(
      local.getByRole("button", { name: "Estate section: Documents" })
    );
    expect(
      (await screen.findByRole("menuitem", { name: "Documents" })).getAttribute(
        "href"
      )
    ).toBe("/estates/maple/documents");
    expect(apiGet.mock.calls.map(([path]) => String(path))).not.toContain(
      "/estates/{id}"
    );
  }
);

it("hides document navigation without document read access", async () => {
  documentAccess("CUSTOM", false);
  await openNavigation();

  // This link appears only after the denied access response has rendered.
  // Checking absence before then passes even while access is still loading.
  const desktop = within(
    await screen.findByRole("navigation", { name: "Desktop navigation" })
  );
  await desktop.findByRole("link", { name: "Sign out" });

  expect(screen.queryByRole("link", { name: "Documents" })).toBeNull();
});
