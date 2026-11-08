import { fireEvent } from "@testing-library/react";
import { expectLeadingIcon } from "@tests/section-action";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate } from "@/lib/format";
import { AssetDetailsTab } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-tab/asset-details-tab";

vi.mock(
  "@/components/forms/date-picker",
  () => import("@tests/date-picker-stubs")
);
vi.mock("@/lib/api", () => ({
  api: { GET: vi.fn(() => new Promise(() => undefined)), POST: vi.fn() },
}));
vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
  useAuth: () => ({ user: { id: "owner" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    className?: string;
  }) => (
    <a
      className={className}
      href={to
        .replace("$estateId", params?.estateId ?? "")
        .replace("$assetId", params?.assetId ?? "")}
    >
      {children}
    </a>
  ),
}));

const page = vi.hoisted(() => ({
  asset: {} as Record<string, unknown>,
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
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-details-tab/asset-retirement-panel/asset-retirement-panel",
  () => ({ AssetRetirementPanel: () => <h2>Lifecycle history</h2> })
);

beforeEach(() => {
  page.asset = {
    id: "asset",
    estateId: "estate",
    name: "Water pump",
    reference: "MG-A0001",
    category: "PUMP",
    locationPath: "Blk 1 › Plant room",
    installedOn: "2024-05-01",
    manufacturer: "Grundfos",
    model: "CR 10",
    serialNumber: null,
    createdAt: "2024-05-02T01:00:00Z",
    lifecycleVersion: 0,
  };
});

function tab() {
  renderWithProviders(<AssetDetailsTab assetId="asset" estateId="estate" />);
}

function detail(list: HTMLElement, term: string): string | null | undefined {
  const dt = within(list).getByText(term, { selector: "dt" });
  return dt.nextElementSibling?.textContent;
}

describe("AssetDetailsTab", () => {
  it("lists the asset's recorded details", () => {
    tab();
    const region = screen.getByRole("region", { name: "Details" });
    const list = region;
    expect(detail(list, "Reference")).toBe("MG-A0001");
    expect(detail(list, "Category")).toBe("Pump");
    expect(detail(list, "Location")).toBe("Blk 1 › Plant room");
    expect(detail(list, "Installation date")).toBe(formatDate("2024-05-01"));
    expect(detail(list, "Manufacturer")).toBe("Grundfos");
    expect(detail(list, "Model")).toBe("CR 10");
    expect(detail(list, "Serial number")).toBe("Not recorded");
  });

  it("links Edit to the edit page in the section header", () => {
    tab();
    const region = screen.getByRole("region", { name: "Details" });
    expect(
      within(region).getByRole("link", { name: "Edit" }).getAttribute("href")
    ).toBe("/estates/estate/assets/asset/edit");
    expectLeadingIcon(within(region).getByRole("link", { name: "Edit" }));
  });

  it("offers retirement in a danger zone that opens the confirmation", () => {
    tab();
    const zone = screen.getByRole("region", { name: "Retire asset" });
    fireEvent.click(within(zone).getByRole("button", { name: "Retire asset" }));
    screen.getByRole("dialog", { name: "Retire Water pump?" });
  });

  it("keeps the lifecycle history with the details", () => {
    tab();
    screen.getByRole("heading", { name: "Lifecycle history" });
  });

  it("offers neither Edit nor Retire on a retired asset", () => {
    page.asset = { ...page.asset, deactivatedAt: "2026-10-01T00:00:00Z" };
    tab();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Retire asset" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retire asset" })).toBeNull();
    screen.getByRole("heading", { name: "Lifecycle history" });
  });
});
