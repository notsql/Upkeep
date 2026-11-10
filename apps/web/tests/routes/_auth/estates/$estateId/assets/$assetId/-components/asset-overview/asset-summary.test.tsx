import { renderWithProviders, screen, within } from "@tests/test-utils";
import { afterEach, expect, it, vi } from "vitest";
import type { Asset } from "@/lib/assets";
import { AssetSummary } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/asset-summary";

vi.mock("@/lib/catalogue", () => ({
  useAssetCategories: () => ({ data: [{ code: "PUMP", label: "Pump" }] }),
}));

const asset = {
  id: "asset",
  name: "Water Pump",
  reference: "MG-A0001",
  category: "PUMP",
  locationPath: "10 › B2",
  installedOn: "2026-11-01",
  manufacturer: "Schneider Electric",
  model: "T1000",
  lifecycleVersion: 0,
} as unknown as Asset;

const desktopWidth = window.innerWidth;
afterEach(() => {
  window.innerWidth = desktopWidth;
});

function visibleLabels(): string[] {
  const list = screen.getByRole("list", { name: "Asset details" });
  return within(list)
    .getAllByRole("listitem")
    .map((item) => item.querySelector("span"))
    .filter((label) => label && !label.classList.contains("sr-only"))
    .map((label) => label?.textContent ?? "");
}

it("labels every detail on mobile so the wrapped items read on their own", async () => {
  window.innerWidth = 375;
  renderWithProviders(<AssetSummary asset={asset} />);
  await screen.findByText("Pump");
  expect(visibleLabels()).toEqual([
    "Category",
    "Location",
    "Installed",
    "Make and model",
  ]);
});

it("keeps the one-line summary on desktop", async () => {
  window.innerWidth = 1280;
  renderWithProviders(<AssetSummary asset={asset} />);
  await screen.findByText("Pump");
  expect(visibleLabels()).toEqual(["Installed"]);
});
