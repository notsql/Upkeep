import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EstateSwitcher } from "@/components/estates/estate-switcher";
import { api } from "@/lib/api";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
} from "../../test-utils";

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
    expect(api.GET).toHaveBeenCalledWith("/estates", {
      params: { query: { status: "ACTIVE" } },
    });
    await chooseOption(select, "Oak Park");

    expect(navigate).toHaveBeenCalledWith({
      to: "/estates/$estateId",
      params: { estateId: "oak" },
    });
    expect(localStorage.getItem("upkeep:current-estate")).toBe("oak");
    fireEvent.click(select);
    await screen.findByRole("option", { name: "Maple Grove" });
  });

  it("shows the estate being viewed", async () => {
    params.estateId = "oak";
    renderWithProviders(<EstateSwitcher />);
    const select = await screen.findByRole("combobox", {
      name: "Current estate",
    });
    expect(select.textContent).toContain("Oak Park");
    expect(select.textContent).not.toContain("Maple Grove");
  });

  it("remembers the last estate chosen, and ignores one no longer accessible", async () => {
    localStorage.setItem("upkeep:current-estate", "maple");
    const { unmount } = renderWithProviders(<EstateSwitcher />);
    const remembered = await screen.findByRole("combobox", {
      name: "Current estate",
    });
    await waitFor(() =>
      expect(remembered.textContent).toContain("Maple Grove")
    );
    expect(remembered.textContent).not.toContain("Oak Park");
    unmount();

    localStorage.setItem("upkeep:current-estate", "revoked");
    renderWithProviders(<EstateSwitcher />);
    const revoked = await screen.findByRole("combobox", {
      name: "Current estate",
    });
    expect(revoked.textContent).toContain("Choose an estate");
    expect(revoked.textContent).not.toContain("Maple Grove");
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
