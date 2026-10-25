import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { EstateDevice } from "@/lib/devices";
import type { Location } from "@/lib/locations";
import { EstateDevicesPage } from "@/routes/_auth/estates/$estateId/devices/-components/estate-devices-page";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
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
      href={to
        .replace("$estateId", params?.estateId ?? "")
        .replace("$assetId", params?.assetId ?? "")}
    >
      {children}
    </a>
  ),
}));

const DEVICES_PATH = "/estates/{estateId}/devices";
const at = "2026-10-24T00:00:00Z";
const locations: Location[] = [
  { id: "b1", type: "BLOCK", name: "Blk 101", createdAt: at, updatedAt: at },
  {
    id: "plant",
    type: "COMMON_AREA",
    name: "Plant room",
    parentId: "b1",
    createdAt: at,
    updatedAt: at,
  },
];

function device(overrides: Partial<EstateDevice>): EstateDevice {
  return {
    id: "d1",
    estateId: "estate-id",
    assetId: "a1",
    assetReference: "MG-A0001",
    assetName: "Booster pump",
    assetRetired: false,
    locationId: "plant",
    identifier: "PUMP-01",
    model: "PT-100",
    metrics: [{ metric: "PRESSURE", unit: "bar" }],
    reportingIntervalSeconds: 60,
    lastSeenAt: "2026-10-24T08:30:00Z",
    status: "OFFLINE",
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

let devices: EstateDevice[] | undefined;

function serve() {
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    if (path === DEVICES_PATH) {
      return Promise.resolve(
        devices
          ? { data: devices, response: new Response() }
          : {
              error: { message: "Estate not found." },
              response: new Response(null, { status: 404 }),
            }
      );
    }
    return Promise.resolve({ data: locations, response: new Response() });
  }) as never);
}

describe("EstateDevicesPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    devices = [
      device({}),
      device({
        id: "d2",
        identifier: "METER-07",
        model: "EM-3",
        assetId: "a2",
        assetReference: "MG-A0002",
        assetName: "Lift motor",
        lastSeenAt: undefined,
        status: "AWAITING_FIRST_READING",
      }),
      device({
        id: "d3",
        identifier: "PUMP-02",
        assetRetired: true,
        status: "ONLINE",
        locationId: "gone",
      }),
    ];
    serve();
  });

  it("lists each device's model, asset, location, last-seen time and status in the server's order", async () => {
    renderWithProviders(<EstateDevicesPage estateId="estate-id" />);
    const table = await screen.findByRole("table", { name: "Devices" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(
      rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent)
    ).toEqual(["PUMP-01PT-100", "METER-07EM-3", "PUMP-02PT-100"]);

    const first = within(rows[0] as HTMLElement);
    expect(
      first.getByRole("link", { name: "Booster pump" }).getAttribute("href")
    ).toBe("/estates/estate-id/assets/a1");
    first.getByText("MG-A0001");
    first.getByText("Blk 101 › Plant room");
    first.getByText(new Date("2026-10-24T08:30:00Z").toLocaleString());
    first.getByText("Offline");

    const second = within(rows[1] as HTMLElement);
    second.getByText("Never");
    second.getByText("Awaiting first reading");

    const third = within(rows[2] as HTMLElement);
    third.getByText("Retired");
    third.getByText("Online");
    third.getByText("Location unavailable");

    expect(api.GET).toHaveBeenCalledWith(DEVICES_PATH, {
      params: { path: { estateId: "estate-id" } },
    });
  });

  it("says it refreshes while open", async () => {
    renderWithProviders(<EstateDevicesPage estateId="estate-id" />);
    await screen.findByText(
      "Refreshes every 60 seconds while this page is open."
    );
  });

  it("shows an empty state for an estate with no devices", async () => {
    devices = [];
    renderWithProviders(<EstateDevicesPage estateId="estate-id" />);
    await screen.findByText("No devices are registered in this estate yet.");
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the server's error when the devices cannot be loaded", async () => {
    devices = undefined;
    renderWithProviders(<EstateDevicesPage estateId="estate-id" />);
    const alert = await screen.findByRole("alert");
    within(alert).getByText("Estate not found.");
  });
});
