import { fireEvent } from "@testing-library/react";

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
import { EstateListPage } from "@/routes/_auth/estates/-components/estate-list-page/estate-list-page";

vi.mock(
  "@/routes/_auth/estates/-components/estate-list-page/pending-invitations",
  () => ({
    PendingInvitations: () => <p>Pending invitations banner</p>,
  })
);

// The real route owns URL-backed filters; isolated screen tests supply a controller.
function Directory() {
  const [filters, setFilters] = useState<EstateDirectoryFilters>({});
  return <EstateListPage filters={filters} onFiltersChange={setFilters} />;
}

vi.mock(
  "@/routes/_auth/estates/-components/estate-list-page/invitation-acceptance",
  () => ({
    InvitationAcceptance: () => null,
  })
);

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
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "No active estates"
      )
    );
    within(screen.getByRole("status")).getByText(
      "Use Create to add the first estate"
    );
    expect(screen.getAllByRole("link", { name: "Create" })).toHaveLength(1);
  });

  it("loads the requested inactive filter and isolates its cache by user", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [estate],
      response: new Response(),
    });
    const { queryClient } = renderWithProviders(<Directory />);
    await screen.findByRole("link", { name: "Maple Grove (MCST MG-001)" });
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
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
    await screen.findByRole("link", { name: "Maple Grove (MCST MG-001)" });
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
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain(
        "No active estates"
      )
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
  await screen.findByRole("link", { name: "Maple Grove (MCST MG-001)" });
  expect(
    screen.queryByRole("searchbox", { name: "Search estates" })
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  const search = screen.getByRole("searchbox", { name: "Search estates" });
  expect(search.getAttribute("placeholder")).toBe(
    "Search by name, MCST number or address"
  );
  for (const text of ["oak", "op-002", "river"]) {
    fireEvent.change(search, { target: { value: text } });
    screen.getByRole("link", { name: "Oak Park (MCST OP-002)" });
    expect(
      screen.queryByRole("link", { name: "Maple Grove (MCST MG-001)" })
    ).toBeNull();
  }
  fireEvent.change(search, { target: { value: "" } });
  await chooseOption(screen.getByRole("combobox", { name: "Access" }), "Owner");
  expect(
    screen.queryByRole("link", { name: "Oak Park (MCST OP-002)" })
  ).toBeNull();
  await chooseOption(
    screen.getByRole("combobox", { name: "Access" }),
    "Shared with you"
  );
  screen.getByRole("link", { name: "Oak Park (MCST OP-002)" });
  expect(
    screen.queryByRole("link", { name: "Maple Grove (MCST MG-001)" })
  ).toBeNull();
  fireEvent.change(search, { target: { value: "missing" } });
  await screen.findByText("Try another search or access filter");
  fireEvent.click(
    within(screen.getByRole("search", { name: "Filter estates" })).getByRole(
      "button",
      { name: "Clear filters" }
    )
  );
  await screen.findByRole("link", { name: "Maple Grove (MCST MG-001)" });
});

it("shows pending invitations above the Estates header", () => {
  vi.mocked(api.GET).mockResolvedValue({
    data: [],
    response: new Response(),
  } as never);
  renderWithProviders(<Directory />);
  const banner = screen.getByText("Pending invitations banner");
  const heading = screen.getByRole("heading", { name: "Estates" });
  const nodes = [...document.querySelectorAll("p, h1")];
  expect(nodes.indexOf(banner)).toBeLessThan(nodes.indexOf(heading));
});

it("announces loading and reports how many estates are shown", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    data: [estate],
    response: new Response(),
  });
  renderWithProviders(<Directory />);
  screen.getByText("Loading estates…");
  await screen.findByRole("link", { name: "Maple Grove (MCST MG-001)" });
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  await screen.findByText("1 estate");
});

it("offers clearing filters instead of creation when nothing matches", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    data: [estate],
    response: new Response(),
  });
  renderWithProviders(<Directory />);
  await screen.findByRole("link", { name: "Maple Grove (MCST MG-001)" });
  expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Search estates" }), {
    target: { value: "missing" },
  });
  const empty = await screen.findByRole("status");
  within(empty).getByRole("button", { name: "Clear filters" });
  const filters = screen.getByRole("search", { name: "Filter estates" });
  within(filters).getByText("1 active");
  within(filters).getByRole("button", { name: "Clear filters" });
  expect(within(empty).queryByRole("link", { name: "Create" })).toBeNull();
});

it("uses the shared loading, filter and empty states", async () => {
  vi.mocked(api.GET).mockResolvedValue({
    data: [],
    response: new Response(),
  } as never);
  renderWithProviders(<Directory />);
  screen.getByRole("status", { name: "Loading estates…" });
  fireEvent.click(screen.getByRole("button", { name: "Filters" }));
  screen.getByRole("search", { name: "Filter estates" });
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "No active estates"
    )
  );
  const empty = screen.getByRole("status");
  expect(within(empty).queryByRole("link", { name: "Create" })).toBeNull();
});
