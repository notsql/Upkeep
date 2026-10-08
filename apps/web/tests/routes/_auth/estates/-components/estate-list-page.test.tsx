vi.mock("@/routes/_auth/estates/-components/pending-invitations", () => ({
  PendingInvitations: () => null,
}));

import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { EstateListPage } from "@/routes/_auth/estates/-components/estate-list-page";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "../../../../test-utils";

vi.mock("@/routes/_auth/estates/-components/invitation-acceptance", () => ({
  InvitationAcceptance: () => null,
}));

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
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
    renderWithProviders(<EstateListPage />);
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
    const { queryClient } = renderWithProviders(<EstateListPage />);
    await screen.findByRole("link", { name: "Maple Grove" });
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
    renderWithProviders(<EstateListPage />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Unable to load estates"
    );
  });

  it("marks a granted estate in the list as shared with you", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [{ ...estate, owned: false }],
      response: new Response(),
    });
    renderWithProviders(<EstateListPage />);
    await screen.findByRole("link", { name: "Maple Grove" });
    within(screen.getByRole("listitem")).getByText("Shared with you");
  });
});
