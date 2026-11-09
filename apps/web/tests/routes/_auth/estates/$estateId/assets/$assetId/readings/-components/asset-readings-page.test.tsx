import { fireEvent } from "@testing-library/react";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { ReadingSearch } from "@/lib/reading-filters";
import type { ReadingGroup } from "@/lib/readings";
import { AssetReadingsPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/asset-readings-page";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@/lib/reading-csv-download", () => ({
  completeReadingCsv: vi.fn(() => Promise.resolve(new Blob())),
  saveReadingCsv: vi.fn(),
}));
vi.mock(
  "@/components/forms/date-time-picker",
  () => import("@tests/date-picker-stubs")
);
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string | undefined>;
  }) => (
    <a
      href={
        to.replace("$assetId", params?.assetId ?? "$assetId") +
        (search?.assetId ? `?assetId=${search.assetId}` : "")
      }
    >
      {children}
    </a>
  ),
}));
vi.mock("@/lib/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assets")>()),
  useAsset: () => ({
    data: { id: "11111111-1111-4111-8111-111111111111", name: "Water pump" },
  }),
}));
const access = vi.hoisted(() => ({ canRecord: false }));
vi.mock("@/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access")>()),
  useAppAccess: () => ({
    data: {
      estates: [
        {
          estateId: "estate-id",
          canViewReadings: true,
          canRecordReadings: access.canRecord,
        },
      ],
    },
  }),
}));

const ASSET = "11111111-1111-4111-8111-111111111111";
const GROUPED = "/estates/{estateId}/assets/{assetId}/readings/grouped";
const ESTATE_READINGS = "/estates/{estateId}/readings";
const EXPORT = "/estates/{estateId}/readings/export";

type Query = Record<string, unknown>;

function group(
  measuredAt: string,
  metrics: ReadingGroup["metrics"]
): ReadingGroup {
  return {
    measuredAt,
    source: "SENSOR",
    deviceId: "d1",
    deviceIdentifier: "PUMP-01",
    metrics,
  };
}

const temperature = (value: number): ReadingGroup["metrics"][number] => ({
  readingId: `t-${value}`,
  metric: "TEMPERATURE",
  unit: "°C",
  value,
  flags: [],
});
const pressure = (value: number): ReadingGroup["metrics"][number] => ({
  readingId: `p-${value}`,
  metric: "PRESSURE",
  unit: "bar",
  value,
  flags: [],
});

let pages: Record<string, { groups: ReadingGroup[]; nextBefore?: string }>;

function groupedQueries(): Query[] {
  return (vi.mocked(api.GET).mock.calls as unknown[][])
    .filter(([path]) => path === GROUPED)
    .map(
      ([, options]) =>
        (options as { params: { query: Query } }).params.query ?? {}
    );
}

function renderPage(filters: ReadingSearch = {}) {
  const change = vi.fn();
  const view = renderWithProviders(
    <AssetReadingsPage
      assetId={ASSET}
      estateId="estate-id"
      filters={filters}
      onFiltersChange={change}
    />
  );
  return { change, view };
}

beforeEach(() => {
  access.canRecord = false;
  pages = {
    first: {
      groups: [
        group("2026-10-01T08:00:01Z", [temperature(21.5), pressure(2.15)]),
      ],
    },
  };
  vi.mocked(api.GET).mockReset();
  vi.mocked(api.GET).mockImplementation(((path: string, options: unknown) => {
    if (path === EXPORT) {
      return Promise.resolve({
        data: new ReadableStream(),
        response: new Response(),
      });
    }
    const query = (options as { params: { query?: Query } }).params.query ?? {};
    const page = pages[(query.before as string | undefined) ?? "first"];
    return Promise.resolve({
      data: page ?? { groups: [] },
      response: new Response(),
    });
  }) as never);
});

describe("AssetReadingsPage", () => {
  it("shows one row per timestamp from the grouped endpoint", async () => {
    renderPage();
    const table = await screen.findByRole("table", { name: "Readings" });
    // The day heading row, the column header row, and one group.
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    within(table).getByText("21.5");
    within(table).getByText("2.15");
    const calls = vi.mocked(api.GET).mock.calls as unknown[][];
    expect(calls.some(([path]) => path === ESTATE_READINGS)).toBe(false);
    expect(groupedQueries()[0]).toEqual({ limit: 50 });
    screen.getByText("Showing 1 time");
  });

  it("sends the date and metric filters", async () => {
    pages.first = { groups: [group("2026-10-01T08:00:01Z", [temperature(1)])] };
    renderPage({
      metric: "TEMPERATURE",
      from: "2026-10-01T00:00",
      to: "2026-10-02T00:00",
    });
    const table = await screen.findByRole("table", { name: "Readings" });
    expect(groupedQueries()[0]).toEqual({
      limit: 50,
      metric: ["TEMPERATURE"],
      from: new Date("2026-10-01T00:00").toISOString(),
      to: new Date("2026-10-02T00:00").toISOString(),
    });
    within(table).getByRole("columnheader", { name: "Temperature (°C)" });
    expect(
      within(table).queryByRole("columnheader", { name: "Pressure (bar)" })
    ).toBeNull();
  });

  it("shows only the filtered metric's column", async () => {
    renderPage({ metric: "TEMPERATURE" });
    const table = await screen.findByRole("table", { name: "Readings" });
    within(table).getByRole("columnheader", { name: "Temperature (°C)" });
    expect(
      within(table).queryByRole("columnheader", { name: "Pressure (bar)" })
    ).toBeNull();
  });

  it("maps Suspect only to the suspect flags", async () => {
    renderPage({ suspect: true });
    await screen.findByRole("table", { name: "Readings" });
    expect(groupedQueries()[0]?.flag).toEqual([
      "GAP",
      "DUPLICATE_TIMESTAMP",
      "OUT_OF_RANGE",
    ]);
  });

  it("maps Anomalous only to the anomaly flag", async () => {
    renderPage({ anomalous: true });
    await screen.findByRole("table", { name: "Readings" });
    expect(groupedQueries()[0]?.flag).toEqual(["ANOMALY"]);
  });

  it("combines both flag filters as match-any", async () => {
    renderPage({ suspect: true, anomalous: true });
    await screen.findByRole("table", { name: "Readings" });
    expect(groupedQueries()[0]?.flag).toEqual([
      "GAP",
      "DUPLICATE_TIMESTAMP",
      "OUT_OF_RANGE",
      "ANOMALY",
    ]);
  });

  it("ignores the URL's page", async () => {
    renderPage({ page: 3 });
    await screen.findByRole("table", { name: "Readings" });
    expect(groupedQueries()[0]).toEqual({ limit: 50 });
  });

  it("appends older groups with Load older, then hides it", async () => {
    pages.first = {
      groups: [group("2026-10-01T08:00:02Z", [temperature(30.5)])],
      nextBefore: "2026-10-01T08:00:02Z",
    };
    pages["2026-10-01T08:00:02Z"] = {
      groups: [group("2026-10-01T08:00:01Z", [temperature(29.5)])],
    };
    renderPage();
    const older = await screen.findByRole("button", { name: "Load older" });
    fireEvent.click(older);
    await screen.findByText("29.5");
    screen.getByText("30.5");
    expect(groupedQueries()[1]).toEqual({
      limit: 50,
      before: "2026-10-01T08:00:02Z",
    });
    screen.getByText("Showing 2 times");
    expect(screen.queryByRole("button", { name: "Load older" })).toBeNull();
  });

  it("hides Load older when there is no nextBefore", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Readings" });
    expect(screen.queryByRole("button", { name: "Load older" })).toBeNull();
  });

  it("starts from the first page again when a filter changes", async () => {
    pages.first = {
      groups: [group("2026-10-01T08:00:02Z", [temperature(30.5)])],
      nextBefore: "2026-10-01T08:00:02Z",
    };
    pages["2026-10-01T08:00:02Z"] = {
      groups: [group("2026-10-01T08:00:01Z", [temperature(29.5)])],
    };
    const { view } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Load older" }));
    await screen.findByText("29.5");
    view.rerender(
      <AssetReadingsPage
        assetId={ASSET}
        estateId="estate-id"
        filters={{ anomalous: true }}
        onFiltersChange={vi.fn()}
      />
    );
    await screen.findByText("Showing 1 time");
    expect(screen.queryByText("29.5")).toBeNull();
    expect(groupedQueries().at(-1)).toEqual({ limit: 50, flag: ["ANOMALY"] });
  });

  it("shows a loading state while the first page is slow", async () => {
    vi.mocked(api.GET).mockImplementation(
      (() => new Promise(() => undefined)) as never
    );
    renderPage({ suspect: true });
    await screen.findByText("Loading readings…");
    expect(groupedQueries()).toHaveLength(1);
  });

  it("says no readings yet when there are none and no filters", async () => {
    pages.first = { groups: [] };
    renderPage();
    await screen.findByText("No readings yet");
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull();
  });

  it("says no anomalous readings match, with Clear filters", async () => {
    pages.first = { groups: [] };
    const { change } = renderPage({ anomalous: true });
    await screen.findByText("No unusual readings match these filters");
    // The filter bar has its own Clear filters; the empty state's comes last.
    const clears = screen.getAllByRole("button", { name: "Clear filters" });
    fireEvent.click(clears.at(-1) as HTMLElement);
    expect(change).toHaveBeenCalledWith({});
  });

  it("says no readings match when other filters are set", async () => {
    pages.first = { groups: [] };
    renderPage({ metric: "PRESSURE" });
    await screen.findByText("No matching readings");
    expect(
      screen.getAllByRole("button", { name: "Clear filters" })
    ).toHaveLength(2);
  });

  it("shows an error with Retry readings", async () => {
    vi.mocked(api.GET).mockResolvedValue({
      error: { message: "Grouped failed" },
      response: new Response(null, { status: 500 }),
    } as never);
    renderPage();
    await screen.findByText("Grouped failed");
    fireEvent.click(screen.getByRole("button", { name: "Retry readings" }));
    await waitFor(() => expect(groupedQueries()).toHaveLength(2));
  });

  it("makes no request when the filters are invalid", async () => {
    renderPage({ from: "2026-10-02T00:00", to: "2026-10-01T00:00" });
    await screen.findByRole("alert");
    expect(groupedQueries()).toHaveLength(0);
  });

  it("exports CSV per reading with the same filters", async () => {
    renderPage({ metric: "TEMPERATURE", anomalous: true });
    await screen.findByRole("table", { name: "Readings" });
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() =>
      expect(
        (vi.mocked(api.GET).mock.calls as unknown[][]).some(
          ([path]) => path === EXPORT
        )
      ).toBe(true)
    );
    const call = (vi.mocked(api.GET).mock.calls as unknown[][]).find(
      ([path]) => path === EXPORT
    );
    const { query } = (call?.[1] as { params: { query: Query } } | undefined)
      ?.params ?? { query: {} as Query };
    expect(query.assetId).toBe(ASSET);
    expect(query.metric).toBe("TEMPERATURE");
    expect(query.flag).toEqual(["ANOMALY"]);
  });

  it("has no asset picker, since the asset is fixed", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Readings" });
    expect(screen.queryByText("All assets")).toBeNull();
  });

  it("offers no manual entry, even to a user who can record", async () => {
    access.canRecord = true;
    renderPage();
    await screen.findByRole("table", { name: "Readings" });
    expect(screen.queryByRole("link", { name: "Create" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Record reading" })).toBeNull();
  });

  it("filters by suspect only without carrying the asset into the URL", async () => {
    const { change } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Filters" }));
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Possibly wrong only" })
    );
    expect(change).toHaveBeenCalledWith({ suspect: true, page: undefined });
  });

  it("filters by anomalous only without carrying the asset into the URL", async () => {
    const { change } = renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Filters" }));
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Unusual readings only" })
    );
    expect(change).toHaveBeenCalledWith({ anomalous: true, page: undefined });
  });

  it("puts the summary, Filters and Export CSV in one toolbar", async () => {
    renderPage();
    const toolbar = await screen.findByRole("toolbar", {
      name: "Reading tools",
    });
    await within(toolbar).findByText("Showing 1 time");
    within(toolbar).getByRole("button", { name: "Filters" });
    within(toolbar).getByRole("button", { name: "Export CSV" });
  });

  it("collapses the filters behind the Filters toggle by default", async () => {
    renderPage();
    const toggle = await screen.findByRole("button", { name: "Filters" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(
      screen.queryByRole("search", { name: "Reading filters" })
    ).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const panel = await screen.findByRole("search", {
      name: "Reading filters",
    });
    expect(
      panel.closest(
        `#${CSS.escape(toggle.getAttribute("aria-controls") ?? "")}`
      )
    ).not.toBeNull();
    within(panel).getByRole("checkbox", { name: "Possibly wrong only" });
    expect(within(panel).queryByText("Filters")).toBeNull();
  });

  it("counts active filters and starts expanded when one is set", async () => {
    renderPage({ metric: "TEMPERATURE", suspect: true });
    const toggle = await screen.findByRole("button", {
      name: "Filters, 2 active",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const panel = await screen.findByRole("search", {
      name: "Reading filters",
    });
    within(panel).getByRole("button", { name: "Clear filters" });
  });
});
