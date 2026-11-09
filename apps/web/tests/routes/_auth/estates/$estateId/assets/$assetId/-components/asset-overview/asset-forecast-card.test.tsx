import { renderWithProviders, screen, within } from "@tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Assessment } from "@/lib/assessments";
import type { FailureRisk } from "@/lib/failure-risk";
import { formatDate } from "@/lib/format";
import { AssetForecastCard } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-forecast-card";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const RISK_PATH = "/estates/{estateId}/assets/{assetId}/failure-risk";
const ASSESSMENTS_PATH = "/estates/{estateId}/assets/{assetId}/assessments";

let risk: Partial<FailureRisk>;
let assessments: Assessment[] | "pending" | "failed";

function current(
  condition: Assessment["condition"],
  recordedByUserId: string,
  recordedByName?: string
): Assessment {
  return {
    id: "a1",
    assetId: "asset",
    condition,
    assessedOn: "2026-11-07",
    notes: "",
    recordedByUserId,
    recordedByName,
    recordedAt: "2026-11-07T12:59:26Z",
  };
}

function serve() {
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    if (path === RISK_PATH) {
      return Promise.resolve({ data: risk, response: new Response() });
    }
    if (path === ASSESSMENTS_PATH) {
      if (assessments === "pending") {
        return new Promise(() => undefined);
      }
      if (assessments === "failed") {
        return Promise.resolve({
          error: { message: "Assessments failed" },
          response: new Response(null, { status: 500 }),
        });
      }
      return Promise.resolve({ data: assessments, response: new Response() });
    }
    return Promise.resolve({ data: undefined, response: new Response() });
  }) as never);
}

function card() {
  renderWithProviders(<AssetForecastCard assetId="asset" estateId="estate" />);
}

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  risk = {
    basis: "INSUFFICIENT_DATA",
    flagReasons: ["CONDITION", "FAILURE_RISK"],
    failuresObserved: 0,
    expectedEndOfLife: "2041-11-07",
  };
  assessments = [current("NEEDS_ATTENTION", "system:anomaly-model")];
  serve();
});

describe("AssetForecastCard", () => {
  it("shows the title without a description", async () => {
    card();
    await screen.findByText("Breakdown forecast");
    expect(
      screen.queryByText("Chance this unit breaks down soon", { exact: false })
    ).toBeNull();
  });

  it("names the condition and that anomaly detection recorded it", async () => {
    card();
    await screen.findByText("Condition: Needs attention · Anomaly detection");
    screen.getByText("Failure risk");
    const line = screen.getByText("Flagged for a check because", {
      exact: false,
    });
    expect(line.textContent).toBe(
      "Flagged for a check because Condition: Needs attention · Anomaly detection, Failure risk"
    );
  });

  it.each([
    [0.05, "Low risk", "low"],
    [0.15, "Moderate risk", "moderate"],
    [0.45, "High risk", "high"],
  ])("heads a %s 90-day chance as %s", async (p90, label, tone) => {
    risk = {
      basis: "ASSET_HISTORY",
      flagReasons: [],
      probability30Days: p90 / 3,
      probability60Days: p90 / 2,
      probability90Days: p90,
      recommendedTimeframe: "WITHIN_60_DAYS",
      failuresObserved: 1,
    };
    card();
    const lead = await screen.findByRole("figure", { name: "Forecast" });
    within(lead).getByText(label);
    expect(lead.dataset.tone).toBe(tone);
    within(lead).getByText(`${Math.round(p90 * 100)}%`);
  });

  it("shows the recommended check under the headline", async () => {
    risk = {
      basis: "ASSET_HISTORY",
      flagReasons: [],
      probability30Days: 0.1,
      probability60Days: 0.2,
      probability90Days: 0.3,
      recommendedTimeframe: "WITHIN_30_DAYS",
      failuresObserved: 2,
    };
    card();
    const lead = await screen.findByRole("figure", { name: "Forecast" });
    expect(lead.textContent).toContain("Recommended check");
    within(lead).getByText("Within 30 days");
  });

  it("draws a progress bar per horizon", async () => {
    risk = {
      basis: "ASSET_HISTORY",
      flagReasons: [],
      probability30Days: 0.1,
      probability60Days: 0.2,
      probability90Days: 0.3,
      recommendedTimeframe: "WITHIN_30_DAYS",
      failuresObserved: 2,
    };
    card();
    const stats = await screen.findByRole("list", {
      name: "Chance by horizon",
    });
    const bars = within(stats).getAllByRole("progressbar");
    expect(bars.map((bar) => bar.getAttribute("aria-valuenow"))).toEqual([
      "10",
      "20",
      "30",
    ]);
  });

  it("leads with the 90-day chance and recommended check, then 30/60/90", async () => {
    risk = {
      basis: "ASSET_HISTORY",
      flagReasons: [],
      probability30Days: 0.1,
      probability60Days: 0.2,
      probability90Days: 0.3,
      recommendedTimeframe: "WITHIN_30_DAYS",
      failuresObserved: 2,
      expectedEndOfLife: "2041-11-07",
    };
    card();
    const lead = await screen.findByRole("figure", { name: "Forecast" });
    expect(lead.textContent).toContain("30%");
    const stats = screen.getByRole("list", { name: "Chance by horizon" });
    expect(stats.textContent).toContain("30 days");
    expect(stats.textContent).toContain("60 days");
    expect(stats.textContent).toContain("90 days");
    screen.getByText("Breakdowns observed: 2", { exact: false });
  });

  it("names the person who recorded the condition", async () => {
    assessments = [current("FAULTY", "user_1", "Casey Doe")];
    card();
    await screen.findByText("Condition: Faulty · Casey Doe");
  });

  it("falls back while assessments load", async () => {
    assessments = "pending";
    card();
    await screen.findByText("Condition needs a check");
  });

  it("falls back when assessments fail", async () => {
    assessments = "failed";
    card();
    await screen.findByText("Condition needs a check");
  });

  it("shows the expected end of life as a formatted date", async () => {
    card();
    await screen.findByText(
      `Expected end of life: ${formatDate("2041-11-07")}`
    );
  });

  it("says when the end of life is not recorded", async () => {
    risk = { ...risk, expectedEndOfLife: undefined };
    card();
    await screen.findByText("Expected end of life: Not recorded");
  });
});
