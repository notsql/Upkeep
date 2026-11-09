import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { CheckSchedulesLayout } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-layout/check-schedules-layout";
import { CheckSchedulesList } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-page/check-schedules-page";
import type { IntervalFilter } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/interval-filter";

const EDIT_INTERVAL = /^Change how often/u;

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

const toastSuccess = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
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
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  } & React.ComponentProps<"a">) => (
    <a
      {...rest}
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to
      )}
    >
      {children}
    </a>
  ),
}));

function CheckSchedulesPage({
  filter = "ALL",
}: {
  estateId?: string;
  filter?: IntervalFilter;
}) {
  return (
    <CheckSchedulesLayout estateId="oak">
      <CheckSchedulesList estateId="oak" filter={filter} />
    </CheckSchedulesLayout>
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
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  screen.getByRole("heading", { level: 1, name: "Check schedules" });
  screen.getByText(
    "Choose which equipment gets regular checks, and how often."
  );
  screen.getByText(
    "Turn on regular checks for equipment that can break without anyone noticing, like emergency lights."
  );
  const header = within(screen.getByRole("table")).getAllByRole("columnheader");
  expect(header.slice(0, 5).map((cell) => cell.textContent)).toEqual([
    "Equipment type",
    "Assets",
    "Regular checks",
    "How often",
    "Last changed",
  ]);
  expect(cells("Lighting")).toEqual([
    "12",
    "On",
    "Every 1 year",
    expect.stringContaining("Casey Doe"),
    "Change how oftenTurn off checks",
  ]);
  expect(cells("Lift")).toEqual([
    "0",
    "Off",
    "No schedule",
    "Never changed",
    "Change how oftenTurn on checks",
  ]);
  expect(cells("Pump")[2]).toBe("Every 6 months");
});

it("keeps rows in label order so they do not jump when a flag changes", () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  expect(shownCategories()).toEqual(["Lift", "Lighting", "Pump"]);
});

it("has no inline form controls in the table", () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  expect(within(screen.getByRole("table")).queryAllByRole("checkbox")).toEqual(
    []
  );
});

it("confirms before flagging a category", () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Turn on regular checks for Lift" })
  );
  expect(state.mutate).not.toHaveBeenCalled();
  const dialog = within(
    screen.getByRole("dialog", { name: "Turn on regular checks for Lift?" })
  );
  fireEvent.click(dialog.getByRole("button", { name: "Turn on" }));
  expect(state.mutate).toHaveBeenCalledWith(
    { category: "LIFT", failsSilently: true },
    expect.anything()
  );
});

it("confirms before unflagging, and cancel changes nothing", async () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Turn off regular checks for Lighting" })
  );
  const dialog = within(
    screen.getByRole("dialog", {
      name: "Turn off regular checks for Lighting?",
    })
  );
  fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(state.mutate).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Turn off regular checks for Lighting" })
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Turn off",
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
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Turn on regular checks for Lift" })
  );
  const dialog = within(screen.getByRole("dialog"));
  fireEvent.click(dialog.getByRole("button", { name: "Turn on" }));
  expect(dialog.getByRole("alert").textContent).toContain(
    "This estate is inactive."
  );
  screen.getByRole("dialog", { name: "Turn on regular checks for Lift?" });
});

it("closes the dialog once the flag is saved", async () => {
  state.mutate = vi.fn((_input, options) => options.onSuccess());
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Turn on regular checks for Lift" })
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Turn on",
    })
  );
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("locks the flags of an inactive estate", () => {
  state.data = { estateActive: false, categories: [lighting, lift] };
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  screen.getByText(
    "This estate is inactive, so its check schedules can't be changed."
  );
  for (const name of [
    "Turn off regular checks for Lighting",
    "Turn on regular checks for Lift",
  ]) {
    expect(screen.getByRole("button", { name }).hasAttribute("disabled")).toBe(
      true
    );
  }
});

it("shows a load error with Retry", () => {
  state.data = undefined;
  state.error = new Error("Estate not found.");
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  const alert = screen.getByRole("alert");
  expect(alert.textContent).toContain("Estate not found.");
  within(alert).getByRole("button", { name: "Retry" });
});

it("shows the latest change to either the flag or the interval", () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  expect(cells("Pump")[3]).toContain("Morgan Lee");
});

function filters() {
  return within(
    screen.getByRole("navigation", { name: "Filter by how often" })
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
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  card("Regular checks on").getByText("2");
  card("Regular checks on").getByText("Equipment types with regular checks");
  card("No schedule yet").getByText("1");
  card("No schedule yet").getByText("1 of 3 equipment types have no schedule");
  card("Schedule set").getByText("2");
  card("Schedule set").getByText("1 in months · 1 in years");
});

it("links to the categories missing an interval from their card", () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  expect(
    card("No schedule yet")
      .getByRole("link", { name: "Show these" })
      .getAttribute("href")
  ).toBe("/estates/oak/inspections/schedules/not-set");
});

it("renders the missing-interval link as an outline shadcn Button", () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  const link = card("No schedule yet").getByRole("link", {
    name: "Show these",
  });
  expect(link.dataset.slot).toBe("button");
});

it("reassures when every category has an interval", () => {
  state.data = { estateActive: true, categories: [lighting, pump] };
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  card("No schedule yet").getByText("0");
  card("No schedule yet").getByText("Every category has an interval.");
  expect(
    card("No schedule yet").queryByRole("link", {
      name: "Show these",
    })
  ).toBeNull();
});

it("says when no interval is set yet", () => {
  state.data = { estateActive: true, categories: [lift] };
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  card("Schedule set").getByText("0");
  card("Schedule set").getByText("None yet");
});

it("links each service interval view as its own page", () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  expect(
    filters()
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")])
  ).toEqual([
    ["All", "/estates/oak/inspections/schedules"],
    ["Every few days", "/estates/oak/inspections/schedules/days"],
    ["Every few months", "/estates/oak/inspections/schedules/months"],
    ["Every few years", "/estates/oak/inspections/schedules/years"],
    ["No schedule", "/estates/oak/inspections/schedules/not-set"],
  ]);
  expect(screen.queryByRole("tablist")).toBeNull();
});

it("shows every category on All", () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  expect(shownCategories()).toEqual(["Lift", "Lighting", "Pump"]);
});

it.each([
  ["MONTH", ["Pump"]],
  ["YEAR", ["Lighting"]],
  ["NONE", ["Lift"]],
] as const)("filters to %s", (filter, shown) => {
  renderWithProviders(<CheckSchedulesPage filter={filter} />);
  expect(shownCategories()).toEqual(shown);
});

it("says when a filter matches nothing, linking back to All", () => {
  renderWithProviders(<CheckSchedulesPage filter="DAY" />);
  screen.getByText("Nothing here");
  screen.getByText("No equipment is checked this often.");
  expect(
    screen.getByRole("link", { name: "Clear filters" }).getAttribute("href")
  ).toBe("/estates/oak/inspections/schedules");
  expect(screen.queryByRole("table")).toBeNull();
});

it("saves a category's interval from the dialog", async () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Change how often Lift is checked" })
  );
  const dialog = within(
    screen.getByRole("dialog", { name: "How often to service Lift" })
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
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Change how often Pump is checked" })
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
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  for (const button of screen.getAllByRole("button", {
    name: EDIT_INTERVAL,
  })) {
    expect(button.hasAttribute("disabled")).toBe(true);
  }
});

it("marks a category with regular checks on with a warning badge", () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  const badges = screen
    .getAllByText("On")
    .filter((element) => element.dataset.slot === "badge");
  expect(badges.length).toBeGreaterThan(0);
  for (const badge of badges) {
    expect(badge.dataset.variant).toBe("warning");
  }
});

it("shows the Inspection views beside the how-often filter", () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  const views = within(
    screen.getByRole("navigation", { name: "Inspection views" })
  );
  expect(
    views
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")])
  ).toEqual([
    ["Due checks", "/estates/oak/inspections"],
    ["Check schedules", "/estates/oak/inspections/schedules"],
  ]);
  screen.getByRole("navigation", { name: "Filter by how often" });
});

it("explains what turning checks on and off does", () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Turn on regular checks for Lift" })
  );
  within(screen.getByRole("dialog")).getByText(
    "Lift will show up on Due checks whenever it is due."
  );
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" })
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Turn off regular checks for Pump" })
  );
  within(screen.getByRole("dialog")).getByText(
    "Pump will no longer show up on Due checks."
  );
});

it("toasts Saved. after changing how often", async () => {
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  fireEvent.click(
    screen.getByRole("button", { name: "Change how often Pump is checked" })
  );
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Saved."));
});

it("says Loading check schedules… while loading", () => {
  state.data = undefined;
  renderWithProviders(<CheckSchedulesPage estateId="oak" />);
  screen.getByText("Loading check schedules…");
});
