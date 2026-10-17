import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { MemberEstates } from "@/routes/_auth/admin/-components/member-estates";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() },
}));

const path = "/api/admin/users/{userId}/estates/{estateId}";
const maple = /Maple Grove/;
const oak = /Oak Park/;
const ownedPine = /Pine Court.*Owner/;

// Disabled state as assistive tech sees it, whether the checkbox is a native
// input or an ARIA widget.
function isDisabled(element: HTMLElement): boolean {
  return (
    element.matches(":disabled") ||
    element.getAttribute("aria-disabled") === "true"
  );
}

describe("MemberEstates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.GET).mockResolvedValue({
      data: [
        {
          estateId: "maple",
          name: "Maple Grove",
          code: "MG-001",
          active: true,
          owner: false,
          granted: false,
          membershipRole: null,
          canManageGrant: true,
        },
        {
          estateId: "oak",
          name: "Oak Park",
          code: "OP-001",
          active: false,
          owner: false,
          granted: true,
          membershipRole: "COUNCIL",
          canManageGrant: true,
        },
        {
          estateId: "pine",
          name: "Pine Court",
          code: "PC-001",
          active: true,
          owner: true,
          granted: false,
          membershipRole: null,
          canManageGrant: false,
        },
      ],
    });
  });

  it("shows which estates the member can access", async () => {
    renderWithProviders(<MemberEstates name="Casey Doe" userId="usr_1" />);
    screen.getByRole("heading", { name: "Estate access for Casey Doe" });
    await screen.findByRole("checkbox", { name: maple, checked: false });
    screen.getByRole("checkbox", { name: oak, checked: true });
    const owned = screen.getByRole("checkbox", {
      name: ownedPine,
      checked: true,
    });
    expect(isDisabled(owned)).toBe(true);
    expect(api.GET).toHaveBeenCalledWith("/api/admin/users/{userId}/estates", {
      params: { path: { userId: "usr_1" } },
    });
  });

  it("grants and revokes access through the API", async () => {
    vi.mocked(api.PUT).mockResolvedValue({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 204 }),
    });
    vi.mocked(api.DELETE).mockResolvedValue({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 204 }),
    });
    renderWithProviders(<MemberEstates name="Casey Doe" userId="usr_1" />);

    fireEvent.click(await screen.findByRole("checkbox", { name: maple }));
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(path, {
        params: { path: { userId: "usr_1", estateId: "maple" } },
      })
    );

    await waitFor(() =>
      expect(isDisabled(screen.getByRole("checkbox", { name: oak }))).toBe(
        false
      )
    );
    fireEvent.click(screen.getByRole("checkbox", { name: oak }));
    await waitFor(() =>
      expect(api.DELETE).toHaveBeenCalledWith(path, {
        params: { path: { userId: "usr_1", estateId: "oak" } },
      })
    );
  });

  it("reports a failed change", async () => {
    vi.mocked(api.PUT).mockResolvedValue({
      error: { message: "failed" },
      response: new Response(null, { status: 500 }),
    });
    renderWithProviders(<MemberEstates name="Casey Doe" userId="usr_1" />);
    fireEvent.click(await screen.findByRole("checkbox", { name: maple }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Unable to update estate access"
    );
  });

  it("shows a resident assignment as read-only while permitting a management grant in another estate", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [
        {
          estateId: "maple",
          name: "Maple Grove",
          code: "MG-001",
          active: true,
          owner: false,
          granted: false,
          membershipRole: "RESIDENT",
          canManageGrant: false,
        },
        {
          estateId: "oak",
          name: "Oak Park",
          code: "OP-001",
          active: true,
          owner: false,
          granted: false,
          membershipRole: null,
          canManageGrant: true,
        },
      ],
    } as never);
    vi.mocked(api.PUT).mockResolvedValue({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 204 }),
    });
    renderWithProviders(<MemberEstates name="Casey Doe" userId="usr_1" />);
    const resident = await screen.findByRole("checkbox", { name: maple });
    expect(isDisabled(resident)).toBe(true);
    fireEvent.click(resident);
    expect(api.PUT).not.toHaveBeenCalled();
    expect(api.DELETE).not.toHaveBeenCalled();
    const other = screen.getByRole("checkbox", { name: oak });
    expect(isDisabled(other)).toBe(false);
    fireEvent.click(other);
    await waitFor(() =>
      expect(api.PUT).toHaveBeenCalledWith(path, {
        params: { path: { userId: "usr_1", estateId: "oak" } },
      })
    );
  });
});
