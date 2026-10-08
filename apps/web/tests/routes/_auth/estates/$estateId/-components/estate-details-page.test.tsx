import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { EstateDetailsPage } from "@/routes/_auth/estates/$estateId/-components/estate-details-page";
import { renderWithProviders, screen } from "../../../../../test-utils";

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

describe("estate details page", () => {
  beforeEach(() => vi.resetAllMocks());

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
    screen.getByText("Shared with you. Only the owner can change this estate.");
    expect(screen.queryByRole("link", { name: "Edit estate" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Deactivate estate" })
    ).toBeNull();
  });
  it("links delegated inviters to estate council management", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: { ...estate, owned: false, canInviteMembers: true },
      response: new Response(),
    });
    renderWithProviders(<EstateDetailsPage estateId="estate-id" />);
    await screen.findByRole("link", { name: "Council members" });
  });
});
