import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EstateSwitcher } from "@/components/estates/estate-switcher";
import { api } from "@/lib/api";
import { renderWithProviders, screen, waitFor } from "../../test-utils";

const { navigate, params } = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { estateId: undefined as string | undefined },
}));

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useParams: () => params,
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "viewer" }, loading: false }),
}));

const estate = (id: string, name: string) => ({
  id,
  name,
  code: name.toUpperCase(),
  address: "1 Grove Road",
  postalCode: "123456",
  createdAt: "2026-09-25T00:00:00Z",
  updatedAt: "2026-09-25T00:00:00Z",
  owned: false,
});

describe("EstateSwitcher", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    params.estateId = undefined;
    localStorage.clear();
    vi.mocked(api.GET).mockResolvedValue({
      data: [estate("maple", "Maple Grove"), estate("oak", "Oak Park")],
      response: new Response(),
    });
  });

  it("lists the user's active estates and opens the one chosen", async () => {
    renderWithProviders(<EstateSwitcher />);
    const select = await screen.findByRole("combobox", {
      name: "Current estate",
    });
    await screen.findByRole("option", { name: "Oak Park" });
    expect(api.GET).toHaveBeenCalledWith("/estates", {
      params: { query: { status: "ACTIVE" } },
    });

    fireEvent.change(select, { target: { value: "oak" } });

    expect(navigate).toHaveBeenCalledWith({
      to: "/estates/$estateId",
      params: { estateId: "oak" },
    });
    expect(localStorage.getItem("upkeep:current-estate")).toBe("oak");
  });

  it("shows the estate being viewed", async () => {
    params.estateId = "oak";
    renderWithProviders(<EstateSwitcher />);
    await screen.findByRole("option", { name: "Oak Park" });
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", {
        name: "Current estate",
      }).value
    ).toBe("oak");
  });

  it("remembers the last estate chosen, and ignores one no longer accessible", async () => {
    localStorage.setItem("upkeep:current-estate", "maple");
    const { unmount } = renderWithProviders(<EstateSwitcher />);
    await screen.findByRole("option", { name: "Oak Park" });
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLSelectElement>("combobox", {
          name: "Current estate",
        }).value
      ).toBe("maple")
    );
    unmount();

    localStorage.setItem("upkeep:current-estate", "revoked");
    renderWithProviders(<EstateSwitcher />);
    await screen.findByRole("option", { name: "Oak Park" });
    expect(
      screen.getByRole<HTMLSelectElement>("combobox", {
        name: "Current estate",
      }).value
    ).toBe("");
  });

  it("stays hidden when the user has no active estates", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      data: [],
      response: new Response(),
    });
    renderWithProviders(<EstateSwitcher />);
    await waitFor(() => expect(api.GET).toHaveBeenCalled());
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
