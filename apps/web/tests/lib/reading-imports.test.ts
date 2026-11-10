import { describe, expect, it } from "vitest";
import { importOutcomeLabels, importStatusLabels } from "@/lib/reading-imports";

describe("import labels", () => {
  it("names row outcomes in plain words", () => {
    expect(importOutcomeLabels).toEqual({
      IMPORTED: "Imported",
      DUPLICATE: "Already imported",
      INVALID: "Has problems",
    });
  });

  it("names batch states in plain words", () => {
    expect(importStatusLabels).toEqual({
      COMPLETED: "Imported",
      REVERTED: "Undone",
    });
  });
});
