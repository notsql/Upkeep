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
import { NewDevicePage } from "@/routes/_auth/estates/$estateId/assets/$assetId/devices/new/-components/new-device-page";

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
  status: "AWAITING_FIRST_READING",
  createdAt: at,
  updatedAt: at,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.GET).mockImplementation((path) => {
    let data: unknown = locations;
    if (path === "/estates/{id}") {
      data = { name: "Maple Grove", owned: true };
    }
    if (path === "/estates/{estateId}/assets/{id}") {
      data = { name: "Water pump", reference: "E-A0001", locationId: "plant" };
    }
    return Promise.resolve({ data, response: new Response() }) as never;
  });
});
it("registers a device and returns to the asset", async () => {
  vi.mocked(api.POST).mockImplementation((() =>
    Promise.resolve({ data: device, response: new Response() })) as never);
  renderWithProviders(
    <NewDevicePage assetId="asset-id" estateId="estate-id" />
  );
  await screen.findByRole("heading", { name: "Register device", level: 1 });
  await screen.findByRole("button", { name: "Cancel" });
  // The asset's location shows by its path once the locations have loaded.
  await waitFor(() =>
    within(screen.getByRole("combobox", { name: "Location" })).getByText(
      "Blk 101 › Plant room"
    )
  );
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
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledWith({
      to: "/estates/$estateId/assets/$assetId",
      params: { estateId: "estate-id", assetId: "asset-id" },
    })
  );
});
it.each(["shared", "inactive estate", "retired asset"])(
  "prevents direct device registration for %s",
  async (state) => {
    vi.mocked(api.GET).mockImplementation(
      async (path) =>
        ({
          data:
            path === "/estates/{id}"
              ? {
                  owned: state !== "shared",
                  deactivatedAt: state === "inactive estate" ? at : undefined,
                }
              : {
                  name: "Water pump",
                  locationId: "plant",
                  deactivatedAt: state === "retired asset" ? at : undefined,
                },
          response: new Response(),
        }) as never
    );
    renderWithProviders(
      <NewDevicePage assetId="asset-id" estateId="estate-id" />
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "cannot register"
    );
    expect(screen.queryByRole("textbox", { name: "Identifier" })).toBeNull();
  }
);
it("cancels registration and returns to the asset without saving", async () => {
  renderWithProviders(
    <NewDevicePage assetId="asset-id" estateId="estate-id" />
  );
  fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
  expect(navigate).toHaveBeenCalledWith({
    to: "/estates/$estateId/assets/$assetId",
    params: { estateId: "estate-id", assetId: "asset-id" },
  });
  expect(api.POST).not.toHaveBeenCalled();
});
