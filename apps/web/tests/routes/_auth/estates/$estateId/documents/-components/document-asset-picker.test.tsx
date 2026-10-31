import { estateId, selectAsset } from "@tests/fixtures/asset-documents";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { DocumentAssetPicker } from "@/routes/_auth/estates/$estateId/documents/-components/document-asset-picker";

const ASSET_REFERENCE = /TT-A0001/;
const ASSESSMENT_COLUMN = /condition|assessment/i;

it("puts the labelled selection checkbox in the leftmost table cell", async () => {
  renderWithProviders(
    <DocumentAssetPicker
      disabled={false}
      estateId={estateId}
      onSelect={vi.fn()}
    />
  );
  const row = within(await screen.findByRole("row", { name: ASSET_REFERENCE }));
  const cells = row.getAllByRole("cell");
  within(cells[0]).getByRole("checkbox", { name: selectAsset });
  expect(row.queryByRole("button", { name: selectAsset })).toBeNull();
});

it("shows selection, reference, name, category, location and status without an assessment column", async () => {
  renderWithProviders(
    <DocumentAssetPicker
      disabled={false}
      estateId={estateId}
      onSelect={vi.fn()}
    />
  );
  const table = within(await screen.findByRole("table"));
  expect(
    table.queryByRole("columnheader", { name: ASSESSMENT_COLUMN })
  ).toBeNull();
  expect(
    table.getAllByRole("columnheader").map((header) => header.textContent)
  ).toEqual(["Select", "Reference", "Name", "Category", "Location", "Status"]);
});
