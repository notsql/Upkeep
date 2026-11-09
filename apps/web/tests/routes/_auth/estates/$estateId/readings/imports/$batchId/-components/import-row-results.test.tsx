import { renderWithProviders, screen } from "@tests/test-utils";
import { describe, expect, it } from "vitest";
import type { ReadingImportRow } from "@/lib/reading-imports";
import { ImportRowResults } from "@/routes/_auth/estates/$estateId/readings/imports/$batchId/-components/import-row-results";

function row(
  recordNumber: number,
  outcome: ReadingImportRow["outcome"]
): ReadingImportRow {
  return {
    recordNumber,
    startingLineNumber: recordNumber + 1,
    outcome,
    issues: [],
  } as unknown as ReadingImportRow;
}

describe("ImportRowResults", () => {
  it.each([
    ["IMPORTED", "success"],
    ["DUPLICATE", "secondary"],
    ["INVALID", "destructive"],
  ] as const)("shows %s in the %s variant", (outcome, variant) => {
    renderWithProviders(<ImportRowResults items={[row(1, outcome)]} />);
    expect(screen.getByText(outcome).dataset.variant).toBe(variant);
  });
});
