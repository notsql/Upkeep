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
import type { EstateReading } from "@/lib/readings";
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
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string | undefined>;
  }) => (
    <a
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
  () => ({ AssetConditionSection: () => <h2>Condition</h2> })
);

const ASSET = "11111111-1111-4111-8111-111111111111";
const DEVICES_PATH = "/estates/{estateId}/assets/{assetId}/devices";
const REVIEW_PATH = "/estates/{estateId}/flatlined-sensors";
const READINGS_PATH = "/estates/{estateId}/readings";
const RISK_PATH = "/estates/{estateId}/assets/{assetId}/failure-risk";
const PAUSE_TEMPERATURE = /Pause PUMP-01 temperature/u;

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
const devices: Device[] = [
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

const reading: EstateReading = {
  id: "r1",
  assetId: ASSET,
  assetReference: "MG-A0001",
  assetName: "Water pump",
  measuredAt: at,
  metric: "TEMPERATURE",
  unit: "°C",
  value: 21.5,
  deviceId: "d1",
  deviceIdentifier: "PUMP-01",
  flags: [],
  source: "MANUAL",
  recordedByUserId: "u1",
  recordedByName: "Alex Tan",
  recordedAt: at,
};

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
      [READINGS_PATH]: { items: [reading], page: 0, size: 50, totalItems: 1 },
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

function section(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name });
  const container = heading.closest("section, [data-slot='card']");
  if (!(container instanceof HTMLElement)) {
    throw new Error(`No section for ${name}`);
  }
  return container;
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
  failing = new Set();
  serve();
});

describe("AssetOverview devices", () => {
  it("lists every device of the asset with its status badge", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    const list = await screen.findByRole("list", { name: "Asset devices" });
    const first = await within(list).findByRole("listitem", {
      name: "PUMP-01",
    });
    within(first).getByText("Online");
    const second = within(list).getByRole("listitem", { name: "PUMP-02" });
    within(second).getByText("Offline");
  });

  it("shows Possible flatline for a flatlined review entry", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    const list = await screen.findByRole("list", { name: "Asset devices" });
    const first = within(list).getByRole("listitem", { name: "PUMP-01" });
    await within(first).findByText("Possible flatline");
    const second = within(list).getByRole("listitem", { name: "PUMP-02" });
    await within(second).findByText("Monitoring");
    expect(screen.queryByText("FAN-01")).toBeNull();
  });

  it("offers Pause for maintenance when the review has canManage", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("button", { name: PAUSE_TEMPERATURE });
  });

  it("hides Pause for maintenance without canManage", async () => {
    canManage = false;
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByText("Possible flatline");
    expect(
      screen.queryByRole("button", { name: PAUSE_TEMPERATURE })
    ).toBeNull();
  });

  it("offers Add device to the owner of an active asset", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    const link = await screen.findByRole("link", { name: "Add device" });
    expect(link.getAttribute("href")).toBe(
      `/estates/estate/assets/${ASSET}/devices/new`
    );
    screen.getByRole("link", { name: "Manage devices" });
  });

  it("hides Add device on a retired asset", async () => {
    viewer.retired = true;
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("list", { name: "Asset devices" });
    expect(screen.queryByRole("link", { name: "Add device" })).toBeNull();
  });

  it("hides Add device from a non-owner", async () => {
    viewer.owned = false;
    viewer.role = "MANAGER";
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("list", { name: "Asset devices" });
    expect(screen.queryByRole("link", { name: "Add device" })).toBeNull();
  });

  it("shows an inline error when the flatline review fails, keeping the devices", async () => {
    failing.add(REVIEW_PATH);
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByText(`Failed ${REVIEW_PATH}`);
    const list = screen.getByRole("list", { name: "Asset devices" });
    within(list).getByRole("listitem", { name: "PUMP-01" });
    expect(screen.queryByText("Possible flatline")).toBeNull();
    within(section("Devices")).getByText(`Failed ${REVIEW_PATH}`);
  });
});

describe("AssetOverview readings", () => {
  it("shows the asset's latest readings and links to all of them", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    const table = await screen.findByRole("table", { name: "Readings" });
    within(table).getByText("Alex Tan", { exact: false });
    const all = screen.getByRole("link", { name: "View all readings" });
    expect(all.getAttribute("href")).toBe(
      `/estates/estate/assets/${ASSET}/readings`
    );
    const record = screen.getByRole("link", { name: "Record manual reading" });
    expect(record.getAttribute("href")).toBe(
      `/estates/estate/readings/${ASSET}/new`
    );
    const call = calls().find(([path]) => path === READINGS_PATH);
    expect(JSON.stringify(call?.[1])).toContain(`"assetId":"${ASSET}"`);
  });

  it("hides Record manual reading without canRecordReadings", async () => {
    viewer.canRecordReadings = false;
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("table", { name: "Readings" });
    expect(
      screen.queryByRole("link", { name: "Record manual reading" })
    ).toBeNull();
  });

  it("shows a readings failure only in the Readings section", async () => {
    failing.add(READINGS_PATH);
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByText(`Failed ${READINGS_PATH}`);
    within(section("Readings")).getByText(`Failed ${READINGS_PATH}`);
    screen.getByRole("heading", { name: "Condition" });
    await screen.findByRole("listitem", { name: "PUMP-01" });
  });

  it("does not request readings without canViewReadings", async () => {
    viewer.canViewReadings = false;
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("list", { name: "Asset devices" });
    expect(screen.queryByRole("heading", { name: "Readings" })).toBeNull();
    expect(requested(READINGS_PATH)).toBe(false);
  });
});

describe("AssetOverview access", () => {
  it("does not mount the forecast for a non-owner", async () => {
    viewer.owned = false;
    viewer.role = "MANAGER";
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("list", { name: "Asset devices" });
    expect(screen.queryByText("Breakdown forecast")).toBeNull();
    expect(requested(RISK_PATH)).toBe(false);
  });

  it("shows the forecast to the owner of a pump", async () => {
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByText("Breakdown forecast");
    await waitFor(() => expect(requested(RISK_PATH)).toBe(true));
  });

  it("mounts no device section for a viewer who is neither owner nor Manager", async () => {
    viewer.owned = false;
    viewer.role = "CREW";
    renderWithProviders(<AssetOverview assetId={ASSET} estateId="estate" />);
    await screen.findByRole("table", { name: "Readings" });
    expect(screen.queryByRole("list", { name: "Asset devices" })).toBeNull();
    expect(requested(DEVICES_PATH)).toBe(false);
    expect(requested(REVIEW_PATH)).toBe(false);
  });
});
