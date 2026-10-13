import { renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { AssetDetailsPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page";

// Sections that fetch their own data stay pending: this test is about the label.
vi.mock("@/lib/api", () => ({
  api: {
    GET: vi.fn(() => new Promise(() => undefined)),
    POST: vi.fn(),
    PATCH: vi.fn(),
  },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/estates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/estates")>()),
  useEstate: () => ({ data: { id: "estate", name: "Maple Grove" } }),
}));
vi.mock("@/lib/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assets")>()),
  useAsset: () => ({
    data: {
      id: "asset",
      name: "Carpark fan",
      reference: "MG-A0002",
      category: "HVAC",
      lifecycleVersion: 0,
    },
  }),
  useDeactivateAsset: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/lib/catalogue", () => ({
  useAssetCategories: () => ({
    data: [
      { code: "HVAC", label: "Air-con & ventilation" },
      { code: "PUMP", label: "Pump" },
    ],
  }),
}));
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-retirement-panel",
  () => ({ AssetRetirementPanel: () => null })
);
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-condition-section",
  () => ({ AssetConditionSection: () => null })
);
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices-section",
  () => ({ AssetDevicesSection: () => null })
);

it("shows the asset's category by its label, not its code", async () => {
  renderWithProviders(<AssetDetailsPage assetId="asset" estateId="estate" />);
  await screen.findByText("Air-con & ventilation");
  expect(screen.queryByText("HVAC")).toBeNull();
});
