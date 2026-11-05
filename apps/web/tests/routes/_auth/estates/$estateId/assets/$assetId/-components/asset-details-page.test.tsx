import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { AssetDetailsPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page";

const BACK_LINK = /^Back to/u;

const page = vi.hoisted(() => ({
  estate: {} as Record<string, unknown>,
  asset: {} as Record<string, unknown>,
}));

beforeEach(() => {
  page.estate = { id: "estate", name: "Maple Grove" };
  page.asset = {
    id: "asset",
    name: "Water pump",
    reference: "MG-A0001",
    category: "PUMP",
    lifecycleVersion: 0,
  };
});

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
  useEstate: () => ({ data: page.estate }),
}));
vi.mock("@/lib/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assets")>()),
  useAsset: () => ({ data: page.asset }),
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

vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-service-interval-card",
  () => ({
    AssetServiceIntervalCard: ({ locked }: { locked?: string }) => (
      <output>{`Service interval card${locked ? `: ${locked}` : ""}`}</output>
    ),
  })
);

it("starts asset detail breadcrumbs at Assets, without back links", () => {
  renderWithProviders(<AssetDetailsPage assetId="asset" estateId="estate" />);
  const breadcrumbs = within(
    screen.getByRole("navigation", { name: "Breadcrumbs" })
  );
  expect(
    breadcrumbs.getAllByRole("link").map((link) => link.textContent)
  ).toEqual(["Assets"]);
  expect(screen.queryByRole("link", { name: BACK_LINK })).toBeNull();
});

it("shows the asset's maintenance costs", async () => {
  renderWithProviders(<AssetDetailsPage assetId="asset" estateId="estate" />);
  await screen.findByRole("region", { name: "Maintenance costs" });
});

it.each([
  [{ owned: true }, true],
  [{ owned: false, canManageInvitationPermissions: true }, true],
  [{ owned: false, canManageInvitationPermissions: false }, false],
])("shows the service interval to Managers only (%o)", (access, shown) => {
  page.estate = { ...page.estate, ...access };
  renderWithProviders(<AssetDetailsPage assetId="asset" estateId="estate" />);
  expect(screen.queryByText("Service interval card") !== null).toBe(shown);
});

it.each([
  [
    { deactivatedAt: "2026-10-01T00:00:00Z" },
    {},
    "This asset is retired, so its service interval cannot be changed.",
  ],
  [
    {},
    { deactivatedAt: "2026-10-01T00:00:00Z" },
    "This estate is inactive, so its service intervals cannot be changed.",
  ],
])("locks the service interval with a reason", (asset, estate, reason) => {
  page.asset = { ...page.asset, ...asset };
  page.estate = { ...page.estate, owned: true, ...estate };
  renderWithProviders(<AssetDetailsPage assetId="asset" estateId="estate" />);
  screen.getByText(`Service interval card: ${reason}`);
});
