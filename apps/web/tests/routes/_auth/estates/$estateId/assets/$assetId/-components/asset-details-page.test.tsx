import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { AssetDetailsPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page";
import {
  renderWithProviders,
  screen,
  within,
} from "../../../../../../../test-utils";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/estates", () => ({
  useEstate: () => ({ data: { id: "estate", name: "Maple Grove" } }),
}));
vi.mock("@/lib/assets", () => ({
  useAsset: () => ({
    data: {
      id: "asset",
      name: "Water pump",
      reference: "MG-A0001",
      category: "PUMP",
      lifecycleVersion: 0,
    },
  }),
  useDeactivateAsset: () => ({ mutateAsync: vi.fn() }),
  assetCategoryLabel: { PUMP: "Pump" },
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

it("names the owning estate in asset detail breadcrumbs", async () => {
  renderWithProviders(<AssetDetailsPage assetId="asset" estateId="estate" />);
  const breadcrumbs = within(
    screen.getByRole("navigation", { name: "Breadcrumbs" })
  );
  await breadcrumbs.findByRole("link", { name: "Maple Grove" });
  expect(breadcrumbs.queryByRole("link", { name: "Estate" })).toBeNull();
});
