import { act, fireEvent } from "@testing-library/react";
import {
  ownerEstateAccess,
  residentAccess,
  unassignedAccess,
} from "@tests/fixtures/access";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { useAppAccess } from "@/lib/access";
import { api } from "@/lib/api";
import { EstateEditorPage } from "@/routes/_auth/estates/-components/estate-editor-page";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), PATCH: vi.fn(), POST: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "user" }, loading: false }),
}));
const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
const estate = {
  id: "estate",
  name: "Maple Grove",
  code: "MG-001",
  address: "1 Grove Road",
  postalCode: "123456",
  createdAt: "2026-09-25T00:00:00Z",
  updatedAt: "2026-09-25T00:00:00Z",
  owned: false,
};
const CREATED = /created/i;
const ACCESS_FAILURE = /access|permission/i;
const RETRY = /retry/i;

beforeEach(() => vi.resetAllMocks());

// A consumer that remains mounted during creation, like the app navigation.
function AccessDestinations() {
  const access = useAppAccess();
  return (
    <nav aria-label="Available estate destinations">
      <p role="status">
        {access.data ? "Estate access ready" : "Loading estate access"}
      </p>
      {access.data?.estates.map((assignment) =>
        assignment.canManageEstate ? (
          <a href={`/estates/${assignment.estateId}`} key={assignment.estateId}>
            Manage {assignment.estateName}
          </a>
        ) : null
      )}
      {access.data?.canSubmitReport ? (
        <a href="/reports/new">Report a fault</a>
      ) : null}
    </nav>
  );
}

function submitNewEstate() {
  for (const [name, value] of [
    ["Name", "Maple Grove"],
    ["Estate code", "MG-001"],
    ["Address", "1 Grove Road"],
    ["Postal code", "123456"],
  ]) {
    fireEvent.change(screen.getByRole("textbox", { name }), {
      target: { value },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: "Create estate" }));
}

it.each([
  { account: "unassigned", initialAccess: unassignedAccess },
  { account: "Resident", initialAccess: residentAccess },
])(
  "refreshes a $account creator's permissions before opening their new estate",
  async ({ initialAccess }) => {
    let created = false;
    let releaseAccess: (() => void) | undefined;
    const updatedAccess = {
      ...initialAccess,
      canEnterWorkspace: true,
      estates: [
        ...initialAccess.estates,
        { ...ownerEstateAccess, estateId: estate.id, estateName: estate.name },
      ],
    };
    vi.mocked(api.GET).mockImplementation((path) => {
      if (path === "/access/context" && created) {
        return new Promise((resolve) => {
          releaseAccess = () =>
            resolve({ data: updatedAccess, response: new Response() } as never);
        });
      }
      return Promise.resolve({
        data: initialAccess,
        response: new Response(),
      }) as never;
    });
    vi.mocked(api.POST).mockImplementation(() => {
      created = true;
      return Promise.resolve({
        data: { ...estate, owned: true },
        response: new Response(null, { status: 201 }),
      }) as never;
    });
    renderWithProviders(
      <>
        <AccessDestinations />
        <EstateEditorPage />
      </>
    );
    await screen.findByText("Estate access ready");
    submitNewEstate();

    try {
      await waitFor(() => expect(releaseAccess).toBeTypeOf("function"));
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      await act(async () => releaseAccess?.());
    }
    expect(
      (
        await screen.findByRole("link", { name: "Manage Maple Grove" })
      ).getAttribute("href")
    ).toBe("/estates/estate");
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/estates/$estateId",
        params: { estateId: estate.id },
      })
    );
    if (initialAccess.hasResidentMembership) {
      expect(
        screen
          .getByRole("link", { name: "Report a fault" })
          .getAttribute("href")
      ).toBe("/reports/new");
    }
  }
);

it("recovers access after successful creation without submitting the estate again", async () => {
  let created = false;
  vi.mocked(api.GET).mockImplementation(() => {
    if (!created) {
      return Promise.resolve({
        data: unassignedAccess,
        response: new Response(),
      }) as never;
    }
    return Promise.resolve({
      error: { message: "Access unavailable" },
      response: new Response(null, { status: 503 }),
    }) as never;
  });
  vi.mocked(api.POST).mockImplementation(() => {
    created = true;
    return Promise.resolve({
      data: { ...estate, owned: true },
      response: new Response(null, { status: 201 }),
    }) as never;
  });
  renderWithProviders(
    <>
      <AccessDestinations />
      <EstateEditorPage />
    </>
  );
  await screen.findByText("Estate access ready");
  submitNewEstate();
  const error = await screen.findByRole("alert");
  expect(error.textContent).toMatch(CREATED);
  expect(error.textContent).toMatch(ACCESS_FAILURE);
  expect(navigate).not.toHaveBeenCalled();
  vi.mocked(api.GET).mockResolvedValue({
    data: {
      ...unassignedAccess,
      canEnterWorkspace: true,
      estates: [
        { ...ownerEstateAccess, estateId: estate.id, estateName: estate.name },
      ],
    },
    response: new Response(),
  } as never);
  fireEvent.click(screen.getByRole("button", { name: RETRY }));
  await screen.findByRole("link", { name: "Manage Maple Grove" });
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      to: "/estates/$estateId",
      params: { estateId: estate.id },
    })
  );
  expect(api.POST).toHaveBeenCalledTimes(1);
});

it.each([401, 409, 503])(
  "preserves the creation form after a rejected POST (%s)",
  async (status) => {
    vi.mocked(api.GET).mockResolvedValue({
      data: unassignedAccess,
      response: new Response(),
    });
    vi.mocked(api.POST).mockResolvedValue({
      error: { message: "Unable to create estate." },
      response: new Response(null, { status }),
    });
    renderWithProviders(<EstateEditorPage />);
    submitNewEstate();
    await screen.findByRole("alert");
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value
    ).toBe("Maple Grove");
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Estate code" })
        .value
    ).toBe("MG-001");
    expect(navigate).not.toHaveBeenCalled();
  }
);

it("keeps creation Back, breadcrumb and Cancel destinations on the estate directory", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    data: unassignedAccess,
    response: new Response(),
  });
  renderWithProviders(<EstateEditorPage />);
  for (const name of ["Back to estates", "Estates"]) {
    expect(screen.getByRole("link", { name }).getAttribute("href")).toBe(
      "/estates"
    );
  }
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({ to: "/estates" })
  );
  expect(api.POST).not.toHaveBeenCalled();
});

it.each([
  "COUNCIL",
  "MEMBER",
  "CREW",
  "RESIDENT",
  "unassigned",
  "other-estate Manager",
])("blocks direct edit navigation for %s", async (role) => {
  const access = {
    ...unassignedAccess,
    estates:
      role === "unassigned"
        ? []
        : [
            {
              ...ownerEstateAccess,
              estateId: role === "other-estate Manager" ? "other" : estate.id,
              role: role === "other-estate Manager" ? "MANAGER" : role,
              canManageEstate: role === "other-estate Manager",
            },
          ],
  };
  vi.mocked(api.GET).mockImplementation(
    async (path) =>
      ({
        data: path === "/access/context" ? access : estate,
        response: new Response(),
      }) as never
  );
  renderWithProviders(<EstateEditorPage estateId={estate.id} />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Only the owner or an assigned Manager can edit estate details."
  );
  expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});

it.each([undefined, "2026-09-25T00:00:00Z"])(
  "allows an assigned Manager to save details (inactive: %s)",
  async (deactivatedAt) => {
    const details = { ...estate, deactivatedAt };
    vi.mocked(api.GET).mockImplementation(
      async (path) =>
        ({
          data:
            path === "/access/context"
              ? {
                  ...unassignedAccess,
                  estates: [{ ...ownerEstateAccess, estateId: estate.id }],
                }
              : details,
          response: new Response(),
        }) as never
    );
    vi.mocked(api.PATCH).mockResolvedValue({
      data: details,
      response: new Response(),
    });
    renderWithProviders(<EstateEditorPage estateId={estate.id} />);
    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: "Maple Gardens" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(api.PATCH).toHaveBeenCalledWith("/estates/{id}", {
        params: { path: { id: estate.id } },
        body: {
          name: "Maple Gardens",
          code: "MG-001",
          address: "1 Grove Road",
          postalCode: "123456",
          description: "",
        },
      })
    );
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/estates/$estateId",
        params: { estateId: estate.id },
      })
    );
  }
);

it("waits for permissions before exposing a non-owner's edit form", async () => {
  vi.mocked(api.GET).mockImplementation((path) =>
    path === "/access/context"
      ? new Promise(() => undefined)
      : (Promise.resolve({ data: estate, response: new Response() }) as never)
  );
  const { queryClient } = renderWithProviders(
    <EstateEditorPage estateId={estate.id} />
  );
  await waitFor(() =>
    expect(
      queryClient.getQueryData(["estates", "user", "details", estate.id])
    ).toEqual(estate)
  );
  expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});

it("keeps the edit form hidden if permissions cannot load", async () => {
  vi.mocked(api.GET).mockImplementation(async (path) =>
    path === "/access/context"
      ? {
          error: { message: "Unavailable" },
          response: new Response(null, { status: 503 }),
        }
      : ({ data: estate, response: new Response() } as never)
  );
  renderWithProviders(<EstateEditorPage estateId={estate.id} />);
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Unable to load your access"
  );
  expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
});
