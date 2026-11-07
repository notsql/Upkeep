import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import type { ReadingSearch } from "@/lib/reading-filters";
import type { EstateReading } from "@/lib/readings";
import { AssetReadingsPage } from "@/routes/_auth/estates/$estateId/assets/$assetId/readings/-components/asset-readings-page";

vi.mock("@/lib/api", () => ({ api: { GET: vi.fn() } }));
vi.mock(
  "@/components/forms/date-time-picker",
  () => import("@tests/date-picker-stubs")
);
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "manager" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string | undefined>;
  }) => (
    <a
      href={
        to.replace("$assetId", params?.assetId ?? "$assetId") +
        (search?.assetId ? `?assetId=${search.assetId}` : "")
      }
    >
      {children}
    </a>
  ),
}));
vi.mock("@/lib/assets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/assets")>()),
  useAsset: () => ({
    data: { id: "11111111-1111-4111-8111-111111111111", name: "Water pump" },
  }),
}));
const access = vi.hoisted(() => ({ canRecord: false }));
vi.mock("@/lib/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/access")>()),
  useAppAccess: () => ({
    data: {
      estates: [
        {
          estateId: "estate-id",
          canViewReadings: true,
          canRecordReadings: access.canRecord,
        },
      ],
    },
  }),
}));

const ASSET = "11111111-1111-4111-8111-111111111111";
const ESTATE_READINGS = "/estates/{estateId}/readings";
const LEGACY_READINGS = "/estates/{estateId}/assets/{assetId}/readings";

const reading: EstateReading = {
  id: "r1",
  assetId: ASSET,
  assetReference: "MG-A0001",
  assetName: "Water pump",
  measuredAt: "2026-10-01T08:00:00Z",
  metric: "TEMPERATURE",
  unit: "°C",
  value: 151.5,
  deviceId: "d1",
  deviceIdentifier: "PUMP-01",
  flags: [{ type: "DUPLICATE_TIMESTAMP" }],
  source: "SENSOR",
  recordedByUserId: null,
  recordedByName: null,
  recordedAt: "2026-10-01T08:00:01Z",
};

function renderPage(filters: ReadingSearch = {}) {
  const change = vi.fn();
  renderWithProviders(
    <AssetReadingsPage
      assetId={ASSET}
      estateId="estate-id"
      filters={filters}
      onFiltersChange={change}
    />
  );
  return change;
}

beforeEach(() => {
  vi.mocked(api.GET).mockReset();
  vi.mocked(api.GET).mockResolvedValue({
    data: { items: [reading], page: 0, size: 50, totalItems: 1 },
    response: new Response(),
  } as never);
});

describe("AssetReadingsPage", () => {
  it("lists this asset's readings from the estate readings endpoint", async () => {
    renderPage({ metric: "TEMPERATURE" });
    const table = await screen.findByRole("table", { name: "Readings" });
    within(table).getByText("151.5 °C");
    within(table).getByText("Duplicate timestamp");
    const calls = vi.mocked(api.GET).mock.calls as unknown[][];
    expect(calls.some(([path]) => path === LEGACY_READINGS)).toBe(false);
    const call = calls.find(([path]) => path === ESTATE_READINGS);
    const options = call?.[1] as
      | { params: { query: Record<string, unknown> } }
      | undefined;
    expect(options?.params.query.assetId).toBe(ASSET);
    expect(options?.params.query.metric).toBe("TEMPERATURE");
  });

  it("offers CSV export", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Export CSV" });
  });

  it("has no asset picker, since the asset is fixed", async () => {
    renderPage();
    await screen.findByRole("table", { name: "Readings" });
    expect(screen.queryByText("All assets")).toBeNull();
  });

  it("links Create to a reading for this asset when the user can record", async () => {
    access.canRecord = true;
    renderPage();
    const create = await screen.findByRole("link", { name: "Create" });
    expect(create.getAttribute("href")).toBe(
      `/estates/$estateId/readings/${ASSET}/new`
    );
  });

  it("filters by suspect only without carrying the asset into the URL", async () => {
    const change = renderPage();
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Suspect only" })
    );
    expect(change).toHaveBeenCalledWith({ suspect: true, page: undefined });
  });
});
