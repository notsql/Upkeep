import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { ReadingSearch } from "@/lib/reading-filters";
import { EstateReadingsPage } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page";

const { get, permission } = vi.hoisted(() => ({
  get: vi.fn(),
  permission: { canRead: true, canRecord: true },
}));
vi.mock("@/lib/api", () => ({ api: { GET: get } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "crew" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/lib/access", () => ({
  useAppAccess: () => ({
    data: {
      estates: [
        {
          estateId: "estate",
          estateName: "Maple Estate",
          canViewReadings: permission.canRead,
          canRecordReadings: permission.canRecord,
          canViewAssets: false,
        },
      ],
    },
  }),
}));

const SENSOR_ROW = /SENSOR-001/;
const FILTER_ASSET = /Filter by asset/;
const RETIRED_PUMP = /PUMP-001.*Retired/;
const ASSET = "b6d6fe0d-32c5-4c77-a034-81aac211dfaa";
const READINGS = "/estates/{estateId}/readings";
const OPTIONS = "/estates/{estateId}/readings/assets";
const reading = {
  id: "reading-1",
  assetId: ASSET,
  assetReference: "PUMP-001",
  assetName: "Water pump",
  measuredAt: "2026-10-01T08:00:00Z",
  metric: "TEMPERATURE",
  value: 151,
  valueText: undefined as string | undefined,
  unit: "°C",
  deviceId: "device",
  deviceIdentifier: "SENSOR-001",
  source: "SENSOR",
  recordedAt: "2026-10-01T08:00:01Z",
  recordedByUserId: null,
  recordedByName: null,
  flags: [{ type: "OUT_OF_RANGE", validMin: -40, validMax: 150 }],
};
let page: {
  items: (Omit<
    typeof reading,
    "deviceId" | "deviceIdentifier" | "recordedByUserId" | "recordedByName"
  > & {
    deviceId: string | null;
    deviceIdentifier: string | null;
    recordedByUserId: string | null;
    recordedByName: string | null;
  })[];
  page: number;
  size: number;
  totalItems: number;
};
let options: {
  items: { id: string; name: string; reference: string; retired: boolean }[];
  page: number;
  size: number;
  totalItems: number;
};
let fail: boolean;

function show(filters: ReadingSearch = {}) {
  const change = vi.fn();
  renderWithProviders(
    <EstateReadingsPage
      estateId="estate"
      filters={filters}
      onFiltersChange={change}
    />
  );
  return change;
}

beforeEach(() => {
  vi.resetAllMocks();
  permission.canRead = true;
  permission.canRecord = true;
  fail = false;
  page = { items: [reading], page: 0, size: 50, totalItems: 1 };
  options = {
    items: [
      { id: ASSET, name: "Water pump", reference: "PUMP-001", retired: true },
    ],
    page: 0,
    size: 50,
    totalItems: 1,
  };
  get.mockImplementation(((path: string) => {
    if (path === READINGS && fail) {
      return Promise.resolve({
        error: { message: "Readings temporarily unavailable" },
        response: new Response(null, { status: 503 }),
      });
    }
    let data: unknown;
    if (path === READINGS) {
      data = page;
    }
    if (path === OPTIONS) {
      data = options;
    }
    return Promise.resolve({ data, response: new Response() });
  }) as never);
});

describe("estate reading browser", () => {
  it("shows manual provenance and the entry action without inventing a device", async () => {
    page.items = [
      {
        ...reading,
        source: "MANUAL",
        deviceId: null,
        deviceIdentifier: null,
        recordedByUserId: "crew",
        recordedByName: "Alex Technician",
      },
    ];
    show({ assetId: ASSET, metric: "TEMPERATURE" });
    const table = await screen.findByRole("table", { name: "Readings" });
    within(table).getByRole("columnheader", { name: "Source" });
    within(table).getByText("Manual");
    within(table).getByText("Alex Technician");
    expect(within(table).queryByText("SENSOR-001")).toBeNull();
    screen.getByRole("link", { name: "Record manual reading" });
  });

  it("shows Sensor labels and hides recording when only historical reads are allowed", async () => {
    permission.canRecord = false;
    show();
    const table = await screen.findByRole("table", { name: "Readings" });
    within(table).getByText("Sensor");
    expect(
      screen.queryByRole("link", { name: "Record manual reading" })
    ).toBeNull();
  });

  it("hides cached readings as soon as access context revokes permission", async () => {
    const change = vi.fn();
    const view = renderWithProviders(
      <EstateReadingsPage
        estateId="estate"
        filters={{}}
        onFiltersChange={change}
      />
    );
    await screen.findByRole("table", { name: "Readings" });
    permission.canRead = false;
    view.rerender(
      <EstateReadingsPage
        estateId="estate"
        filters={{}}
        onFiltersChange={change}
      />
    );
    await screen.findByText("Readings access is no longer available.");
    expect(screen.queryByRole("table", { name: "Readings" })).toBeNull();
  });
  it("shows asset labels, measurements and flags without fetching the owner-only asset register", async () => {
    show();
    const table = await screen.findByRole("table", { name: "Readings" });
    const row = within(table).getByRole("row", { name: SENSOR_ROW });
    within(row).getByText("PUMP-001");
    within(row).getByText("Water pump");
    within(row).getByText("151 °C");
    within(row).getByText("Out of range (valid -40 to 150 °C)");
    expect(
      get.mock.calls.every(([path]) => path === READINGS || path === OPTIONS)
    ).toBe(true);
    expect(screen.queryByRole("link", { name: "Water pump" })).toBeNull();
  });

  it("combines URL asset, metric, time, suspect and page filters in the server request", async () => {
    show({
      assetId: ASSET,
      metric: "TEMPERATURE",
      from: "2026-10-01T10:00",
      to: "2026-10-02T10:00",
      suspect: true,
      page: 2,
    });
    await screen.findByRole("table", { name: "Readings" });
    expect(api.GET).toHaveBeenCalledWith(READINGS, {
      params: {
        path: { estateId: "estate" },
        query: {
          assetId: ASSET,
          metric: "TEMPERATURE",
          from: new Date("2026-10-01T10:00").toISOString(),
          to: new Date("2026-10-02T10:00").toISOString(),
          page: 2,
          size: 50,
          flag: ["GAP", "DUPLICATE_TIMESTAMP", "OUT_OF_RANGE"],
        },
      },
    });
  });

  it("selects a searched retired asset and resets pagination", async () => {
    const change = show({ page: 3, metric: "TEMPERATURE" });
    await screen.findByRole("table", { name: "Readings" });
    fireEvent.click(screen.getByRole("button", { name: FILTER_ASSET }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Search assets" }),
      { target: { value: "pump" } }
    );
    await waitFor(() =>
      expect(
        get.mock.calls.some(
          ([path, request]) =>
            path === OPTIONS &&
            request?.params?.query &&
            "search" in request.params.query &&
            request.params.query.search === "pump"
        )
      ).toBe(true)
    );
    fireEvent.click(await screen.findByRole("button", { name: RETIRED_PUMP }));
    expect(change).toHaveBeenLastCalledWith({
      metric: "TEMPERATURE",
      page: undefined,
      assetId: ASSET,
    });
  });

  it("resets to the first page on metric changes and can clear all filters", async () => {
    const change = show({ assetId: ASSET, metric: "TEMPERATURE", page: 4 });
    await screen.findByRole("table", { name: "Readings" });
    await chooseOption(
      screen.getByRole("combobox", { name: "Metric" }),
      "Pressure"
    );
    expect(change).toHaveBeenLastCalledWith({
      assetId: ASSET,
      metric: "PRESSURE",
      page: undefined,
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(change).toHaveBeenLastCalledWith({});
  });

  it("pages with the active filters", async () => {
    page.totalItems = 101;
    const change = show({ assetId: ASSET, page: 1 });
    await screen.findByRole("table", { name: "Readings" });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(change).toHaveBeenLastCalledWith({ assetId: ASSET, page: 2 });
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(change).toHaveBeenLastCalledWith({
      assetId: ASSET,
      page: undefined,
    });
  });

  it("jumps to numbered pages while keeping the active filters", async () => {
    page.totalItems = 200;
    const change = show({ assetId: ASSET, metric: "TEMPERATURE", page: 1 });
    const navigation = await screen.findByRole("navigation", {
      name: "Pagination",
    });
    const current = within(navigation).getByRole("button", {
      name: "Go to page 2",
    });
    expect(current.getAttribute("aria-current")).toBe("page");
    for (const number of [1, 2, 3, 4]) {
      within(navigation).getByRole("button", { name: `Go to page ${number}` });
    }
    fireEvent.click(
      within(navigation).getByRole("button", { name: "Go to page 4" })
    );
    expect(change).toHaveBeenLastCalledWith({
      assetId: ASSET,
      metric: "TEMPERATURE",
      page: 3,
    });
    fireEvent.click(
      within(navigation).getByRole("button", { name: "Go to page 1" })
    );
    expect(change).toHaveBeenLastCalledWith({
      assetId: ASSET,
      metric: "TEMPERATURE",
      page: undefined,
    });
  });

  it.each([
    { selected: 0, visible: [1, 2, 3, 4, 100], omitted: 50, gaps: 1 },
    { selected: 49, visible: [1, 49, 50, 51, 100], omitted: 2, gaps: 2 },
    { selected: 99, visible: [1, 97, 98, 99, 100], omitted: 50, gaps: 1 },
  ])(
    "bounds numbered controls near page $selected with ellipses",
    async ({ selected, visible, omitted, gaps }) => {
      page.totalItems = 5000;
      show({ page: selected });
      const navigation = await screen.findByRole("navigation", {
        name: "Pagination",
      });
      for (const number of visible) {
        within(navigation).getByRole("button", {
          name: `Go to page ${number}`,
        });
      }
      expect(
        within(navigation).queryByRole("button", {
          name: `Go to page ${omitted}`,
        })
      ).toBeNull();
      expect(within(navigation).getAllByText("…")).toHaveLength(gaps);
      expect(
        within(navigation)
          .getByRole("button", { name: "Previous page" })
          .hasAttribute("disabled")
      ).toBe(selected === 0);
      expect(
        within(navigation)
          .getByRole("button", { name: "Next page" })
          .hasAttribute("disabled")
      ).toBe(selected === 99);
    }
  );

  it("disables all page navigation while retaining placeholder rows", async () => {
    page.totalItems = 200;
    const change = vi.fn();
    const view = renderWithProviders(
      <EstateReadingsPage
        estateId="estate"
        filters={{}}
        onFiltersChange={change}
      />
    );
    await screen.findByRole("table", { name: "Readings" });
    get.mockImplementation(
      () =>
        new Promise(() => {
          // Keep the next response pending to verify placeholder navigation.
        })
    );
    view.rerender(
      <EstateReadingsPage
        estateId="estate"
        filters={{ page: 1 }}
        onFiltersChange={change}
      />
    );
    await screen.findByText("Refreshing readings…");
    const navigation = screen.getByRole("navigation", { name: "Pagination" });
    expect(
      within(navigation)
        .getByRole("button", { name: "Go to page 4" })
        .hasAttribute("disabled")
    ).toBe(true);
    for (const button of within(navigation).getAllByRole("button")) {
      expect(button.hasAttribute("disabled")).toBe(true);
      fireEvent.click(button);
    }
    expect(change).not.toHaveBeenCalled();
    screen.getByRole("table", { name: "Readings" });
  });

  it("shows a single current page with no ellipses for one-page results", async () => {
    show();
    const navigation = await screen.findByRole("navigation", {
      name: "Pagination",
    });
    expect(
      within(navigation)
        .getByRole("button", { name: "Go to page 1" })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(within(navigation).queryByText("…")).toBeNull();
    expect(within(navigation).getAllByRole("button")).toHaveLength(3);
    expect(
      within(navigation)
        .getByRole("button", { name: "Previous page" })
        .hasAttribute("disabled")
    ).toBe(true);
    expect(
      within(navigation)
        .getByRole("button", { name: "Next page" })
        .hasAttribute("disabled")
    ).toBe(true);
  });

  it.each([
    { filters: {}, assets: 1, message: "No readings yet" },
    { filters: {}, assets: 0, message: "No assets yet" },
    {
      filters: { metric: "PRESSURE" },
      assets: 1,
      message: "No readings match these filters",
    },
    {
      filters: { suspect: true },
      assets: 1,
      message: "No suspect readings match",
    },
  ])(
    "distinguishes empty states: $message",
    async ({ filters, assets, message }) => {
      page = { ...page, items: [], totalItems: 0 };
      options = {
        ...options,
        items: assets ? options.items : [],
        totalItems: assets,
      };
      show(filters);
      await screen.findByText(message);
    }
  );

  it("offers page-one recovery when a bookmarked page is beyond the results", async () => {
    page = { ...page, items: [], totalItems: 1 };
    const change = show({ page: 7 });
    fireEvent.click(
      await screen.findByRole("button", { name: "Go to first page" })
    );
    expect(change).toHaveBeenLastCalledWith({ page: undefined });
    expect(screen.queryByText("No readings yet")).toBeNull();
  });

  it("explains an invalid range without making a reading request", async () => {
    show({ from: "2026-10-02T10:00", to: "2026-10-01T10:00" });
    await screen.findByText("Start time must be before end time.");
    expect(get.mock.calls.some(([path]) => path === READINGS)).toBe(false);
  });

  it("retries a failed request and then displays readings", async () => {
    fail = true;
    show();
    await screen.findByText("Readings temporarily unavailable");
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry readings" }));
    await screen.findByRole("table", { name: "Readings" });
  });
});

it.each([false, true])(
  "displays exact decimal text on readings screens (mobile=%s)",
  async (mobile) => {
    const original = window.matchMedia;
    const media = vi
      .spyOn(window, "matchMedia")
      .mockImplementation((query) => ({
        ...original(query),
        matches: mobile && query === "(max-width: 767px)",
      }));
    page.items = [
      {
        ...reading,
        value: 999_999_999_999.1234,
        valueText: "999999999999.123456",
      },
    ];
    show();
    await screen.findByText("999999999999.123456 °C");
    expect(screen.queryByText("999999999999.1234 °C")).toBeNull();
    media.mockRestore();
  }
);

it("shows mobile reading records with provenance and flags, retaining filter-aware numbered paging", async () => {
  const original = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    ...original(query),
    matches: query === "(max-width: 767px)",
  }));
  page.items = [
    {
      ...reading,
      source: "MANUAL",
      deviceId: null,
      deviceIdentifier: null,
      recordedByUserId: "crew",
      recordedByName: "Alex Technician",
    },
    { ...reading, id: "sensor-2" },
  ];
  page.totalItems = 151;
  const change = show({ assetId: ASSET, metric: "TEMPERATURE" });
  const records = within(await screen.findByRole("list", { name: "Readings" }));
  expect(records.getAllByRole("listitem")).toHaveLength(2);
  const manual = within(records.getAllByRole("listitem")[0]);
  manual.getByText("151 °C");
  manual.getByText("Water pump");
  manual.getByText("PUMP-001");
  manual.getByText("Manual");
  manual.getByText("Alex Technician");
  manual.getByText("Out of range (valid -40 to 150 °C)");
  expect(manual.queryByText("SENSOR-001")).toBeNull();
  within(records.getAllByRole("listitem")[1]).getByText("SENSOR-001");
  expect(screen.queryByRole("table", { name: "Readings" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Go to page 3" }));
  expect(change).toHaveBeenLastCalledWith({
    assetId: ASSET,
    metric: "TEMPERATURE",
    page: 2,
  });
});
