import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import {
  AssetCategoriesLayout,
  AssetCategoriesList,
  type IntervalFilter,
} from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page";

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
    refetch: vi.fn(),
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
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to
      )}
    >
      {children}
    </a>
  ),
}));

function AssetCategoriesPage({
  filter = "ALL",
}: {
  estateId?: string;
  filter?: IntervalFilter;
}) {
  return (
    <AssetCategoriesLayout estateId="oak">
      <AssetCategoriesList estateId="oak" filter={filter} />
    </AssetCategoriesLayout>
  );
}

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
  screen.getByRole("heading", { level: 1, name: "Asset categories" });
  expect(cells("Lighting")).toEqual([
    "12",
    "Fails silently",
    "Every 1 year",
    expect.stringContaining("Casey Doe"),
    "Edit intervalStop flagging",
  ]);
  expect(cells("Lift")).toEqual([
    "0",
    "No",
    "Not set",
    "Default",
    "Edit intervalFlag",
  ]);
  expect(cells("Pump")[2]).toBe("Every 6 months");
});

it("keeps rows in label order so they do not jump when a flag changes", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  expect(shownCategories()).toEqual(["Lift", "Lighting", "Pump"]);
});

it("has no inline form controls in the table", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  expect(within(screen.getByRole("table")).queryAllByRole("checkbox")).toEqual(
    []
  );
});

it("confirms before flagging a category", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Flag Lift as failing silently" })
  );
  expect(state.mutate).not.toHaveBeenCalled();
  const dialog = within(
    screen.getByRole("dialog", { name: "Flag Lift as failing silently?" })
  );
  fireEvent.click(dialog.getByRole("button", { name: "Flag category" }));
  expect(state.mutate).toHaveBeenCalledWith(
    { category: "LIFT", failsSilently: true },
    expect.anything()
  );
});

it("confirms before unflagging, and cancel changes nothing", async () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Stop flagging Lighting" })
  );
  const dialog = within(
    screen.getByRole("dialog", { name: "Stop flagging Lighting?" })
  );
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(state.mutate).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Stop flagging Lighting" })
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Stop flagging",
    })
  );
  expect(state.mutate).toHaveBeenLastCalledWith(
    { category: "LIGHTING", failsSilently: false },
    expect.anything()
  );
});

it("explains a failed flag change inside the dialog", () => {
  state.mutate = vi.fn((_input, options) =>
    options.onError(new Error("This estate is inactive."))
  );
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Flag Lift as failing silently" })
  );
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Flag category" }));
  expect(dialog.getByRole("alert").textContent).toContain(
    "This estate is inactive."
  );
  screen.getByRole("dialog", { name: "Flag Lift as failing silently?" });
});

it("closes the dialog once the flag is saved", async () => {
  state.mutate = vi.fn((_input, options) => options.onSuccess());
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Flag Lift as failing silently" })
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Flag category",
    })
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("locks the flags of an inactive estate", () => {
  state.data = { estateActive: false, categories: [lighting, lift] };
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  screen.getByText(
    "This estate is inactive, so its asset categories cannot be changed."
  );
  for (const name of [
    "Stop flagging Lighting",
    "Flag Lift as failing silently",
  ]) {
    expect(screen.getByRole("button", { name }).hasAttribute("disabled")).toBe(
      true
    );
  }
});

it("shows a load error with Retry", () => {
  state.data = undefined;
  state.error = new Error("Estate not found.");
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("Estate not found.");
  within(alert).getByRole("button", { name: "Retry" });
});

it("shows the latest change to either the flag or the interval", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  expect(cells("Pump")[3]).toContain("Morgan Lee");
});

function filters() {
  return within(
    screen.getByRole("navigation", { name: "Filter by service interval" })
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

it("links to the categories missing an interval from their card", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  expect(
    card("Missing service interval")
      .getByRole("link", { name: "Show these categories" })
      .getAttribute("href")
  ).toBe("/estates/oak/asset-categories/not-set");
});

it("reassures when every category has an interval", () => {
  state.data = { estateActive: true, categories: [lighting, pump] };
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  card("Missing service interval").getByText("0");
  card("Missing service interval").getByText("Every category has an interval.");
  expect(
    card("Missing service interval").queryByRole("link", {
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

it("links each service interval view as its own page", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  expect(
    filters()
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")])
  ).toEqual([
    ["All", "/estates/oak/asset-categories"],
    ["Days", "/estates/oak/asset-categories/days"],
    ["Months", "/estates/oak/asset-categories/months"],
    ["Years", "/estates/oak/asset-categories/years"],
    ["Not set", "/estates/oak/asset-categories/not-set"],
  ]);
  expect(screen.queryByRole("tablist")).toBeNull();
});

it("shows every category on All", () => {
  renderWithProviders(<AssetCategoriesPage estateId="oak" />);
  expect(shownCategories()).toEqual(["Lift", "Lighting", "Pump"]);
});

it.each([
  ["MONTH", ["Pump"]],
  ["YEAR", ["Lighting"]],
  ["NONE", ["Lift"]],
] as const)("filters to %s", (filter, shown) => {
  renderWithProviders(<AssetCategoriesPage filter={filter} />);
  expect(shownCategories()).toEqual(shown);
});

it("says when a filter matches nothing, linking back to All", () => {
  renderWithProviders(<AssetCategoriesPage filter="DAY" />);
  screen.getByText("No matching categories");
  expect(
    screen.getByRole("link", { name: "Clear filters" }).getAttribute("href")
  ).toBe("/estates/oak/asset-categories");
  expect(screen.queryByRole("table")).toBeNull();
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
