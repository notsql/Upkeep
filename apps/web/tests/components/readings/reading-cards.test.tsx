import { renderWithProviders, screen } from "@tests/test-utils";
import { describe, it } from "vitest";
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
  it("formats the measured time with the shared Intl helper and keeps the exact value", () => {
    renderWithProviders(<ReadingCards items={[reading]} />);
    screen.getByText("2.5 bar");
    screen.getByText(formatDateTime("2026-10-01T10:00:00Z"));
  });
});
