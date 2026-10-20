import { ownerEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import { renderWithProviders, screen, within } from "@tests/test-utils";
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

  it.each([undefined, "2026-09-25T00:00:00Z"])(
    "lets an assigned Manager edit without owner-only actions (inactive: %s)",
    async (deactivatedAt) => {
      vi.mocked(api.GET).mockResolvedValue({
        data: { ...estate, owned: false, deactivatedAt },
        response: new Response(),
      });
      vi.mocked(useAppAccess).mockReturnValue({
        data: {
          ...unassignedAccess,
          estates: [{ ...ownerEstateAccess, estateId: estate.id }],
        },
      } as unknown as ReturnType<typeof useAppAccess>);
      renderWithProviders(<EstateDetailsPage estateId={estate.id} />);
      await screen.findByRole("link", { name: "Edit estate" });
      expect(
        screen.queryByRole("button", { name: "Deactivate estate" })
      ).toBeNull();
      expect(
        screen.queryByText(
          "Shared with you. Only the owner can change this estate."
        )
      ).toBeNull();
    }
  );

  it("does not show editing for a Manager assigned only to another estate", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...estate, owned: false },
      response: new Response(),
    });
    vi.mocked(useAppAccess).mockReturnValue({
      data: { ...unassignedAccess, estates: [ownerEstateAccess] },
    } as unknown as ReturnType<typeof useAppAccess>);
    renderWithProviders(<EstateDetailsPage estateId={estate.id} />);
    await screen.findByRole("heading", { name: "Maple Grove" });
    expect(screen.queryByRole("link", { name: "Edit estate" })).toBeNull();
  });

  it("groups Estate members with the owner's estate actions", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: {
        ...estate,
        canInviteMembers: true,
        canManageInvitationPermissions: true,
      },
      response: new Response(),
    });
    renderWithProviders(<EstateDetailsPage estateId="estate-id" />);
    const actions = within(
      await screen.findByRole("group", { name: "Estate actions" })
    );
    actions.getByRole("link", { name: "Edit estate" });
    actions.getByRole("link", { name: "Estate members" });
    actions.getByRole("button", { name: "Deactivate estate" });
  });

  it("keeps inactive details and editing accessible without deactivation", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...estate, deactivatedAt: "2026-09-25T00:00:00Z" },
      response: new Response(),
    });
    renderWithProviders(<EstateDetailsPage estateId="estate-id" />);
    await screen.findByRole("heading", { name: "Maple Grove" });
    screen.getByRole("link", { name: "Edit estate" });
    expect(
      screen.queryByRole("button", { name: "Deactivate estate" })
    ).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Inactive");
  });

  it("shows a granted estate read-only", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...estate, owned: false },
      response: new Response(),
    });
    renderWithProviders(<EstateDetailsPage estateId="estate-id" />);
    await screen.findByRole("heading", { name: "Maple Grove" });
    screen.getByText(
      "Shared with you. Only the owner or an assigned Manager can edit estate details."
    );
    expect(screen.queryByRole("link", { name: "Edit estate" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Deactivate estate" })
    ).toBeNull();
  });
  it("links delegated inviters to estate member management", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...estate, owned: false, canInviteMembers: true },
      response: new Response(),
    });
    renderWithProviders(<EstateDetailsPage estateId="estate-id" />);
    await screen.findByRole("link", { name: "Estate members" });
  });
});
