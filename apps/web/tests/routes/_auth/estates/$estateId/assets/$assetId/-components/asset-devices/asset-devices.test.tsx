import { renderWithProviders, screen } from "@tests/test-utils";
import { beforeEach, it, vi } from "vitest";
import { AssetDevices } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices/asset-devices";

const page = vi.hoisted(() => ({
  canManageDevices: true,
  deactivatedAt: null as string | null,
}));
vi.mock("@/lib/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assets")>()),
  useAsset: () => ({
    data: { id: "asset", deactivatedAt: page.deactivatedAt },
  }),
}));
vi.mock("@/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access")>()),
  useAppAccess: () => ({
    data: {
      estates: [
        { estateId: "estate", canManageDevices: page.canManageDevices },
      ],
    },
  }),
}));
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices/asset-devices-section",
  () => ({
    AssetDevicesSection: ({ canRegister }: { canRegister: boolean }) => (
      <output>{canRegister ? "Sensors (can add)" : "Sensors"}</output>
    ),
  })
);

beforeEach(() => {
  page.canManageDevices = true;
  page.deactivatedAt = null;
});

// Adding sensors needs MANAGE_DEVICES (estate-role-permissions).
it.each([
  [true, null, "Sensors (can add)"],
  [false, null, "Sensors"],
  [true, "2026-10-01T00:00:00Z", "Sensors"],
])(
  "offers Add sensor when canManageDevices is %s and the asset retired at %s",
  (canManageDevices, deactivatedAt, text) => {
    page.canManageDevices = canManageDevices;
    page.deactivatedAt = deactivatedAt;
    renderWithProviders(<AssetDevices assetId="asset" estateId="estate" />);
    screen.getByText(text);
  }
);
