import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { AssetCategoriesPage } from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page";

const EDIT_INTERVAL = /^Edit service interval/u;

const lighting = {
  code: "LIGHTING",
  label: "Lighting",
  failsSilently: true,
  isDefault: true,
  activeAssetCount: 12,
  lastChange: null,
  serviceInterval: { value: 1, unit: "YEAR" },
  lastIntervalChange: {
    interval: { value: 1, unit: "YEAR" },
    changedByUserId: "owner",
    changedByName: "Casey Doe",
    changedAt: "2026-10-01T04:00:00Z",
  },
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
  serviceInterval: { value: 6, unit: "MONTH" },
  lastIntervalChange: {
    interval: { value: 6, unit: "MONTH" },
    changedByUserId: "manager",
    changedByName: "Morgan Lee",
    changedAt: "2026-10-25T04:00:00Z",
  },
};
const lift = {
  code: "LIFT",
  label: "Lift",
  failsSilently: false,
  isDefault: true,
  activeAssetCount: 0,
  lastChange: null,
  serviceInterval: null,
  lastIntervalChange: null,
};

const state = vi.hoisted(() => ({
  data: undefined as unknown,
  error: null as Error | null,
  mutate: vi.fn(),
  pending: false,
  saveInterval: vi.fn(),
}));

beforeEach(() => {
  state.data = { estateActive: true, categories: [lighting, pump, lift] };
  state.error = null;
  state.mutate = vi.fn();
  state.pending = false;
  state.saveInterval = vi.fn(() => Promise.resolve());
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
vi.mock("@/lib/service-intervals", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/service-intervals")>()),
  useSetCategoryServiceInterval: () => ({ mutateAsync: state.saveInterval }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

function row(label: string) {
  return screen.getByRole("row", { name: new RegExp(`^${label}`, "u") });
}
function cells(label: string) {
  return within(row(label))
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

it("lists each category with its asset count, flag and last change", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  screen.getByRole("heading", { name: "Asset categories" });
  expect(cells("Lighting")).toEqual([
    "12",
    "",
    "Every 1 year",
    expect.stringContaining("Casey Doe"),
    "Edit interval",
  ]);
  expect(cells("Lift")).toEqual([
    "0",
    "",
    "Not set",
    "Default",
    "Edit interval",
  ]);
  expect(cells("Pump")[2]).toBe("Every 6 months");
  const flags = within(screen.getByRole("table")).getAllByRole("checkbox");
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
  for (const flag of within(screen.getByRole("table")).getAllByRole(
    "checkbox"
  )) {
    expect(flag.getAttribute("aria-disabled")).toBe("true");
  }
});

it("shows a load error", () => {
  state.data = undefined;
  state.error = new Error("Estate not found.");
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  expect(screen.getByRole("alert").textContent).toContain("Estate not found.");
});

it("shows the latest change to either the flag or the interval", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  expect(cells("Pump")[3]).toContain("Morgan Lee");
});

function filters() {
  return within(
    screen.getByRole("group", { name: "Filter by service interval" })
  );
}

function shownCategories() {
  return within(screen.getByRole("table"))
    .getAllByRole("rowheader")
    .map((header) => header.textContent);
}

function card(name: string) {
  return within(screen.getByRole("region", { name }));
}

it("summarises flags and intervals in cards", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  card("Fails silently").getByText("2");
  card("Fails silently").getByText("Categories flagged for spot checks");
  card("Missing service interval").getByText("1");
  card("Missing service interval").getByText(
    "1 of 3 categories need an interval"
  );
  card("Intervals set").getByText("2");
  card("Intervals set").getByText("1 in months · 1 in years");
});

it("shows the categories missing an interval from their card", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  fireEvent.click(
    card("Missing service interval").getByRole("button", {
      name: "Show these categories",
    })
  );
  expect(
    filters()
      .getByRole("button", { name: "Not set" })
      .getAttribute("aria-pressed")
  ).toBe("true");
  expect(shownCategories()).toEqual(["Lift"]);
});

it("reassures when every category has an interval", () => {
  state.data = { estateActive: true, categories: [lighting, pump] };
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  card("Missing service interval").getByText("0");
  card("Missing service interval").getByText("Every category has an interval.");
  expect(
    card("Missing service interval").queryByRole("button", {
      name: "Show these categories",
    })
  ).toBeNull();
});

it("says when no interval is set yet", () => {
  state.data = { estateActive: true, categories: [lift] };
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  card("Intervals set").getByText("0");
  card("Intervals set").getByText("None yet");
});

it("shows every category until a filter is chosen", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  const pressed = ["All", "Days", "Months", "Years", "Not set"].map((name) =>
    filters().getByRole("button", { name }).getAttribute("aria-pressed")
  );
  expect(pressed).toEqual(["true", "false", "false", "false", "false"]);
  expect(shownCategories()).toEqual(["Lighting", "Pump", "Lift"]);
});

it.each([
  ["Months", ["Pump"]],
  ["Years", ["Lighting"]],
  ["Not set", ["Lift"]],
])("filters to %s", (name, shown) => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  fireEvent.click(filters().getByRole("button", { name }));
  expect(
    filters().getByRole("button", { name }).getAttribute("aria-pressed")
  ).toBe("true");
  expect(
    filters().getByRole("button", { name: "All" }).getAttribute("aria-pressed")
  ).toBe("false");
  expect(shownCategories()).toEqual(shown);
});

it("says when a filter matches nothing, and All shows everything again", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  fireEvent.click(filters().getByRole("button", { name: "Days" }));
  screen.getByText("No categories match this filter.");
  expect(screen.queryByRole("table")).toBeNull();
  fireEvent.click(filters().getByRole("button", { name: "All" }));
  expect(shownCategories()).toEqual(["Lighting", "Pump", "Lift"]);
});

it("saves a category's interval from the dialog", async () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Edit service interval for Lift" })
  );
  const dialog = within(
    screen.getByRole("dialog", { name: "Service interval for Lift" })
  );
  fireEvent.change(dialog.getByRole("spinbutton", { name: "Every" }), {
    target: { value: "14" },
  });
  await chooseOption(dialog.getByRole("combobox", { name: "Unit" }), "Days");
  fireEvent.click(dialog.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(state.saveInterval).toHaveBeenCalledWith({
      category: "LIFT",
      interval: { value: 14, unit: "DAY" },
    })
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("clears a category's interval from the dialog", async () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Edit service interval for Pump" })
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  await waitFor(() =>
    expect(state.saveInterval).toHaveBeenCalledWith({
      category: "PUMP",
      interval: null,
    })
  );
});

it("locks the intervals of an inactive estate", () => {
  state.data = { estateActive: false, categories: [lighting, lift] };
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  for (const button of screen.getAllByRole("button", {
    name: EDIT_INTERVAL,
  })) {
    expect(button.hasAttribute("disabled")).toBe(true);
  }
});
