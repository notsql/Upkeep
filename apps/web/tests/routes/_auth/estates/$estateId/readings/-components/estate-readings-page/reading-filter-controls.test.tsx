import { renderWithProviders, screen, within } from "@tests/test-utils";
import { describe, expect, it, vi } from "vitest";
import { ReadingFilterControls } from "@/routes/_auth/estates/$estateId/readings/-components/estate-readings-page/reading-filter-controls";

const FROM = /^From/u;
const TO = /^To \(exclusive\)/u;

describe("ReadingFilterControls", () => {
  it("gives From and To a labelled date button and labelled hour and minute selects", () => {
    renderWithProviders(
      <ReadingFilterControls
        filters={{ from: "2026-10-01T08:30" }}
        onFiltersChange={vi.fn()}
      />
    );
    const from = screen.getByRole("button", { name: FROM });
    expect(from.textContent).toContain("1 Oct 2026");
    const fromTime = screen.getByRole("group", { name: "From time" });
    expect(
      within(fromTime).getByRole("combobox", { name: "From hour" }).textContent
    ).toContain("08");
    within(fromTime).getByRole("combobox", { name: "From minute" });

    const to = screen.getByRole("button", { name: TO });
    expect(to.textContent).toContain("Pick a date");
    const toTime = screen.getByRole("group", { name: "To (exclusive) time" });
    within(toTime).getByRole("combobox", { name: "To (exclusive) hour" });
    within(toTime).getByRole("combobox", { name: "To (exclusive) minute" });
  });

  it("groups the flag checkboxes under one label", () => {
    renderWithProviders(
      <ReadingFilterControls filters={{}} onFiltersChange={vi.fn()} />
    );
    const flags = screen.getByRole("group", { name: "Flags" });
    within(flags).getByRole("checkbox", { name: "Suspect only" });
    within(flags).getByRole("checkbox", { name: "Anomalous only" });
  });
});
