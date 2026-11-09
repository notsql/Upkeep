import { fireEvent } from "@testing-library/react";
import { expectLeadingIcon } from "@tests/section-action";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Device } from "@/lib/devices";
import { formatDateTime } from "@/lib/format";
import type { Location } from "@/lib/locations";
import { AssetDevicesSection } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices/asset-devices-section";

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
    search,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: { estateId: string; assetId?: string; deviceId?: string };
    search?: { assetId?: string };
    [key: string]: unknown;
  }) => (
    <a
      {...rest}
      href={
        to
          .replace("$estateId", params?.estateId ?? "")
          .replace("$assetId", params?.assetId ?? "")
          .replace("$deviceId", params?.deviceId ?? "") +
        (search?.assetId ? `?assetId=${search.assetId}` : "")
      }
    >
      {children}
    </a>
  ),
}));

const LAST_SEEN = /^Last seen /u;
const ACTIONS_FOR = /^Actions for/u;
const NOTHING_RECEIVED =
  /^Added .*, nothing received\. Make sure it's switched on and set up with its connection key\.$/u;
const NOT_SHOWN_AGAIN = /We won't show it again/u;
const STOPS_WORKING = /current key stops working straight away/u;
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
  status: "AWAITING_FIRST_READING",
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

async function openActions(name = "PUMP-01") {
  fireEvent.click(
    await screen.findByRole("button", { name: `Actions for ${name}` })
  );
  return within(await screen.findByRole("menu"));
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

  it("opens the estate reading browser prefiltered to this asset", async () => {
    renderSection();
    expect(
      (await screen.findByRole("link", { name: "Readings" })).getAttribute(
        "href"
      )
    ).toBe("/estates/estate-id/readings/asset-id");
  });

  it("shows a newly registered device as awaiting its first reading", async () => {
    renderSection();
    const item = within(await screen.findByRole("listitem"));
    item.getByRole("heading", { name: "PUMP-01" });
    item.getByText("Waiting for first reading");
    item.getByRole("note", { name: "Sensor isn't sending readings yet" });
    item.getByText(NOTHING_RECEIVED);
    item.getByText("PT-100");
    item.getByText("Blk 101 › Plant room");
    item.getByText("Temperature (°C)");
    item.getByText("Pressure (bar)");
    item.getByText("Reports every 60 seconds");
    expect(api.GET).toHaveBeenCalledWith(DEVICES_PATH, {
      params: { path: { estateId: "estate-id", assetId: "asset-id" } },
    });
  });

  it.each([
    ["ONLINE", "Online"],
    ["OFFLINE", "Offline"],
  ] as const)(
    "shows a %s device's status and when it was last seen",
    async (status, label) => {
      const lastSeenAt = "2026-10-24T08:30:00Z";
      devices = [{ ...device, lastSeenAt, status }];
      renderSection();
      const item = within(await screen.findByRole("listitem"));
      item.getByText(label);
      const lastSeen = item.getByText(LAST_SEEN);
      expect(lastSeen.getAttribute("title")).toBe(formatDateTime(lastSeenAt));
    }
  );

  it("says when an asset has no devices, and hides registration on a deactivated asset", async () => {
    devices = [];
    renderSection(false);
    await screen.findByText("No sensors yet");
    expect(screen.queryByRole("link", { name: "Add sensor" })).toBeNull();
  });

  it("lists devices on the page, not in a card", async () => {
    renderSection();
    const item = await screen.findByRole("listitem");
    expect(item.closest("[data-slot='card']")).toBeNull();
  });
});

it("leads each header action with an icon", () => {
  serve();
  renderSection();
  expectLeadingIcon(screen.getByRole("link", { name: "Add sensor" }));
  expectLeadingIcon(screen.getByRole("link", { name: "Readings" }));
});

it("links to a dedicated device form from the asset", () => {
  serve();
  renderSection();
  expect(
    screen.getByRole<HTMLAnchorElement>("link", { name: "Add sensor" }).href
  ).toContain("/estates/estate-id/assets/asset-id/devices/new");
  expect(screen.queryByRole("textbox", { name: "Identifier" })).toBeNull();
});

it("links to the estate browser preselected to the asset, even when deactivated", () => {
  serve();
  renderSection(false);
  expect(
    screen.getByRole<HTMLAnchorElement>("link", { name: "Readings" }).href
  ).toContain("/estates/estate-id/readings/asset-id");
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
    item.getByText("No connection key");
    (await openActions()).getByRole("menuitem", {
      name: "Get connection key",
    });
  });

  it("shows when a device's credential was issued", async () => {
    devices = [{ ...device, credentialIssuedAt: issuedAt }];
    renderSection();
    const item = within(await screen.findByRole("listitem"));
    item.getByText(`Connection key created ${formatDateTime(issuedAt)}`);
    (await openActions()).getByRole("menuitem", {
      name: "Replace connection key",
    });
  });

  it("hides credential actions on a retired asset", async () => {
    devices = [
      { ...device, credentialIssuedAt: issuedAt },
      { ...device, id: "d2", identifier: "PUMP-02" },
    ];
    renderSection(false);
    await screen.findByRole("heading", { name: "PUMP-02" });
    expect(screen.queryByRole("button", { name: ACTIONS_FOR })).toBeNull();
  });

  it("generates a key and shows it once with a copy button and a warning", async () => {
    renderSection();
    fireEvent.click(
      (await openActions()).getByRole("menuitem", {
        name: "Get connection key",
      })
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
      (
        dialog.getByRole("textbox", {
          name: "Connection key",
        }) as HTMLInputElement
      ).value
    ).toBe(apiKey);
    dialog.getByText(NOT_SHOWN_AGAIN);

    fireEvent.click(dialog.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(apiKey));

    fireEvent.click(dialog.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByDisplayValue(apiKey)).toBeNull();
    await screen.findByText(
      `Connection key created ${formatDateTime(issuedAt)}`
    );
  });

  it("asks before replacing a key, warning that the current one stops working", async () => {
    devices = [{ ...device, credentialIssuedAt: issuedAt }];
    renderSection();
    fireEvent.click(
      (await openActions()).getByRole("menuitem", {
        name: "Replace connection key",
      })
    );

    const confirm = within(await screen.findByRole("dialog"));
    confirm.getByText(STOPS_WORKING);
    expect(api.POST).not.toHaveBeenCalled();

    fireEvent.click(confirm.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.POST).not.toHaveBeenCalled();

    fireEvent.click(
      (await openActions()).getByRole("menuitem", {
        name: "Replace connection key",
      })
    );
    fireEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: "Replace connection key",
      })
    );
    await waitFor(() => expect(api.POST).toHaveBeenCalledTimes(1));
    const shown = await screen.findByRole("textbox", {
      name: "Connection key",
    });
    expect((shown as HTMLInputElement).value).toBe(apiKey);
  });
});

describe("device deactivation and replacement (ID-45)", () => {
  const deactivatedAt = "2026-10-01T00:00:00Z";
  const replacement: Device = {
    ...device,
    id: "new-id",
    identifier: "PUMP-02",
    replacesDeviceId: "device-id",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    devices = [device];
    serve();
  });

  it("marks a deactivated device and offers no actions on it", async () => {
    devices = [{ ...device, deactivatedAt }];
    renderSection();
    const item = within(await screen.findByRole("listitem"));
    item.getByText(`Turned off ${formatDateTime(deactivatedAt)}`);
    expect(item.queryByText("Waiting for first reading")).toBeNull();
    expect(item.queryByRole("note")).toBeNull();
    expect(
      item.queryByRole("button", { name: "Actions for PUMP-01" })
    ).toBeNull();
  });

  it("shows which device replaced which", async () => {
    devices = [
      replacement,
      { ...device, deactivatedAt, replacedByDeviceId: "new-id" },
    ];
    renderSection();
    const [newer, older] = await screen.findAllByRole("listitem");
    within(newer).getByText("Replaces PUMP-01");
    within(older).getByText("Replaced by PUMP-02");
  });

  it("offers replacing and deactivating an active device", async () => {
    renderSection();
    const menu = await openActions();
    expect(
      menu
        .getByRole("menuitem", { name: "Replace sensor" })
        .getAttribute("href")
    ).toBe("/estates/estate-id/assets/asset-id/devices/device-id/replace");
    menu.getByRole("menuitem", { name: "Turn off sensor" });
    expect(
      menu
        .getByRole("menuitem", { name: "Turn off sensor" })
        .getAttribute("data-variant")
    ).toBe("destructive");
  });

  it("hides device actions on a retired asset", async () => {
    renderSection(false);
    const item = within(await screen.findByRole("listitem"));
    expect(
      item.queryByRole("button", { name: "Actions for PUMP-01" })
    ).toBeNull();
  });

  it("deactivates a device only after its identifier is typed exactly", async () => {
    vi.mocked(api.POST).mockImplementation((() => {
      devices = [{ ...device, deactivatedAt }];
      return Promise.resolve({
        data: devices[0],
        response: new Response(),
      });
    }) as never);
    renderSection();
    fireEvent.click(
      (await openActions()).getByRole("menuitem", {
        name: "Turn off sensor",
      })
    );
    const dialog = within(
      await screen.findByRole("dialog", { name: "Turn off PUMP-01?" })
    );
    const confirm = dialog.getByRole<HTMLButtonElement>("button", {
      name: "Turn off sensor",
    });
    fireEvent.change(dialog.getByRole("textbox", { name: "Sensor name" }), {
      target: { value: "pump-01" },
    });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(dialog.getByRole("textbox", { name: "Sensor name" }), {
      target: { value: "PUMP-01" },
    });
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(api.POST).toHaveBeenCalledWith(
        "/estates/{estateId}/assets/{assetId}/devices/{deviceId}/deactivate",
        {
          params: {
            path: {
              estateId: "estate-id",
              assetId: "asset-id",
              deviceId: "device-id",
            },
          },
          body: { identifier: "PUMP-01" },
        }
      )
    );
    await screen.findByText(`Turned off ${formatDateTime(deactivatedAt)}`);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
