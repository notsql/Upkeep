import { mockMobileViewport } from "@tests/mock-viewport";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { beforeEach, expect, it } from "vitest";
import { formatDateTime } from "@/lib/format";
import type { ReadingGroup } from "@/lib/readings";
import { GroupedReadingsTable } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/grouped-readings/grouped-readings-table";

beforeEach(() => {
  mockMobileViewport();
});

const group = {
  measuredAt: "2026-10-01T10:00:00Z",
  source: "MANUAL",
  recordedByName: "Alex Tan",
  metrics: [
    {
      readingId: "r1",
      metric: "TEMPERATURE",
      value: 21.5,
      unit: "°C",
      flags: [],
    },
    {
      readingId: "r2",
      metric: "PRESSURE",
      value: 2,
      unit: "bar",
      flags: [{ type: "GAP", gapSeconds: 3600 }],
    },
  ],
} as unknown as ReadingGroup;

it("lists each reading time on phones with values first and flags trailing", () => {
  renderWithProviders(
    <GroupedReadingsTable
      groups={[group]}
      label="Latest readings"
      refreshing={false}
    />
  );
  expect(screen.queryByRole("table")).toBeNull();
  const list = within(screen.getByRole("list", { name: "Latest readings" }));
  const item = within(list.getByRole("listitem"));
  item.getByText("Temperature");
  item.getByText("21.5 °C");
  item.getByText("Pressure");
  item.getByText("2.00 bar");
  item.getByText(formatDateTime("2026-10-01T10:00:00Z"));
  item.getByText("Manual · Alex Tan");
  item.getByText("Gap");
});
