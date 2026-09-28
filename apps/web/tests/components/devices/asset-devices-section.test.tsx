import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetDevicesSection } from "@/components/devices/asset-devices-section";
import { api } from "@/lib/api";
import type { Device } from "@/lib/devices";
import type { Location } from "@/lib/locations";
import { renderWithProviders, screen, waitFor, within } from "../../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const INTERVAL = /^Expected reporting interval/;
const DEVICES_PATH = "/estates/{estateId}/assets/{assetId}/devices";

const at = "2026-09-28T00:00:00Z";
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
const device: Device = {
  id: "device-id",
  estateId: "estate-id",
  assetId: "asset-id",
  locationId: "plant",
  identifier: "PUMP-01",
  model: "PT-100",
  metrics: [
    { metric: "TEMPERATURE", unit: "°C" },
    { metric: "PRESSURE", unit: "bar" },
  ],
  reportingIntervalSeconds: 60,
  createdAt: at,
  updatedAt: at,
};

let devices: Device[];

function serve() {
  vi.mocked(api.GET).mockImplementation(((path: string) =>
    Promise.resolve({
      data: path === DEVICES_PATH ? devices : locations,
      response: new Response(),
    })) as never);
}

function renderSection(canRegister = true) {
  renderWithProviders(
    <AssetDevicesSection
      assetId="asset-id"
      assetLocationId="plant"
      canRegister={canRegister}
      estateId="estate-id"
    />
  );
}

describe("AssetDevicesSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    devices = [device];
    serve();
  });

  it("shows a newly registered device as awaiting its first reading", async () => {
    renderSection();
    const item = within(await screen.findByRole("listitem"));
    item.getByRole("heading", { name: "PUMP-01" });
    item.getByText("Awaiting first reading");
    item.getByText("PT-100");
    item.getByText("Blk 101 › Plant room");
    item.getByText("Temperature (°C), Pressure (bar)");
    item.getByText("Every 60 seconds");
    expect(api.GET).toHaveBeenCalledWith(DEVICES_PATH, {
      params: { path: { estateId: "estate-id", assetId: "asset-id" } },
    });
  });

  it("says when an asset has no devices, and hides registration on a deactivated asset", async () => {
    devices = [];
    renderSection(false);
    await screen.findByText("No devices are registered to this asset yet.");
    expect(
      screen.queryByRole("button", { name: "Register device" })
    ).toBeNull();
  });

  it("registers a device and lists it", async () => {
    devices = [];
    vi.mocked(api.POST).mockImplementation((() => {
      devices = [device];
      return Promise.resolve({ data: device, response: new Response() });
    }) as never);
    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Register device" })
    );
    await screen.findByRole("option", { name: "Blk 101 › Plant room" });
    fireEvent.change(screen.getByRole("textbox", { name: "Identifier" }), {
      target: { value: "PUMP-01" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Model" }), {
      target: { value: "PT-100" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Temperature (°C)" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: INTERVAL }), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Register device" }));

    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(DEVICES_PATH, {
        params: { path: { estateId: "estate-id", assetId: "asset-id" } },
        body: {
          identifier: "PUMP-01",
          model: "PT-100",
          locationId: "plant",
          metrics: ["TEMPERATURE"],
          reportingIntervalSeconds: 60,
        },
      })
    );
    await screen.findByRole("heading", { name: "PUMP-01" });
    expect(screen.queryByRole("textbox", { name: "Identifier" })).toBeNull();
  });
});
