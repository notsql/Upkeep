import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Device } from "@/lib/devices";
import type { Location } from "@/lib/locations";
import { AssetDevicesSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices-section";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "../../../../../../../test-utils";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: React.ReactNode;
    to: string;
    params?: { estateId: string; assetId: string };
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

const NOT_SHOWN_AGAIN = /won't be shown again/;
const STOPS_WORKING = /current key stops working immediately/;
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
  vi.mocked(api.GET).mockImplementation(((path: string) => {
    let data: unknown = locations;
    if (path === DEVICES_PATH) {
      data = devices;
    }
    return Promise.resolve({ data, response: new Response() });
  }) as never);
}

function renderSection(canRegister = true) {
  renderWithProviders(
    <AssetDevicesSection
      assetId="asset-id"
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
    expect(screen.queryByRole("link", { name: "Register device" })).toBeNull();
  });
});

it("links to a dedicated device form from the asset", () => {
  serve();
  renderSection();
  expect(
    screen.getByRole<HTMLAnchorElement>("link", { name: "Register device" })
      .href
  ).toContain("/estates/estate-id/assets/asset-id/devices/new");
  expect(screen.queryByRole("textbox", { name: "Identifier" })).toBeNull();
});

describe("AssetDevicesSection credentials", () => {
  const CREDENTIAL_PATH =
    "/estates/{estateId}/assets/{assetId}/devices/{deviceId}/credential";
  const issuedAt = "2026-10-01T08:30:00Z";
  const apiKey = `upk_${"K".repeat(42)}w`;
  const writeText = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    devices = [device];
    serve();
    vi.mocked(api.POST).mockImplementation((() => {
      devices = [{ ...device, credentialIssuedAt: issuedAt }];
      return Promise.resolve({
        data: { deviceId: "device-id", apiKey, issuedAt },
        response: new Response(),
      });
    }) as never);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    writeText.mockResolvedValue(undefined);
  });

  it("says when a device has no credential", async () => {
    renderSection();
    const item = within(await screen.findByRole("listitem"));
    item.getByText("No credential");
    item.getByRole("button", { name: "Generate credential" });
  });

  it("shows when a device's credential was issued", async () => {
    devices = [{ ...device, credentialIssuedAt: issuedAt }];
    renderSection();
    const item = within(await screen.findByRole("listitem"));
    item.getByText(`Credential issued ${new Date(issuedAt).toLocaleString()}`);
    item.getByRole("button", { name: "Replace credential" });
  });

  it("hides credential actions on a retired asset", async () => {
    devices = [
      { ...device, credentialIssuedAt: issuedAt },
      { ...device, id: "d2", identifier: "PUMP-02" },
    ];
    renderSection(false);
    await screen.findByRole("heading", { name: "PUMP-02" });
    expect(
      screen.queryByRole("button", { name: "Replace credential" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Generate credential" })
    ).toBeNull();
  });

  it("generates a key and shows it once with a copy button and a warning", async () => {
    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Generate credential" })
    );

    const dialog = within(await screen.findByRole("dialog"));
    expect(api.POST).toHaveBeenCalledWith(CREDENTIAL_PATH, {
      params: {
        path: {
          estateId: "estate-id",
          assetId: "asset-id",
          deviceId: "device-id",
        },
      },
    });
    expect(
      (dialog.getByRole("textbox", { name: "API key" }) as HTMLInputElement)
        .value
    ).toBe(apiKey);
    dialog.getByText(NOT_SHOWN_AGAIN);

    fireEvent.click(dialog.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(apiKey));

    fireEvent.click(dialog.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByDisplayValue(apiKey)).toBeNull();
    await screen.findByText(
      `Credential issued ${new Date(issuedAt).toLocaleString()}`
    );
  });

  it("asks before replacing a key, warning that the current one stops working", async () => {
    devices = [{ ...device, credentialIssuedAt: issuedAt }];
    renderSection();
    fireEvent.click(
      await screen.findByRole("button", { name: "Replace credential" })
    );

    const confirm = within(await screen.findByRole("dialog"));
    confirm.getByText(STOPS_WORKING);
    expect(api.POST).not.toHaveBeenCalled();

    fireEvent.click(confirm.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.POST).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Replace credential" }));
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Replace credential",
      })
    );
    await waitFor(() => expect(api.POST).toHaveBeenCalledTimes(1));
    const shown = await screen.findByRole("textbox", { name: "API key" });
    expect((shown as HTMLInputElement).value).toBe(apiKey);
  });
});
