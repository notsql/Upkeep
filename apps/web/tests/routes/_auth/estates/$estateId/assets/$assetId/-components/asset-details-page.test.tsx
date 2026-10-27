import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { AssetDetailsPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page";

// Sections that fetch their own data stay pending: this test is about breadcrumbs.
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
      name: "Water pump",
      reference: "MG-A0001",
      category: "PUMP",
      lifecycleVersion: 0,
    },
  }),
  useDeactivateAsset: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/lib/catalogue", () => ({
  useAssetCategories: () => ({ data: [{ code: "PUMP", label: "Pump" }] }),
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

it("shows the asset's maintenance costs", async () => {
  renderWithProviders(<AssetDetailsPage assetId="asset" estateId="estate" />);
  await screen.findByRole("region", { name: "Maintenance costs" });
});
