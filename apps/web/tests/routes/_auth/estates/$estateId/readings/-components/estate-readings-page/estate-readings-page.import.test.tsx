import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EstateReadingsPage } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/estate-readings-page";

const INACTIVE_ESTATE =
  /inactive estate|estate is inactive|estate is deactivated/iu;
const BATCH_REFERENCE = /batch-001/u;
const MISSING_RECORDER = /Name unavailable/u;

const { get, context } = vi.hoisted(() => ({
  get: vi.fn(),
  context: {
    canImport: true,
    canRead: true,
    canRecord: true,
    inactive: false,
    mobile: false,
  },
}));

vi.mock("@/lib/api", () => ({ api: { GET: get } }));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@/lib/use-mobile", () => ({ useMobile: () => context.mobile }));
vi.mock("@/lib/access", () => ({
  useAppAccess: () => ({
    data: {
      estates: [
        {
          estateId: "estate",
          estateName: "Maple Estate",
          deactivatedAt: context.inactive ? "2026-10-31T00:00:00Z" : null,
          canViewReadings: context.canRead,
          canRecordReadings: context.canRecord,
          canImportReadings: context.canImport,
          canRevertReadingImports: context.canImport,
        },
      ],
    },
  }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const imported = {
  id: "imported-reading",
  assetId: "asset",
  assetReference: "PUMP-001",
  assetName: "Water pump",
  metric: "TEMPERATURE",
  measuredAt: "2026-10-01T00:00:00Z",
  recordedAt: "2026-11-01T00:00:00Z",
  value: 151.123_456,
  valueText: "151.123456",
  unit: "°C",
  source: "IMPORT",
  sourceLabel: "Vendor A — October 2026 extract",
  importBatchId: "batch-001",
  deviceId: null,
  deviceIdentifier: null,
  recordedByUserId: null,
  recordedByName: null,
  flags: [{ type: "OUT_OF_RANGE", validMin: -40, validMax: 150 }],
};

function show() {
  return renderWithProviders(
    <EstateReadingsPage
      estateId="estate"
      filters={{}}
      onFiltersChange={vi.fn()}
    />
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(context, {
    canImport: true,
    canRead: true,
    canRecord: true,
    inactive: false,
    mobile: false,
  });
  get.mockImplementation((path: string) =>
    Promise.resolve({
      data: {
        items: path.endsWith("/assets")
          ? [
              {
                id: "asset",
                reference: "PUMP-001",
                name: "Water pump",
                retired: false,
              },
            ]
          : [imported],
        page: 0,
        size: 50,
        totalItems: 1,
      },
      response: new Response(),
    })
  );
});

describe("historical import on the Readings page", () => {
  it("offers Import CSV alongside Export CSV without restoring manual entry", async () => {
    show();
    await screen.findByRole("table", { name: "Readings" });
    expect(
      screen.getByRole("link", { name: "Import CSV" }).getAttribute("href")
    ).toBe("/estates/$estateId/readings/imports");
    expect(screen.queryByRole("link", { name: "Create" })).toBeNull();
    screen.getByRole("button", { name: "Export CSV" });
  });

  it("uses the import capability independently of manual-entry permission", async () => {
    context.canRecord = false;
    show();
    await screen.findByRole("table", { name: "Readings" });
    screen.getByRole("link", { name: "Import CSV" });
    expect(screen.queryByRole("link", { name: "Create" })).toBeNull();
  });

  it("does not grant bulk import merely because Crew can record readings", async () => {
    context.canImport = false;
    show();
    await screen.findByRole("table", { name: "Readings" });
    expect(screen.queryByRole("link", { name: "Create" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Import CSV" })).toBeNull();
  });

  it("explains why import is unavailable for an inactive estate", async () => {
    context.inactive = true;
    context.canImport = false;
    context.canRecord = false;
    show();
    await screen.findByRole("table", { name: "Readings" });
    expect(screen.queryByRole("link", { name: "Import CSV" })).toBeNull();
    screen.getByText(INACTIVE_ESTATE);
  });

  it.each([false, true])(
    "shows import source, batch provenance and warnings with mobile=%s",
    async (mobile) => {
      context.mobile = mobile;
      show();
      const results = await screen.findByRole(mobile ? "list" : "table", {
        name: "Readings",
      });
      within(results).getByText("Import");
      within(results).getByText(imported.sourceLabel);
      within(results).getByText(BATCH_REFERENCE);
      within(results).getByText("151.123456 °C");
      within(results).getByText("Outside normal range (-40 to 150 °C)");
      expect(within(results).queryByText("Sensor")).toBeNull();
      expect(within(results).queryByText("Manual")).toBeNull();
      expect(within(results).queryByText(MISSING_RECORDER)).toBeNull();
    }
  );

  it("removes the import action as soon as its capability is revoked", async () => {
    const view = show();
    await screen.findByRole("table", { name: "Readings" });
    screen.getByRole("link", { name: "Import CSV" });
    context.canImport = false;
    view.rerender(
      <EstateReadingsPage
        estateId="estate"
        filters={{}}
        onFiltersChange={vi.fn()}
      />
    );
    expect(screen.queryByRole("link", { name: "Import CSV" })).toBeNull();
  });
});
