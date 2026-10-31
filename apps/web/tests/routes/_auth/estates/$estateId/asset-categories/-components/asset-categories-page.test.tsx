import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { AssetCategoriesPage } from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page";

const lighting = {
  code: "LIGHTING",
  label: "Lighting",
  failsSilently: true,
  isDefault: true,
  activeAssetCount: 12,
  lastChange: null,
};
const pump = {
  code: "PUMP",
  label: "Pump",
  failsSilently: true,
  isDefault: false,
  activeAssetCount: 3,
  lastChange: {
    failsSilently: true,
    changedByUserId: "owner",
    changedByName: "Casey Doe",
    changedAt: "2026-10-20T04:00:00Z",
  },
};
const lift = {
  code: "LIFT",
  label: "Lift",
  failsSilently: false,
  isDefault: true,
  activeAssetCount: 0,
  lastChange: null,
};

const state = vi.hoisted(() => ({
  data: undefined as unknown,
  error: null as Error | null,
  mutate: vi.fn(),
  pending: false,
}));

beforeEach(() => {
  state.data = { estateActive: true, categories: [lighting, pump, lift] };
  state.error = null;
  state.mutate = vi.fn();
  state.pending = false;
});

vi.mock("@/lib/asset-categories", () => ({
  useEstateAssetCategories: () => ({
    data: state.data,
    error: state.error,
    isPending: !(state.data || state.error),
  }),
  useSetSilentFailure: () => ({
    mutate: state.mutate,
    isPending: state.pending,
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

function row(label: string) {
  return screen.getByRole("row", { name: new RegExp(`^${label}`) });
}
function cells(label: string) {
  return within(row(label))
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

it("lists each category with its asset count, flag and last change", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  screen.getByRole("heading", { name: "Asset categories" });
  screen.getByText("2 categories flagged as failing silently");
  expect(cells("Lighting")).toEqual(["12", "", "Default"]);
  expect(cells("Lift")).toEqual(["0", "", "Default"]);
  expect(cells("Pump")[2]).toContain("Casey Doe");
  const flags = screen.getAllByRole("checkbox");
  expect(flags.map((flag) => flag.getAttribute("aria-checked"))).toEqual([
    "true",
    "true",
    "false",
  ]);
  screen.getByRole("checkbox", { name: "Lighting fails silently" });
});

it("saves a ticked or unticked flag", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Lift fails silently" })
  );
  expect(state.mutate).toHaveBeenCalledWith(
    { category: "LIFT", failsSilently: true },
    expect.anything()
  );
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Lighting fails silently" })
  );
  expect(state.mutate).toHaveBeenLastCalledWith(
    { category: "LIGHTING", failsSilently: false },
    expect.anything()
  );
});

it("explains a failed save and keeps the saved flag", () => {
  state.mutate = vi.fn((_input, options) =>
    options.onError(new Error("This estate is inactive."))
  );
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  const flag = screen.getByRole("checkbox", { name: "Lift fails silently" });
  fireEvent.click(flag);
  expect(screen.getByRole("alert").textContent).toContain(
    "This estate is inactive."
  );
  expect(flag.getAttribute("aria-checked")).toBe("false");
});

it("locks the flags of an inactive estate", () => {
  state.data = { estateActive: false, categories: [lighting, lift] };
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  screen.getByText(
    "This estate is inactive, so its asset categories cannot be changed."
  );
  for (const flag of screen.getAllByRole("checkbox")) {
    expect(flag.getAttribute("aria-disabled")).toBe("true");
  }
});

it("shows a load error", () => {
  state.data = undefined;
  state.error = new Error("Estate not found.");
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  expect(screen.getByRole("alert").textContent).toContain("Estate not found.");
});
