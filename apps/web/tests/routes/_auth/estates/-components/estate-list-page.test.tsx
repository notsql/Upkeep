import { fireEvent } from "@testing-library/react";

vi.mock("@/routes/_auth/estates/-components/pending-invitations", () => ({
  PendingInvitations: () => null,
}));

import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { type ReactNode, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { EstateDirectoryFilters } from "@/routes/_auth/estates/-components/estate-directory-filters";
import { EstateListPage } from "@/routes/_auth/estates/-components/estate-list-page";

// The real route owns URL-backed filters; isolated screen tests supply a controller.
function Directory() {
  const [filters, setFilters] = useState<EstateDirectoryFilters>({});
  return <EstateListPage filters={filters} onFiltersChange={setFilters} />;
}

vi.mock("@/routes/_auth/estates/-components/invitation-acceptance", () => ({
  InvitationAcceptance: () => null,
}));

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: { estateId: string };
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to.replace("$estateId", params?.estateId ?? "")} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
const estate = {
  id: "estate-id",
  name: "Maple Grove",
  code: "MG-001",
  address: "1 Grove Road",
  postalCode: "123456",
  createdAt: "2026-09-25T00:00:00Z",
  updatedAt: "2026-09-25T00:00:00Z",
  owned: true,
};

describe("estate list page", () => {
  beforeEach(() => vi.resetAllMocks());

  it("offers creation when the owner has no active estates", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [],
      response: new Response(),
    });
    renderWithProviders(<Directory />);
    expect((await screen.findByRole("status")).textContent).toContain(
      "No active estates"
    );
    screen.getByRole("link", { name: "Create estate" });
  });

  it("loads the requested inactive filter and isolates its cache by user", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [estate],
      response: new Response(),
    });
    const { queryClient } = renderWithProviders(<Directory />);
    await screen.findByRole("link", { name: "Maple Grove (MG-001)" });
    await chooseOption(
      screen.getByRole("combobox", { name: "Status" }),
      "Inactive"
    );
    await waitFor(() =>
      expect(api.GET).toHaveBeenCalledWith("/estates", {
        params: { query: { status: "INACTIVE" } },
      })
    );
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .every((query) => query.queryKey.includes("owner"))
    ).toBe(true);
  });

  it("explains a failed list request", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "Unable to load estates." },
      response: new Response(null, { status: 500 }),
    });
    renderWithProviders(<Directory />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Unable to load estates"
    );
  });

  it("marks a granted estate in the list as shared with you", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [{ ...estate, owned: false }],
      response: new Response(),
    });
    renderWithProviders(<Directory />);
    await screen.findByRole("link", { name: "Maple Grove (MG-001)" });
    within(screen.getByRole("listitem")).getByText("Shared with you");
  });

  it("uses Estates consistently as the page heading", () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [],
      response: new Response(),
    });
    renderWithProviders(<Directory />);
    screen.getByRole("heading", { name: "Estates", level: 1 });
  });
  it("offers retry after an estate load failure", async () => {
    vi.mocked(api.GET)
      .mockResolvedValueOnce({
        error: { message: "Unable to load estates." },
        response: new Response(null, { status: 500 }),
      })
      .mockResolvedValue({ data: [], response: new Response() });
    renderWithProviders(<Directory />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry estates" }));
    expect((await screen.findByRole("status")).textContent).toContain(
      "No active estates"
    );
  });
});

it("searches estate names, codes and addresses and filters ownership", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    data: [
      estate,
      {
        ...estate,
        id: "shared",
        name: "Oak Park",
        code: "OP-002",
        address: "88 River Road",
        owned: false,
      },
    ],
    response: new Response(),
  });
  renderWithProviders(<Directory />);
  await screen.findByRole("link", { name: "Maple Grove (MG-001)" });
  const search = screen.getByRole("searchbox", { name: "Search estates" });
  for (const text of ["oak", "op-002", "river"]) {
    fireEvent.change(search, { target: { value: text } });
    screen.getByRole("link", { name: "Oak Park (OP-002)" });
    expect(
      screen.queryByRole("link", { name: "Maple Grove (MG-001)" })
    ).toBeNull();
  }
  fireEvent.change(search, { target: { value: "" } });
  await chooseOption(screen.getByRole("combobox", { name: "Access" }), "Owner");
  expect(screen.queryByRole("link", { name: "Oak Park (OP-002)" })).toBeNull();
  await chooseOption(
    screen.getByRole("combobox", { name: "Access" }),
    "Shared with you"
  );
  screen.getByRole("link", { name: "Oak Park (OP-002)" });
  expect(
    screen.queryByRole("link", { name: "Maple Grove (MG-001)" })
  ).toBeNull();
  fireEvent.change(search, { target: { value: "missing" } });
  await screen.findByText("No estates match your search or access filter.");
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  await screen.findByRole("link", { name: "Maple Grove (MG-001)" });
});
