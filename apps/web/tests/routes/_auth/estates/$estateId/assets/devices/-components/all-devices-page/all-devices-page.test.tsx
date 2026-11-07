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
import type { EstateDevice } from "@/lib/devices";
import type {
  MonitoredSensor,
  SensorPolicy,
  SensorReview,
} from "@/lib/flatlined-sensors";
import { AllDevicesPage } from "@/routes/_auth/estates/$estateId/assets/devices/-components/all-devices-page/all-devices-page";

vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(), PUT: vi.fn(), POST: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "viewer" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
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

const ESTATE = "5f0c7d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const viewer = vi.hoisted(() => ({
  owned: true,
  role: "MEMBER",
  canViewAssets: true,
}));
vi.mock("@/lib/estates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/estates")>()),
  useEstate: () => ({
    data: { id: "5f0c7d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f", owned: viewer.owned },
    isPending: false,
  }),
}));
vi.mock("@/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access")>()),
  useAppAccess: () => ({
    isPending: false,
    data: {
      canAccessPlatformAdmin: false,
      estates: [
        {
          estateId: "5f0c7d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f",
          role: viewer.role,
          canViewManagement: true,
          canViewAssets: viewer.canViewAssets,
          canViewInspectionResults: false,
        },
      ],
    },
  }),
}));

const DEVICES_PATH = "/estates/{estateId}/devices";
const REVIEW_PATH = "/estates/{estateId}/flatlined-sensors";
const POLICY_PATH = "/estates/{estateId}/flatline-policies";
const PAUSE = /^Pause/u;
const MODEL = "PT-100";
const at = "2026-10-20T04:00:00Z";

function device(
  id: string,
  assetName: string,
  status: EstateDevice["status"]
): EstateDevice {
  return {
    id,
    estateId: ESTATE,
    assetId: `asset-${id}`,
    assetReference: `REF-${id}`,
    assetName,
    assetRetired: false,
    locationId: "loc",
    identifier: id,
    model: "PT-100",
    metrics: [{ metric: "TEMPERATURE", unit: "°C" }],
    reportingIntervalSeconds: 60,
    lastSeenAt: status === "AWAITING_FIRST_READING" ? null : at,
    status,
    credentialIssuedAt: at,
    createdAt: at,
    updatedAt: at,
  } as EstateDevice;
}

function sensor(
  deviceId: string,
  assetName: string,
  state: MonitoredSensor["state"]
): MonitoredSensor {
  return {
    deviceId,
    assetId: `asset-${deviceId}`,
    deviceIdentifier: deviceId,
    assetName,
    assetReference: `REF-${deviceId}`,
    assetLocationPath: "Block A",
    deviceLocationPath: "Block A › Plant room",
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

const policies = (["TEMPERATURE", "HUMIDITY", "PRESSURE"] as const).map(
  (metric) =>
    ({
      metric,
      unit: "u",
      durationMinutes: null,
      tolerance: 0,
    }) satisfies SensorPolicy
);

let devices: EstateDevice[];
let entries: MonitoredSensor[];
let canManage: boolean;
let failing: Set<string>;

function reviewPage(page: number): SensorReview {
  return {
    checkedAt: at,
    canManage,
    estateActive: true,
    hasSensorReadings: true,
    page,
    size: 25,
    totalElements: entries.length,
    sensors: entries.slice(page * 25, page * 25 + 25),
  };
}

function serve() {
  vi.mocked(api.GET).mockImplementation(((
    path: string,
    options?: { params?: { query?: { page?: number } } }
  ) => {
    if (failing.has(path)) {
      return Promise.resolve({
        error: { message: `Failed ${path}` },
        response: new Response(null, { status: 500 }),
      });
    }
    const data: Record<string, unknown> = {
      [DEVICES_PATH]: devices,
      [REVIEW_PATH]: reviewPage(options?.params?.query?.page ?? 0),
      [POLICY_PATH]: { canManage, estateActive: true, policies },
    };
    return Promise.resolve({ data: data[path], response: new Response() });
  }) as never);
}

function requested(path: string): boolean {
  return (vi.mocked(api.GET).mock.calls as unknown[][]).some(
    ([called]) => called === path
  );
}

/** The device identifier of each body row, top to bottom. */
function deviceOrder(): string[] {
  const table = screen.getByRole("table", { name: "All devices" });
  return within(table)
    .getAllByRole("rowheader")
    .map((cell) => (cell.textContent ?? "").replace(MODEL, ""));
}

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  vi.mocked(api.POST).mockReset();
  Object.assign(viewer, { owned: true, role: "MEMBER", canViewAssets: true });
  devices = [
    device("ONLINE-1", "Boiler", "ONLINE"),
    device("GONE-1", "Boiler", "DEACTIVATED"),
    device("WAIT-1", "Boiler", "AWAITING_FIRST_READING"),
    device("OFF-1", "Boiler", "OFFLINE"),
    device("FLAT-1", "Boiler", "ONLINE"),
  ];
  entries = [
    sensor("FLAT-1", "Boiler", "FLATLINED"),
    sensor("ONLINE-1", "Boiler", "MONITORING"),
  ];
  canManage = true;
  failing = new Set();
  serve();
});

describe("AllDevicesPage", () => {
  it("ranks a flatlined device first, then offline, awaiting, online and deactivated", async () => {
    renderWithProviders(<AllDevicesPage estateId={ESTATE} />);
    await screen.findByRole("table", { name: "All devices" });
    expect(deviceOrder()).toEqual([
      "FLAT-1",
      "OFF-1",
      "WAIT-1",
      "ONLINE-1",
      "GONE-1",
    ]);
    const table = screen.getByRole("table", { name: "All devices" });
    within(table).getByText("Possible flatline");
  });

  it("shows a flatline that is on the second review page", async () => {
    entries = [
      ...Array.from({ length: 29 }, (_, index) =>
        sensor(`QUIET-${index}`, "Fan", "MONITORING")
      ),
      sensor("ONLINE-1", "Boiler", "FLATLINED"),
    ];
    renderWithProviders(<AllDevicesPage estateId={ESTATE} />);
    await screen.findByRole("table", { name: "All devices" });
    expect(deviceOrder()[0]).toBe("ONLINE-1");
    within(screen.getByRole("table", { name: "All devices" })).getByText(
      "Possible flatline"
    );
  });

  it("keeps devices ranked by status when the flatline review fails, until Retry", async () => {
    failing.add(REVIEW_PATH);
    renderWithProviders(<AllDevicesPage estateId={ESTATE} />);
    const retry = await screen.findByRole("button", {
      name: "Retry device monitoring",
    });
    expect(deviceOrder()).toEqual([
      "OFF-1",
      "WAIT-1",
      "FLAT-1",
      "ONLINE-1",
      "GONE-1",
    ]);
    failing.clear();
    fireEvent.click(retry);
    await waitFor(() => expect(deviceOrder()[0]).toBe("FLAT-1"));
  });

  it("offers Pause for maintenance when the review allows managing", async () => {
    renderWithProviders(<AllDevicesPage estateId={ESTATE} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Pause FLAT-1 temperature" })
    );
    await screen.findByRole("dialog", { name: "Pause FLAT-1 temperature" });
  });

  it("hides Pause for maintenance without manage rights", async () => {
    canManage = false;
    renderWithProviders(<AllDevicesPage estateId={ESTATE} />);
    await screen.findByText("Possible flatline");
    expect(screen.queryByRole("button", { name: PAUSE })).toBeNull();
  });

  it("opens Metric policies in a dialog listing every metric", async () => {
    renderWithProviders(<AllDevicesPage estateId={ESTATE} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Metric policies" })
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Metric policies",
    });
    await within(dialog).findByText("Temperature");
    within(dialog).getByText("Humidity");
    within(dialog).getByText("Pressure");
  });

  it("shows By location and All devices tabs to a register viewer", async () => {
    renderWithProviders(<AllDevicesPage estateId={ESTATE} />);
    const nav = await screen.findByRole("navigation", { name: "Asset views" });
    within(nav).getByRole("link", { name: "By location" });
    within(nav).getByRole("link", { name: "All devices" });
  });

  it("builds read-only rows from the review for Council without requesting devices", async () => {
    Object.assign(viewer, {
      owned: false,
      role: "COUNCIL",
      canViewAssets: false,
    });
    canManage = false;
    renderWithProviders(<AllDevicesPage estateId={ESTATE} />);
    await screen.findByRole("table", { name: "All devices" });
    expect(deviceOrder()).toEqual(["FLAT-1", "ONLINE-1"]);
    expect(requested(DEVICES_PATH)).toBe(false);
    const table = screen.getByRole("table", { name: "All devices" });
    expect(
      within(table).queryByRole("columnheader", { name: "Status" })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: PAUSE })).toBeNull();
    expect(
      screen.queryByRole("navigation", { name: "Asset views" })
    ).toBeNull();
  });
});
