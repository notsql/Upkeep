import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { AssetDetailsLayout } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-details-page";
import { AssetMaintenance } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-maintenance";
import { AssetOverview } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-overview";

const BACK_LINK = /^Back to/u;

const page = vi.hoisted(() => ({
  estate: {} as Record<string, unknown>,
  asset: {} as Record<string, unknown>,
  role: "MANAGER",
  canCreateInspectionResults: true,
  devices: [] as { id: string; status: string; deactivatedAt?: string }[],
  devicesEnabled: [] as boolean[],
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
  page.role = "MANAGER";
  page.canCreateInspectionResults = true;
  page.devices = [
    { id: "d1", status: "ONLINE" },
    { id: "d2", status: "OFFLINE" },
    { id: "d3", status: "DEACTIVATED", deactivatedAt: "2026-10-01T00:00:00Z" },
  ];
  page.devicesEnabled = [];
});

// Sections that fetch their own data stay pending: this test is about breadcrumbs.
vi.mock(
  "@/components/forms/date-picker",
  () => import("@tests/date-picker-stubs")
);
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-costs-section/date-range-picker",
  () => import("@tests/date-picker-stubs")
);
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
  Link: ({
    children,
    to,
    params,
    activeOptions: _activeOptions,
    ...props
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    activeOptions?: unknown;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to
      )}
      {...props}
    >
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
vi.mock("@/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access")>()),
  useAppAccess: () => ({
    isPending: false,
    isError: false,
    data: {
      estates: [
        {
          estateId: "estate",
          role: page.role,
          canViewAssets: true,
          canCreateInspectionResults: page.canCreateInspectionResults,
        },
      ],
    },
  }),
}));
vi.mock("@/lib/devices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/devices")>()),
  useDevices: (_estateId: string, _assetId: string, enabled = true) => {
    page.devicesEnabled.push(enabled);
    return { data: enabled ? page.devices : undefined };
  },
}));
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-page/asset-attention-alert",
  () => ({
    AssetAttentionAlert: ({ canInspect }: { canInspect: boolean }) => (
      <p>
        {canInspect ? "Attention banner (can inspect)" : "Attention banner"}
      </p>
    ),
  })
);
vi.mock("@/lib/catalogue", () => ({
  useAssetCategories: () => ({ data: [{ code: "PUMP", label: "Pump" }] }),
}));
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-tab/asset-retirement-panel/asset-retirement-panel",
  () => ({ AssetRetirementPanel: () => <h2>Lifecycle history</h2> })
);
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-condition-section/asset-condition-section",
  () => ({ AssetConditionSection: () => null })
);
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-devices/asset-devices-section",
  () => ({ AssetDevicesSection: () => null })
);

vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-service-interval-card",
  () => ({
    AssetServiceIntervalCard: ({ locked }: { locked?: string }) => (
      <output>{`Service interval card${locked ? `: ${locked}` : ""}`}</output>
    ),
  })
);

function renderLayout() {
  return renderWithProviders(
    <AssetDetailsLayout assetId="asset" estateId="estate">
      <p>Section content</p>
    </AssetDetailsLayout>
  );
}

it("starts asset detail breadcrumbs at Assets, without back links", () => {
  renderLayout();
  const breadcrumbs = within(
    screen.getByRole("navigation", { name: "Breadcrumbs" })
  );
  expect(
    breadcrumbs.getAllByRole("link").map((link) => link.textContent)
  ).toEqual(["Assets"]);
  expect(screen.queryByRole("link", { name: BACK_LINK })).toBeNull();
});

it("links each asset section as its own page under one header", () => {
  renderLayout();
  screen.getByRole("heading", { level: 1, name: "Water pump" });
  const nav = within(
    screen.getByRole("navigation", { name: "Asset sections" })
  );
  expect(
    nav
      .getAllByRole("link")
      .map((link) => [link.textContent, link.getAttribute("href")])
  ).toEqual([
    ["Overview", "/estates/estate/assets/asset"],
    ["History", "/estates/estate/assets/asset/history"],
    ["Details", "/estates/estate/assets/asset/details"],
    ["Records", "/estates/estate/assets/asset/records"],
    ["Costs", "/estates/estate/assets/asset/costs"],
    ["Sensors 2", "/estates/estate/assets/asset/devices"],
  ]);
  screen.getByText("Section content");
  expect(screen.queryByRole("tablist")).toBeNull();
});

it("counts the asset's active devices on the Devices tab", () => {
  renderLayout();
  const nav = within(
    screen.getByRole("navigation", { name: "Asset sections" })
  );
  const devices = nav.getByRole("link", { name: "Sensors 2" });
  within(devices).getByText("2");
});

it("hides the device count when the asset has no active devices", () => {
  page.devices = [];
  renderLayout();
  const nav = within(
    screen.getByRole("navigation", { name: "Asset sections" })
  );
  nav.getByRole("link", { name: "Sensors" });
});

it("neither counts nor requests devices for a viewer who cannot see them", () => {
  page.role = "CREW";
  renderLayout();
  const nav = within(
    screen.getByRole("navigation", { name: "Asset sections" })
  );
  nav.getByRole("link", { name: "Sensors" });
  expect(page.devicesEnabled.every((enabled) => !enabled)).toBe(true);
});

it("keeps only the title, status and reference in the header", () => {
  renderLayout();
  screen.getByRole("heading", { level: 1, name: "Water pump" });
  screen.getByText("MG-A0001");
  expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  expect(
    screen.queryByRole("link", { name: "Create inspection record" })
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Take out of use" })).toBeNull();
});

it("shows the attention banner under the header, above the tabs", () => {
  renderLayout();
  const title = screen.getByRole("heading", { level: 1, name: "Water pump" });
  const banner = screen.getByText("Attention banner (can inspect)");
  const nav = screen.getByRole("navigation", { name: "Asset sections" });
  const all = [...document.body.querySelectorAll("*")];
  const order = [title, banner, nav].map((el) => all.indexOf(el));
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

it.each([
  ["a retired asset", { deactivatedAt: "2026-10-01T00:00:00Z" }, {}, true],
  ["an inactive estate", {}, { deactivatedAt: "2026-10-01T00:00:00Z" }, true],
  ["a viewer who cannot create inspections", {}, {}, false],
])(
  "offers no inspection from the banner on %s",
  (_name, asset, estate, can) => {
    page.asset = { ...page.asset, ...asset };
    page.estate = { ...page.estate, ...estate };
    page.canCreateInspectionResults = can;
    renderLayout();
    screen.getByText("Attention banner");
  }
);

it("no longer shows lifecycle history under Records", () => {
  renderWithProviders(<AssetMaintenance assetId="asset" estateId="estate" />);
  expect(
    screen.queryByRole("heading", { name: "Lifecycle history" })
  ).toBeNull();
});

it("shows the asset's details on the overview", () => {
  renderWithProviders(<AssetOverview assetId="asset" estateId="estate" />);
  screen.getByRole("list", { name: "Asset details" });
  expect(screen.queryByRole("region", { name: "Details" })).toBeNull();
});

it.each([
  [{ owned: true }, true],
  [{ owned: false, canManageInvitationPermissions: true }, true],
  [{ owned: false, canManageInvitationPermissions: false }, false],
])("shows the service interval to Managers only (%o)", (access, shown) => {
  page.estate = { ...page.estate, ...access };
  renderWithProviders(<AssetMaintenance assetId="asset" estateId="estate" />);
  expect(screen.queryByText("Service interval card") !== null).toBe(shown);
});

it.each([
  [
    { deactivatedAt: "2026-10-01T00:00:00Z" },
    {},
    "This asset is out of use, so you can't change how often it's serviced.",
  ],
  [
    {},
    { deactivatedAt: "2026-10-01T00:00:00Z" },
    "This estate is inactive, so its service intervals cannot be changed.",
  ],
])("locks the service interval with a reason", (asset, estate, reason) => {
  page.asset = { ...page.asset, ...asset };
  page.estate = { ...page.estate, owned: true, ...estate };
  renderWithProviders(<AssetMaintenance assetId="asset" estateId="estate" />);
  screen.getByText(`Service interval card: ${reason}`);
});
