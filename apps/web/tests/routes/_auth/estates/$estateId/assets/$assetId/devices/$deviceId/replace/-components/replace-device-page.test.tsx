import { fireEvent } from "@testing-library/react";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { Device } from "@/lib/devices";
import type { Location } from "@/lib/locations";
import { ReplaceDevicePage } from "@/routes/_auth/estates/$estateId/assets/$assetId/devices/$deviceId/replace/-components/replace-device-page";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const WILL_BE_DEACTIVATED =
  /PUMP-01 will be deactivated and its key will stop working/;
const at = "2026-10-22T00:00:00Z";
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
const old: Device = {
  id: "device-id",
  estateId: "estate-id",
  assetId: "asset-id",
  locationId: "plant",
  identifier: "PUMP-01",
  model: "PT-100",
  metrics: [{ metric: "PRESSURE", unit: "bar" }],
  reportingIntervalSeconds: 300,
  createdAt: at,
  updatedAt: at,
};
let devices: Device[];
const backToAsset = {
  to: "/estates/$estateId/assets/$assetId",
  params: { estateId: "estate-id", assetId: "asset-id" },
};

function renderPage() {
  renderWithProviders(
    <ReplaceDevicePage
      assetId="asset-id"
      deviceId="device-id"
      estateId="estate-id"
    />
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  devices = [old];
  vi.mocked(api.GET).mockImplementation((path) => {
    let data: unknown = locations;
    if (path === "/estates/{id}") {
      data = { name: "Maple Grove", owned: true };
    }
    if (path === "/estates/{estateId}/assets/{id}") {
      data = { name: "Water pump", locationId: "b1" };
    }
    if (path === "/estates/{estateId}/assets/{assetId}/devices") {
      data = devices;
    }
    return Promise.resolve({ data, response: new Response() }) as never;
  });
});

it("replaces a device with a new one that starts from the old device's details", async () => {
  vi.mocked(api.POST).mockResolvedValue({
    data: { ...old, id: "new-id", identifier: "PUMP-02" },
    response: new Response(),
  } as never);
  renderPage();
  await screen.findByRole("heading", { name: "Replace PUMP-01", level: 1 });
  await waitFor(() =>
    within(screen.getByRole("combobox", { name: "Location" })).getByText(
      "Blk 101 › Plant room"
    )
  );
  screen.getByText(WILL_BE_DEACTIVATED);
  fireEvent.change(screen.getByRole("textbox", { name: "Identifier" }), {
    target: { value: "PUMP-02" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Replace device" }));

  await waitFor(() =>
    expect(api.POST).toHaveBeenCalledWith(
      "/estates/{estateId}/assets/{assetId}/devices/{deviceId}/replace",
      {
        params: {
          path: {
            estateId: "estate-id",
            assetId: "asset-id",
            deviceId: "device-id",
          },
        },
        body: {
          identifier: "PUMP-02",
          model: "PT-100",
          locationId: "plant",
          metrics: ["PRESSURE"],
          reportingIntervalSeconds: 300,
        },
      }
    )
  );
  await waitFor(() => expect(navigate).toHaveBeenCalledWith(backToAsset));
});

it("does not offer replacing a device that is already deactivated", async () => {
  devices = [{ ...old, deactivatedAt: at }];
  renderPage();
  expect((await screen.findByRole("alert")).textContent).toContain(
    "already deactivated"
  );
  expect(screen.queryByRole("textbox", { name: "Identifier" })).toBeNull();
});

it("cancels and returns to the asset without replacing anything", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(navigate).toHaveBeenCalledWith(backToAsset);
  expect(api.POST).not.toHaveBeenCalled();
});
