import { renderWithProviders, screen, within } from "@tests/test-utils";
import { describe, expect, it } from "vitest";
import { ReadingCards } from "@/components/readings/reading-cards";
import { formatDateTime } from "@/lib/format";
import type { AssetReading } from "@/lib/readings";

const reading = {
  id: "r1",
  metric: "PRESSURE",
  value: 2.5,
  unit: "bar",
  measuredAt: "2026-10-01T10:00:00Z",
  source: "SENSOR",
  deviceIdentifier: "PUMP-01",
  flags: [],
} as unknown as AssetReading;

describe("ReadingCards", () => {
  it("renders each reading as a list item with the value as the title", () => {
    renderWithProviders(
      <ReadingCards
        items={[
          {
            ...reading,
            assetName: "Water pump",
            assetReference: "PUMP-001",
          } as unknown as AssetReading,
        ]}
      />
    );
    const item = within(
      within(screen.getByRole("list", { name: "Readings" })).getByRole(
        "listitem"
      )
    );
    expect(
      item.getByText("2.5 bar").closest("[data-slot=item-title]")
    ).not.toBeNull();
    item.getByText("Pressure");
    item.getByText("Water pump");
    item.getByText("PUMP-001");
    item.getByText("Sensor");
    item.getByText("PUMP-01");
    expect(document.querySelector("[data-slot=card]")).toBeNull();
  });

  it("formats the measured time with the shared Intl helper and keeps the exact value", () => {
    renderWithProviders(<ReadingCards items={[reading]} />);
    screen.getByText("2.5 bar");
    screen.getByText(formatDateTime("2026-10-01T10:00:00Z"));
  });

  it("colours each flag by its status tone", () => {
    renderWithProviders(
      <ReadingCards
        items={[
          {
            ...reading,
            flags: [
              { type: "GAP", gapSeconds: 3600 },
              { type: "DUPLICATE_TIMESTAMP" },
            ],
          } as unknown as AssetReading,
        ]}
      />
    );
    expect(
      screen.getByText("Sent twice for the same time").dataset.variant
    ).toBe("warning");
  });
});
