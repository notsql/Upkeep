import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Device } from "@/lib/devices";
import type { MonitoredSensor, SensorReview } from "@/lib/flatlined-sensors";
import { AssetOverview } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-overview";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string | undefined>;
  }) => (
    <a
      {...props}
      href={
        to
          .replace("$estateId", params?.estateId ?? "")
          .replace("$assetId", params?.assetId ?? "") +
        (search?.assetId ? `?assetId=${search.assetId}` : "")
      }
    >
      {children}
    </a>
  ),
}));

const viewer = vi.hoisted(() => ({
  owned: true,
  role: "MEMBER",
  canViewReadings: true,
  canRecordReadings: true,
  category: "PUMP",
  retired: false,
}));
vi.mock("@/lib/estates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/estates")>()),
  useEstate: () => ({
    data: { id: "estate", name: "Maple Grove", owned: viewer.owned },
  }),
}));
vi.mock("@/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access")>()),
  useAppAccess: () => ({
    data: {
      estates: [
        {
          estateId: "estate",
          role: viewer.role,
          canViewReadings: viewer.canViewReadings,
          canRecordReadings: viewer.canRecordReadings,
        },
      ],
    },
  }),
}));
vi.mock("@/lib/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assets")>()),
  useAsset: () => ({
    data: {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Water pump",
      reference: "MG-A0001",
      category: viewer.category,
      lifecycleVersion: 0,
      deactivatedAt: viewer.retired ? "2026-10-01T00:00:00Z" : undefined,
    },
  }),
}));
vi.mock("@/lib/catalogue", () => ({
  useAssetCategories: () => ({ data: [{ code: "PUMP", label: "Pump" }] }),
}));
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

const ASSET = "11111111-1111-4111-8111-111111111111";
const DEVICES_PATH = "/estates/{estateId}/assets/{assetId}/devices";
const REVIEW_PATH = "/estates/{estateId}/flatlined-sensors";
const READINGS_PATH = "/estates/{estateId}/assets/{assetId}/readings/grouped";
const RISK_PATH = "/estates/{estateId}/assets/{assetId}/failure-risk";
const SERIES_PATH = "/estates/{estateId}/assets/{assetId}/readings/series";

const at = "2026-10-01T00:00:00Z";
function device(id: string, identifier: string, status: Device["status"]) {
  return {
    id,
    estateId: "estate",
    assetId: ASSET,
    locationId: "plant",
    identifier,
    model: "PT-100",
    metrics: [{ metric: "TEMPERATURE", unit: "°C" }],
    reportingIntervalSeconds: 60,
    status,
    lastSeenAt: at,
    createdAt: at,
    updatedAt: at,
  } satisfies Device;
}
let devices: Device[] = [];
const defaultDevices: Device[] = [
  device("d1", "PUMP-01", "ONLINE"),
  device("d2", "PUMP-02", "OFFLINE"),
];

function sensor(
  deviceId: string,
  identifier: string,
  assetId: string,
  state: MonitoredSensor["state"]
): MonitoredSensor {
  return {
    deviceId,
    assetId,
    deviceIdentifier: identifier,
    assetName: "Water pump",
    assetReference: "MG-A0001",
    assetLocationPath: "Blk 1",
    deviceLocationPath: "Blk 1",
    metric: "TEMPERATURE",
    unit: "°C",
    state,
    lastReadingAt: at,
    lastValue: 20,
    thresholdMinutes: 60,
    tolerance: 0,
    flatline: null,
    pause: null,
  };
}

let canManage: boolean;
let failing: Set<string>;

function review(): SensorReview {
  return {
    checkedAt: at,
    canManage,
    estateActive: true,
    hasSensorReadings: true,
    page: 0,
    size: 25,
    totalElements: 3,
    sensors: [
      sensor("d1", "PUMP-01", ASSET, "FLATLINED"),
      sensor("d2", "PUMP-02", ASSET, "MONITORING"),
      sensor("other", "FAN-01", "other-asset", "FLATLINED"),
    ],
  };
}

function serve() {
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    if (failing.has(path)) {
      return Promise.resolve({
        error: { message: `Failed ${path}` },
        response: new Response(null, { status: 500 }),
      });
    }
    const data: Record<string, unknown> = {
      [DEVICES_PATH]: devices,
      [REVIEW_PATH]: review(),
      [SERIES_PATH]: {
        from: at,
        to: at,
        bucketSeconds: 1,
        anomalyThreshold: 0.51,
        metrics: [],
        anomalies: [],
      },
      [RISK_PATH]: {
        flagReasons: [],
        probability30Days: 0.1,
        failuresObserved: 2,
      },
    };
    return Promise.resolve({
      data: data[path] ?? [],
      response: new Response(),
    });
  }) as never);
}

function calls(): unknown[][] {
  return vi.mocked(api.GET).mock.calls as unknown[][];
}

function requested(path: string): boolean {
  return calls().some(([called]) => called === path);
}

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  Object.assign(viewer, {
    owned: true,
    role: "MEMBER",
    canViewReadings: true,
    canRecordReadings: true,
    category: "PUMP",
    retired: false,
  });
  canManage = true;
  devices = defaultDevices;
  failing = new Set();
  serve();
});

const STAT = /devices? online$/u;

describe("AssetOverview devices", () => {
  it("summarises how many devices are online and links to the Devices tab", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    const stat = await screen.findByRole("link", {
      name: "1 of 2 devices online",
    });
    expect(stat.getAttribute("href")).toBe(
      `/estates/estate/assets/${ASSET}/devices`
    );
    expect(stat.dataset.tone).toBe("some");
  });

  it("tones the stat for all online and none online", async () => {
    devices = [device("d1", "PUMP-01", "ONLINE")];
    const first = renderWithProviders(
      <AssetOverview assetId={ASSET} estateId="estate" />
    );
    const all = await screen.findByRole("link", {
      name: "1 of 1 device online",
    });
    expect(all.dataset.tone).toBe("all");
    first.unmount();
    devices = [
      device("d1", "PUMP-01", "OFFLINE"),
      device("d2", "PUMP-02", "AWAITING_FIRST_READING"),
    ];
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    const none = await screen.findByRole("link", {
      name: "0 of 2 devices online",
    });
    expect(none.dataset.tone).toBe("none");
  });

  it("leaves deactivated devices out of the count", async () => {
    devices = [
      device("d1", "PUMP-01", "ONLINE"),
      {
        ...device("d2", "PUMP-02", "DEACTIVATED"),
        deactivatedAt: at,
      },
    ];
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("link", { name: "1 of 1 device online" });
  });

  it("shows no stat when the asset has no active devices", async () => {
    devices = [];
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await waitFor(() => expect(requested(DEVICES_PATH)).toBe(true));
    await screen.findByRole("region", { name: "Trends" });
    expect(screen.queryByRole("link", { name: STAT })).toBeNull();
  });

  it("lists no devices and requests no monitoring on the overview", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("link", { name: STAT });
    expect(screen.queryByRole("list", { name: "Asset devices" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Devices" })).toBeNull();
    expect(requested(REVIEW_PATH)).toBe(false);
  });
});

describe("AssetOverview readings", () => {
  it("does not list latest readings or offer manual entry on the overview", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("region", { name: "Trends" });
    await screen.findByRole("link", { name: STAT });
    expect(screen.queryByRole("table", { name: "Latest readings" })).toBeNull();
    expect(
      screen.queryByRole("link", { name: "Record manual reading" })
    ).toBeNull();
    expect(requested(READINGS_PATH)).toBe(false);
  });

  it("links from Trends to the asset's readings page", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    const trends = await screen.findByRole("region", { name: "Trends" });
    const all = within(trends).getByRole("link", { name: "View as table" });
    expect(
      within(trends).queryByRole("link", { name: "View all readings" })
    ).toBeNull();
    expect(all.getAttribute("href")).toBe(
      `/estates/estate/assets/${ASSET}/readings`
    );
  });
});

describe("AssetOverview access", () => {
  it("does not mount the forecast for a non-owner", async () => {
    viewer.owned = false;
    viewer.role = "MANAGER";
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("link", { name: STAT });
    expect(screen.queryByText("Breakdown forecast")).toBeNull();
    expect(requested(RISK_PATH)).toBe(false);
  });

  it("shows the forecast to the owner of a pump", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByText("Breakdown forecast");
    await waitFor(() => expect(requested(RISK_PATH)).toBe(true));
  });

  it("shows the owner what is coming up, from the inspection list", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    const condition = screen.getByRole("region", { name: "Condition" });
    await within(condition).findByRole("heading", {
      level: 3,
      name: "Upcoming",
    });
    expect(screen.queryByRole("region", { name: "Upcoming" })).toBeNull();
    await waitFor(() =>
      expect(requested("/estates/{estateId}/inspection-list")).toBe(true)
    );
  });

  it("shows no Upcoming and requests no schedule for a plain member", async () => {
    viewer.owned = false;
    viewer.role = "CREW";
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("region", { name: "Trends" });
    expect(screen.queryByRole("heading", { name: "Upcoming" })).toBeNull();
    expect(requested("/estates/{estateId}/inspection-list")).toBe(false);
    expect(
      requested("/estates/{estateId}/assets/{assetId}/service-interval")
    ).toBe(false);
  });

  it("shows no devices stat to a viewer who is neither owner nor Manager", async () => {
    viewer.owned = false;
    viewer.role = "CREW";
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("region", { name: "Trends" });
    expect(screen.queryByRole("link", { name: STAT })).toBeNull();
    expect(requested(DEVICES_PATH)).toBe(false);
    expect(requested(REVIEW_PATH)).toBe(false);
  });
});
