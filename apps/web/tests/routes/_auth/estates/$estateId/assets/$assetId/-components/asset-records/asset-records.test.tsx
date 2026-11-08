import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { AssetRecords } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-records/asset-records";

// Each section has its own tests (and gates itself); here they mark their place.
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-history-table",
  () => ({
    InspectionHistoryTable: ({ offerCreate }: { offerCreate?: boolean }) => (
      <h2>{offerCreate ? "Inspections (offers create)" : "Inspections"}</h2>
    ),
  })
);
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-maintenance/asset-maintenance",
  () => ({ AssetMaintenance: () => <h2>Maintenance</h2> })
);
vi.mock(
  "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-documents-section/asset-documents-section",
  () => ({ AssetDocumentsSection: () => <h2>Documents</h2> })
);

it("stacks Inspections, Maintenance and Documents in that order", () => {
  renderWithProviders(<AssetRecords assetId="asset" estateId="estate" />);
  expect(
    screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)
  ).toEqual(["Inspections (offers create)", "Maintenance", "Documents"]);
});
