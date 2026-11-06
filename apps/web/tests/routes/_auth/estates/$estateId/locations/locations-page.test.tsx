import { fireEvent } from "@testing-library/react";
import { ownerEstateAccess, unassignedAccess } from "@tests/fixtures/access";
import { renderWithProviders, screen } from "@tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppAccess } from "@/lib/access";
import { api } from "@/lib/api";
import { LocationsPage } from "@/routes/_auth/estates/$estateId/locations/-components/locations-page";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn() },
}));
vi.mock("@/lib/access", async (original) => ({
  ...(await original<typeof import("@/lib/access")>()),
  useAppAccess: vi.fn(),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

describe("locations page", () => {
  beforeEach(() => {
    vi.mocked(useAppAccess).mockReturnValue({
      data: {
        ...unassignedAccess,
        estates: [{ ...ownerEstateAccess, estateId: "e" }],
      },
    } as unknown as ReturnType<typeof useAppAccess>);
    vi.mocked(api.GET).mockImplementation(((path: string) =>
      Promise.resolve({
        data:
          path === "/estates/{estateId}/locations"
            ? []
            : { id: "e", name: "Maple", owned: true },
        response: new Response(),
      })) as never);
  });

  it("is its own page with search, and adds blocks through a dialog", async () => {
    renderWithProviders(<LocationsPage estateId="e" />);
    screen.getByRole("heading", { level: 1, name: "Locations" });
    expect(
      screen.queryByRole("searchbox", { name: "Search locations" })
    ).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    screen.getByRole("searchbox", { name: "Search locations" });
    (await screen.findAllByRole("button", { name: "Create" }))[0]?.click();
    await screen.findByRole("dialog");
  });
});
