import { describe, expect, it } from "vitest";
import {
  mergeReadingSearch,
  parseReadingSearch,
  readingFilterError,
} from "@/lib/reading-filters";

describe("estate readings search", () => {
  it("keeps a pending From change when To is edited before route props catch up", () => {
    const base = parseReadingSearch({ metric: "TEMPERATURE", page: 2 });
    const latest = { ...base, from: "2026-10-01T08:30", page: undefined };
    const secondEdit = { ...base, to: "2026-10-01T09:00", page: undefined };
    expect(mergeReadingSearch(latest, base, secondEdit)).toMatchObject({
      metric: "TEMPERATURE",
      from: "2026-10-01T08:30",
      to: "2026-10-01T09:00",
      page: undefined,
    });
  });

  it("can clear every pending filter and reset a pending page change", () => {
    expect(
      mergeReadingSearch({ from: "2026-10-01T08:30", page: 4 }, {}, {})
    ).toEqual({});
    expect(
      mergeReadingSearch(
        { page: 4 },
        {},
        { metric: "PRESSURE", page: undefined }
      )
    ).toEqual({ metric: "PRESSURE", page: undefined });
  });
  it("restores combined filters and a deep page from the URL", () => {
    expect(
      parseReadingSearch({
        assetId: "b6d6fe0d-32c5-4c77-a034-81aac211dfaa",
        metric: "PRESSURE",
        from: "2026-10-01T10:00",
        to: "2026-10-02T10:00",
        page: "3",
        suspect: "true",
      })
    ).toEqual({
      assetId: "b6d6fe0d-32c5-4c77-a034-81aac211dfaa",
      metric: "PRESSURE",
      from: "2026-10-01T10:00",
      to: "2026-10-02T10:00",
      page: 3,
      suspect: true,
    });
  });

  it.each([
    { from: "2026-02-30T10:00" },
    { from: "not-a-date" },
    { to: "2026-10-01T25:00" },
    { from: "2026-10-02T10:00", to: "2026-10-01T10:00" },
    { from: "2026-10-01T10:00", to: "2026-10-01T10:00" },
    { metric: "INVALID" },
    { assetId: "not-an-id" },
  ])(
    "retains and rejects invalid URL filters instead of silently broadening the query: %j",
    (input) => {
      const filters = parseReadingSearch(input);
      expect(readingFilterError(filters)).toBeTruthy();
      expect(filters).toMatchObject(input);
    }
  );

  it.each([
    { from: "2026-10-01T10:00" },
    { to: "2026-10-02T10:00" },
    {},
    { from: "2024-02-29T10:00" },
  ])("allows valid one-sided ranges and leap dates: %j", (input) => {
    expect(readingFilterError(parseReadingSearch(input))).toBeUndefined();
  });
});
