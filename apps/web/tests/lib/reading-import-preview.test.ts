import { describe, expect, it } from "vitest";
import { parseImportSample } from "@/lib/reading-import-preview";

describe("historical reading CSV preview", () => {
  it.each(["", '""'])(
    "keeps a final record with an empty last field (%s) and no newline",
    (lastField) => {
      expect(
        parseImportSample(
          `asset_reference,metric,measured_at,value,note\r\nAHU-1,TEMPERATURE,2025-01-01T00:00:00Z,21.000001,${lastField}`
        )
      ).toEqual([
        ["asset_reference", "metric", "measured_at", "value", "note"],
        ["AHU-1", "TEMPERATURE", "2025-01-01T00:00:00Z", "21.000001", ""],
      ]);
    }
  );
});
