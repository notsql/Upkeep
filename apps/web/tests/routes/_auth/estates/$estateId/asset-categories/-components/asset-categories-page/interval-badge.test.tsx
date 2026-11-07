import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it } from "vitest";
import { IntervalBadge } from "@/routes/_auth/estates/$estateId/asset-categories/-components/asset-categories-page/interval-badge";

function badge(text: string) {
  return screen.getByText(text);
}

it("says the interval in words", () => {
  renderWithProviders(
    <>
      <IntervalBadge interval={{ value: 14, unit: "DAY" }} />
      <IntervalBadge interval={{ value: 6, unit: "MONTH" }} />
      <IntervalBadge interval={{ value: 1, unit: "YEAR" }} />
      <IntervalBadge interval={null} />
    </>
  );
  badge("Every 14 days");
  badge("Every 6 months");
  badge("Every 1 year");
  badge("Not set");
});

it("gives each unit its own colour and leaves Not set plain", () => {
  renderWithProviders(
    <>
      <IntervalBadge interval={{ value: 14, unit: "DAY" }} />
      <IntervalBadge interval={{ value: 6, unit: "MONTH" }} />
      <IntervalBadge interval={{ value: 2, unit: "YEAR" }} />
      <IntervalBadge interval={null} />
    </>
  );
  const colours = ["Every 14 days", "Every 6 months", "Every 2 years"].map(
    (text) => badge(text).className
  );
  expect(new Set(colours).size).toBe(3);
  expect(badge("Not set").getAttribute("data-variant")).toBe("outline");
  for (const colour of colours) {
    expect(colour).not.toBe(badge("Not set").className);
  }
});
