import { anomalyAlert } from "@tests/fixtures/notifications";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { AssetOverview } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-overview";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));

const viewer = vi.hoisted(() => ({
  canViewReadings: true,
  canCreateInspectionResults: true,
  installedOn: "2026-11-07" as string | undefined,
  manufacturer: "Grundfos" as string | undefined,
  model: "CR 10" as string | undefined,
}));
vi.mock("@/lib/estates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/estates")>()),
  useEstate: () => ({
    data: { id: "estate", name: "Maple Grove", owned: true },
  }),
}));
vi.mock("@/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access")>()),
  useAppAccess: () => ({
    data: {
      estates: [
        {
          estateId: "estate",
          role: "MEMBER",
          canViewReadings: viewer.canViewReadings,
          canRecordReadings: true,
          canCreateInspectionResults: viewer.canCreateInspectionResults,
        },
      ],
    },
  }),
}));
vi.mock("@/lib/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assets")>()),
  useAsset: () => ({
    data: {
      id: "asset",
      name: "Water pump",
      reference: "MG-A0001",
      category: "PUMP",
      installedOn: viewer.installedOn,
      locationPath: "Blk 1 / Plant room",
      manufacturer: viewer.manufacturer,
      model: viewer.model,
      lifecycleVersion: 0,
    },
  }),
}));
vi.mock("@/lib/catalogue", () => ({
  useAssetCategories: () => ({ data: [{ code: "PUMP", label: "Pump" }] }),
}));
// The cards below have their own tests; here they only mark their place.
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/asset-condition-section",
  () => ({
    AssetConditionSection: ({ upcoming }: { upcoming?: ReactNode }) => (
      <section aria-label="Condition">
        <h2>Condition</h2>
        {upcoming}
      </section>
    ),
  })
);
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-forecast-card",
  () => ({ AssetForecastCard: () => <h2>Breakdown forecast</h2> })
);
const SERIES_PATH = "/estates/{estateId}/assets/{assetId}/readings/series";
const ALERTS_PATH = "/estates/{estateId}/assets/{assetId}/anomaly-alerts";
let alerts: unknown[] = [];

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  alerts = [];
  viewer.canViewReadings = true;
  viewer.installedOn = "2026-11-07";
  viewer.manufacturer = "Grundfos";
  viewer.model = "CR 10";
  viewer.canCreateInspectionResults = true;
  const series = {
    from: "2026-11-07T12:58:12Z",
    to: "2026-11-07T12:59:12Z",
    bucketSeconds: 1,
    anomalyThreshold: 0.51,
    metrics: [],
    anomalies: [],
  };
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    const data: Record<string, unknown> = {
      [SERIES_PATH]: series,
      [ALERTS_PATH]: alerts,
    };
    return Promise.resolve({
      data: data[path] ?? [],
      response: new Response(),
    });
  }) as never);
});

function overview() {
  renderWithProviders(<AssetOverview assetId="asset" estateId="estate" />);
}

describe("AssetOverview layout", () => {
  it("orders Condition (with Upcoming inside), forecast and Trends with no Details or Devices card", async () => {
    overview();
    await screen.findByRole("region", { name: "Trends" });
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
    ).toEqual(["Condition", "Breakdown forecast"]);
    const condition = screen.getByRole("region", { name: "Condition" });
    within(condition).getByRole("heading", { level: 3, name: "Upcoming" });
    expect(screen.queryByRole("region", { name: "Upcoming" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Details" })).toBeNull();
  });

  it("hides Anomaly alerts when the asset has none", async () => {
    overview();
    await screen.findByRole("region", { name: "Trends" });
    expect(
      screen.queryByRole("region", { name: "Unusual readings" })
    ).toBeNull();
  });

  it("shows Anomaly alerts between Condition and Trends when there is one", async () => {
    alerts = [anomalyAlert];
    overview();
    await screen.findByRole("region", { name: "Unusual readings" });
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
    ).toEqual(["Condition", "Breakdown forecast", "Unusual readings"]);
  });

  it("summarises the asset inline without repeating the reference", () => {
    overview();
    const details = screen.getByRole("list", { name: "Asset details" });
    expect(details.closest("[data-slot='card']")).toBeNull();
    within(details).getByText("Pump");
    within(details).getByText("Blk 1 / Plant room");
    within(details).getByText(formatDate("2026-11-07"));
    within(details).getByText("Grundfos CR 10");
    expect(within(details).queryByText("2026-11-07")).toBeNull();
    expect(within(details).queryByText("MG-A0001")).toBeNull();
  });

  it("omits unrecorded details instead of saying Not recorded", () => {
    viewer.installedOn = undefined;
    viewer.manufacturer = undefined;
    overview();
    const details = screen.getByRole("list", { name: "Asset details" });
    expect(within(details).queryByText("Installed")).toBeNull();
    within(details).getByText("CR 10");
    expect(screen.queryByText("Not recorded")).toBeNull();
  });

  it("leaves the attention banner to the asset page layout", async () => {
    overview();
    await screen.findByRole("region", { name: "Trends" });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.queryByRole("link", { name: "File an inspection" })
    ).toBeNull();
  });

  it("names the make once when manufacturer and model are the same", () => {
    viewer.manufacturer = "GENERIC";
    viewer.model = "GENERIC";
    overview();
    const details = screen.getByRole("list", { name: "Asset details" });
    within(details).getByText("GENERIC");
    expect(within(details).queryByText("GENERIC GENERIC")).toBeNull();
  });

  it("shows no Trends without canViewReadings", () => {
    viewer.canViewReadings = false;
    overview();
    expect(screen.queryByRole("region", { name: "Trends" })).toBeNull();
    expect(
      (vi.mocked(api.GET).mock.calls as unknown[][]).some(
        ([path]) => path === SERIES_PATH
      )
    ).toBe(false);
  });
});
