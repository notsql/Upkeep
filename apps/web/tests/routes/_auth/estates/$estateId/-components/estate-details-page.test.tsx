import {
  crewEstateAccess,
  ownerEstateAccess,
  unassignedAccess,
} from "@tests/fixtures/access";
import { renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppAccess } from "@/lib/access";
import { api } from "@/lib/api";
import { EstateDetailsPage } from "@/routes/_auth/estates/$estateId/-components/estate-details-page";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@/lib/access", () => ({ useAppAccess: vi.fn() }));
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

describe("estate details page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useAppAccess).mockReturnValue({
      data: unassignedAccess,
    } as unknown as ReturnType<typeof useAppAccess>);
  });

  it("shows name, status, description and details without the action row or Assets card", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: {
        ...estate,
        description: "Riverside condo",
        canInviteMembers: true,
        canManageInvitationPermissions: true,
      },
      response: new Response(),
    });
    vi.mocked(useAppAccess).mockReturnValue({
      data: {
        ...unassignedAccess,
        estates: [{ ...ownerEstateAccess, estateId: estate.id }],
      },
    } as unknown as ReturnType<typeof useAppAccess>);
    renderWithProviders(<EstateDetailsPage estateId={estate.id} />);
    await screen.findByRole("heading", { name: estate.name });
    expect(screen.getByRole("status").textContent).toContain("Active");
    expect(screen.getAllByText("Riverside condo").length).toBeGreaterThan(0);
    screen.getByText("MCST MG-001");
    screen.getByText("1 Grove Road");
    expect(screen.queryByRole("group", { name: "Estate actions" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Estate assets" })).toBeNull();
    for (const name of [
      "View assets",
      "Register asset",
      "Back to estates",
      "Edit estate",
      "Estates",
    ]) {
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
    expect(
      screen.queryByRole("button", { name: "Deactivate estate" })
    ).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Breadcrumbs" })
    ).toBeNull();
  });

  it("does not fetch administrative data for Crew", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...estate, owned: false },
      response: new Response(),
    });
    vi.mocked(useAppAccess).mockReturnValue({
      data: {
        ...unassignedAccess,
        estates: [{ ...crewEstateAccess, estateId: estate.id }],
      },
    } as unknown as ReturnType<typeof useAppAccess>);
    renderWithProviders(<EstateDetailsPage estateId={estate.id} />);
    await screen.findByRole("heading", { name: estate.name });
    expect(
      vi
        .mocked(api.GET)
        .mock.calls.some((call) =>
          ["/estates/{estateId}/members", "/estates/{estateId}/roles"].includes(
            call[0]
          )
        )
    ).toBe(false);
  });

  it("keeps inactive details visible", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...estate, deactivatedAt: "2026-09-25T00:00:00Z" },
      response: new Response(),
    });
    renderWithProviders(<EstateDetailsPage estateId="estate-id" />);
    await screen.findByRole("heading", { name: "Maple Grove" });
    expect(screen.getByRole("status").textContent).toContain("Inactive");
    screen.getByRole("note");
  });

  it("notes a granted estate is shared read-only", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...estate, owned: false },
      response: new Response(),
    });
    renderWithProviders(<EstateDetailsPage estateId="estate-id" />);
    await screen.findByRole("heading", { name: "Maple Grove" });
    screen.getByText(
      "Shared with you. Only the owner or an assigned Manager can edit estate details."
    );
  });
});
