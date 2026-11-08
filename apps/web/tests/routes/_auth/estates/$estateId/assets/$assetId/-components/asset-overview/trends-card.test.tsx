import { act, fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/format";
import type { ReadingSeries } from "@/lib/readings";
import { TrendsCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/trends-card";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const ASSET = "11111111-1111-4111-8111-111111111111";
const SERIES_PATH = "/estates/{estateId}/assets/{assetId}/readings/series";
const PRESSURE_SUMMARY =
  /Latest 2\.75 bar\. Minimum 2\.50 bar, maximum 2\.75 bar\./u;
const NO_ANOMALIES = /No anomalies\./u;
const UPDATED = /^Updated /u;
const ANOMALY_TEXT = /anomal/u;
const IN_RANGE = /in range$/u;
const COVERAGE = /^Readings cover 2 secs? of the last 1 minute$/u;

function point(start: string, value: number) {
  return { start, min: value, max: value, avg: value, count: 1 };
}

function fixture(): ReadingSeries {
  return {
    from: "2026-11-07T12:58:12Z",
    to: "2026-11-07T12:59:12Z",
    bucketSeconds: 1,
    anomalyThreshold: 0.6,
    metrics: [
      {
        metric: "TEMPERATURE",
        unit: "°C",
        points: [
          point("2026-11-07T12:59:10Z", 68.4),
          point("2026-11-07T12:59:11Z", 70.12),
        ],
      },
      {
        metric: "PRESSURE",
        unit: "bar",
        points: [
          point("2026-11-07T12:59:10Z", 2.5),
          point("2026-11-07T12:59:11Z", 2.75),
        ],
      },
    ],
    anomalies: [
      { start: "2026-11-07T12:59:09Z", maxScore: 0.55, abnormalCount: 0 },
      { start: "2026-11-07T12:59:10Z", maxScore: 0.7, abnormalCount: 1 },
      { start: "2026-11-07T12:59:11Z", maxScore: 0.88, abnormalCount: 1 },
    ],
  };
}

let series: ReadingSeries;
let failing: boolean;
let pending: boolean;

function serve() {
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    if (pending) {
      return new Promise(() => undefined);
    }
    if (failing) {
      return Promise.resolve({
        error: { message: "Series failed" },
        response: new Response(null, { status: 500 }),
      });
    }
    return Promise.resolve({
      data: path === SERIES_PATH ? series : undefined,
      response: new Response(),
    });
  }) as never);
}

function seriesCalls(): { from: string; to: string }[] {
  return (vi.mocked(api.GET).mock.calls as unknown[][])
    .filter(([path]) => path === SERIES_PATH)
    .map(
      ([, init]) =>
        (init as { params: { query: { from: string; to: string } } }).params
          .query
    );
}

function card() {
  return renderWithProviders(<TrendsCard assetId={ASSET} estateId="estate" />);
}

function rangeSelect(): HTMLElement {
  return screen.getByRole("combobox", { name: "Range" });
}

async function chooseRange(name: string): Promise<void> {
  await chooseOption(rangeSelect(), name);
}

function tiles(): HTMLElement[] {
  return within(screen.getByRole("group", { name: "Metric" })).getAllByRole(
    "button"
  );
}

function tile(name: RegExp): HTMLElement {
  return within(screen.getByRole("group", { name: "Metric" })).getByRole(
    "button",
    { name }
  );
}

function refreshButton(): HTMLElement {
  return screen.getByRole("button", { name: "Refresh trends" });
}

const TEMPERATURE_TILE = /^Temperature,/u;
const PRESSURE_TILE = /^Pressure,/u;

function liveSwitch(): HTMLElement {
  return screen.getByRole("switch", { name: "Live" });
}

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  series = fixture();
  failing = false;
  pending = false;
  serve();
});

afterEach(() => {
  vi.useRealTimers();
});

const RANGE_NAMES = [
  "Last 1 minute",
  "Last 15 minutes",
  "Last hour",
  "Last 24 hours",
];

describe("TrendsCard ranges", () => {
  it("offers exactly four ranges in a Select, with Last 1 minute chosen", async () => {
    card();
    expect(rangeSelect().textContent).toContain("Last 1 minute");
    fireEvent.click(rangeSelect());
    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(RANGE_NAMES);
    await screen.findByRole("figure");
  });

  it("requests a window that matches each range", async () => {
    card();
    await screen.findByRole("figure");
    const spans: Record<string, number> = {
      "Last 15 minutes": 15 * 60_000,
      "Last hour": 3_600_000,
      "Last 24 hours": 86_400_000,
    };
    const [first] = seriesCalls();
    expect(Date.parse(first.to) - Date.parse(first.from)).toBe(60_000);
    for (const [name, span] of Object.entries(spans)) {
      const before = seriesCalls().length;
      // biome-ignore lint/performance/noAwaitInLoops: each range is chosen in turn.
      await chooseRange(name);
      await waitFor(() => expect(seriesCalls().length).toBe(before + 1));
      const last = seriesCalls().at(-1);
      expect(Date.parse(last?.to ?? "") - Date.parse(last?.from ?? "")).toBe(
        span
      );
    }
  });
});

describe("TrendsCard tiles", () => {
  it("shows one tile per metric, in order, with value and change", async () => {
    card();
    await screen.findByRole("figure");
    const since = formatTime("2026-11-07T12:59:10Z");
    expect(tiles().map((item) => item.getAttribute("aria-label"))).toEqual([
      `Temperature, 70.1°C, up 2.5% since ${since}`,
      `Pressure, 2.75 bar, up 10.0% since ${since}`,
    ]);
    within(tiles()[1]).getByText("Pressure");
    within(tiles()[1]).getByText("2.75 bar");
    within(tiles()[1]).getByText("+10.0%");
  });

  it("says no change is available from a single point", async () => {
    series.metrics[1].points = [point("2026-11-07T12:59:11Z", 2.75)];
    card();
    await screen.findByRole("figure");
    expect(tile(PRESSURE_TILE).getAttribute("aria-label")).toBe(
      "Pressure, 2.75 bar, no change available"
    );
    within(tile(PRESSURE_TILE)).getByLabelText("No change available");
  });

  it("shows the anomaly count once, not on each tile", async () => {
    card();
    await screen.findByRole("figure");
    expect(screen.getAllByText("1 anomaly in range")).toHaveLength(1);
    for (const item of tiles()) {
      expect(within(item).queryByText(ANOMALY_TEXT)).toBeNull();
    }
  });

  it("selects the first metric by default", async () => {
    card();
    await screen.findByRole("figure");
    expect(tile(TEMPERATURE_TILE).getAttribute("aria-pressed")).toBe("true");
    expect(tile(PRESSURE_TILE).getAttribute("aria-pressed")).toBe("false");
  });

  it("selects a tile on click and never deselects", async () => {
    card();
    await screen.findByRole("figure");
    fireEvent.click(tile(PRESSURE_TILE));
    expect(tile(PRESSURE_TILE).getAttribute("aria-pressed")).toBe("true");
    expect(tile(TEMPERATURE_TILE).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(tile(PRESSURE_TILE));
    expect(tile(PRESSURE_TILE).getAttribute("aria-pressed")).toBe("true");
  });

  it("moves between tiles with the arrow keys", async () => {
    card();
    await screen.findByRole("figure");
    act(() => tile(TEMPERATURE_TILE).focus());
    fireEvent.keyDown(tile(TEMPERATURE_TILE), { key: "ArrowRight" });
    await waitFor(() =>
      expect(document.activeElement).toBe(tile(PRESSURE_TILE))
    );
  });

  it("describes every tile with its metric's summary", async () => {
    card();
    await screen.findByRole("figure");
    const id = tile(PRESSURE_TILE).getAttribute("aria-describedby") ?? "";
    expect(document.querySelector(`[id="${id}"]`)?.textContent).toMatch(
      PRESSURE_SUMMARY
    );
  });

  it("selects the first metric again when the selected one disappears", async () => {
    card();
    await screen.findByRole("figure");
    fireEvent.click(tile(PRESSURE_TILE));
    series = { ...fixture(), metrics: [fixture().metrics[0]] };
    fireEvent.click(refreshButton());
    await waitFor(() => expect(tiles()).toHaveLength(1));
    expect(tile(TEMPERATURE_TILE).getAttribute("aria-pressed")).toBe("true");
    screen.getByRole("figure", { name: "Temperature (°C), last 1 minute" });
  });
});

describe("TrendsCard chart", () => {
  it("draws one figure whose caption follows the selected tile", async () => {
    card();
    await screen.findByRole("figure", {
      name: "Temperature (°C), last 1 minute",
    });
    expect(screen.getAllByRole("figure")).toHaveLength(1);
    fireEvent.click(tile(PRESSURE_TILE));
    const figure = screen.getByRole("figure", {
      name: "Pressure (bar), last 1 minute",
    });
    within(figure).getByText(PRESSURE_SUMMARY);
  });

  it("summarises anomaly periods using the API's threshold", async () => {
    card();
    const figure = await screen.findByRole("figure", {
      name: "Temperature (°C), last 1 minute",
    });
    const from = formatTime("2026-11-07T12:59:10Z");
    const to = formatTime("2026-11-07T12:59:12Z");
    within(figure).getByText(
      `Anomaly from ${from} to ${to}, maximum score 0.88.`,
      { exact: false }
    );
    within(figure).getByText("Anomaly · 1 period, max 0.88");
    within(figure).getByText("score ≥ 0.60", { exact: false });
  });

  it("says when no period is anomalous", async () => {
    series.anomalies = [];
    card();
    const figure = await screen.findByRole("figure", {
      name: "Temperature (°C), last 1 minute",
    });
    within(figure).getByText(NO_ANOMALIES);
    expect(screen.queryByText(IN_RANGE)).toBeNull();
  });

  it("notes when readings cover little of the range", async () => {
    card();
    await screen.findByRole("figure");
    screen.getByText(COVERAGE);
  });

  it("links to the readings table instead of showing one in place", async () => {
    card();
    await screen.findByRole("figure");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show as table" })).toBeNull();
    expect(
      screen.getByRole("link", { name: "View as table" }).getAttribute("href")
    ).toBe("/estates/$estateId/assets/$assetId/readings");
    expect(
      screen.queryByRole("link", { name: "View all readings" })
    ).toBeNull();
  });
});

describe("TrendsCard layout", () => {
  it("is an unboxed region with no spelled-out heading", async () => {
    card();
    const region = await screen.findByRole("region", { name: "Trends" });
    expect(region.closest("[data-slot='card']")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Trends" })).toBeNull();
    expect(
      screen.queryByText(
        "Device readings over time, with anomalies the model found."
      )
    ).toBeNull();
  });
});

describe("TrendsCard states", () => {
  it("shows a loading state with usable controls", () => {
    pending = true;
    card();
    screen.getByRole("status", { name: "Loading trends…" });
    rangeSelect();
    refreshButton();
  });

  it("shows an error with Retry trends", async () => {
    failing = true;
    card();
    await screen.findByText("Series failed");
    screen.getByRole("button", { name: "Retry trends" });
    rangeSelect();
  });

  it("names the range when it is empty", async () => {
    series = { ...fixture(), metrics: [], anomalies: [] };
    card();
    await screen.findByText("No readings in the last 1 minute");
    screen.getByText("Try a longer range.");
    await chooseRange("Last hour");
    await screen.findByText("No readings in the last 1 hour");
  });

  it("has no aria-live region", async () => {
    const { container } = card();
    await screen.findByRole("figure");
    expect(container.querySelector("[aria-live]")).toBeNull();
  });
});

describe("TrendsCard refresh and Live", () => {
  it("refetches every 60 s on every range", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    card();
    await screen.findByRole("figure");
    for (const name of RANGE_NAMES) {
      // biome-ignore lint/performance/noAwaitInLoops: each range is chosen in turn.
      await chooseRange(name);
      await screen.findByRole("figure");
      await waitFor(() => expect(seriesCalls().length).toBeGreaterThan(0));
      const before = seriesCalls().length;
      await vi.advanceTimersByTimeAsync(1500);
      expect(seriesCalls().length).toBe(before);
      await vi.advanceTimersByTimeAsync(60_000);
      await waitFor(() => expect(seriesCalls().length).toBeGreaterThan(before));
    }
  });

  it("refetches on Refresh trends and is disabled while fetching", async () => {
    card();
    await screen.findByRole("figure");
    expect(refreshButton().hasAttribute("disabled")).toBe(false);
    const before = seriesCalls().length;
    pending = true;
    fireEvent.click(refreshButton());
    await waitFor(() => expect(seriesCalls().length).toBe(before + 1));
    await waitFor(() =>
      expect(refreshButton().hasAttribute("disabled")).toBe(true)
    );
  });

  it("is a switch named Live that starts off", async () => {
    card();
    await screen.findByRole("figure");
    expect(liveSwitch().getAttribute("aria-checked")).toBe("false");
    fireEvent.click(liveSwitch());
    expect(liveSwitch().getAttribute("aria-checked")).toBe("true");
  });

  it("is enabled only on 1 min and 15 min, with a described hint", async () => {
    card();
    await screen.findByRole("figure");
    expect(liveSwitch().getAttribute("aria-disabled")).not.toBe("true");
    await chooseRange("Last 15 minutes");
    expect(liveSwitch().getAttribute("aria-disabled")).not.toBe("true");
    for (const name of ["Last hour", "Last 24 hours"]) {
      // biome-ignore lint/performance/noAwaitInLoops: each range is chosen in turn.
      await chooseRange(name);
      expect(liveSwitch().getAttribute("aria-disabled")).toBe("true");
      const id = liveSwitch().getAttribute("aria-describedby") ?? "";
      expect(document.querySelector(`[id="${id}"]`)?.textContent).toBe(
        "Live is available for 1 min and 15 min"
      );
    }
  });

  it("turns Live off on 1 h or 24 h, and not back on", async () => {
    card();
    await screen.findByRole("figure");
    fireEvent.click(liveSwitch());
    await chooseRange("Last hour");
    expect(liveSwitch().getAttribute("aria-checked")).toBe("false");
    await chooseRange("Last 1 minute");
    expect(liveSwitch().getAttribute("aria-checked")).toBe("false");
    fireEvent.click(liveSwitch());
    await chooseRange("Last 24 hours");
    expect(liveSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("refetches every second while Live, keeping the selected tile", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    card();
    await screen.findByRole("figure");
    fireEvent.click(tile(PRESSURE_TILE));
    fireEvent.click(liveSwitch());
    const before = seriesCalls().length;
    await vi.advanceTimersByTimeAsync(1500);
    await waitFor(() => expect(seriesCalls().length).toBeGreaterThan(before));
    expect(tile(PRESSURE_TILE).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows when it last updated", async () => {
    card();
    await screen.findByRole("figure");
    screen.getByText(UPDATED);
  });
});
