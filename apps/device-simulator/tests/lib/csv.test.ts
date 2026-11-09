import { describe, expect, it } from "vitest";
import {
  anomalyWindows,
  CSV_HEADER,
  experiments,
  parseReadingsCsv,
} from "@/lib/csv";

const row = (
  experiment: string,
  timestamp: string,
  anomaly = "0",
  value = "1.5"
): string => `${experiment},${timestamp},${value},2,3,4,5,${anomaly}`;

const file = (...rows: string[]): string => [CSV_HEADER, ...rows].join("\n");

describe("parseReadingsCsv", () => {
  it("parses rows into typed values", () => {
    const result = parseReadingsCsv(
      file(row("other/2.csv", "2020-03-01T16:28:16Z", "1"))
    );
    expect(result).toEqual({
      ok: true,
      rows: [
        {
          experiment: "other/2.csv",
          time: Date.parse("2020-03-01T16:28:16Z"),
          vibrationAcceleration: 1.5,
          pressure: 2,
          temperature: 3,
          flowRate: 4,
          power: 5,
          anomaly: true,
        },
      ],
    });
  });

  it("accepts a UTF-8 BOM and Windows line endings", () => {
    const text = `﻿${file(
      row("a", "2020-03-01T16:28:16+08:00"),
      row("a", "2020-03-01T16:28:17+08:00")
    ).replaceAll("\n", "\r\n")}\r\n`;
    const result = parseReadingsCsv(text);
    expect(result.ok && result.rows.length).toBe(2);
  });

  it("rejects a wrong header", () => {
    expect(parseReadingsCsv("a,b,c\nother,1,2")).toEqual({
      ok: false,
      error: `Line 1: the header must be exactly ${CSV_HEADER}.`,
    });
  });

  it("rejects an empty file and a header-only file as having no rows", () => {
    const error = { ok: false, error: "The file has no rows." };
    expect(parseReadingsCsv("")).toEqual(error);
    expect(parseReadingsCsv(`${CSV_HEADER}\n`)).toEqual(error);
  });

  it("rejects a timestamp without an offset, naming the line and field", () => {
    expect(
      parseReadingsCsv(
        file(row("a", "2020-03-01T16:28:16Z"), row("a", "2020-03-01T16:28:17"))
      )
    ).toEqual({
      ok: false,
      error: "Line 3: timestamp must be ISO-8601 with an offset.",
    });
  });

  it("rejects a non-finite value", () => {
    expect(
      parseReadingsCsv(file(row("a", "2020-03-01T16:28:16Z", "0", "NaN")))
    ).toEqual({
      ok: false,
      error: "Line 2: vibrationAcceleration must be a finite number.",
    });
    expect(
      parseReadingsCsv(file(row("a", "2020-03-01T16:28:16Z", "0", "")))
    ).toEqual({
      ok: false,
      error: "Line 2: vibrationAcceleration must be a finite number.",
    });
  });

  it("rejects an anomaly other than 0 or 1", () => {
    expect(
      parseReadingsCsv(file(row("a", "2020-03-01T16:28:16Z", "2")))
    ).toEqual({ ok: false, error: "Line 2: anomaly must be 0 or 1." });
  });

  it("rejects a row with the wrong number of fields", () => {
    expect(parseReadingsCsv(file("a,2020-03-01T16:28:16Z,1"))).toEqual({
      ok: false,
      error: "Line 2: expected 8 fields, got 3.",
    });
  });
});

describe("experiments", () => {
  it("lists each distinct experiment with its row count, in file order", () => {
    const result = parseReadingsCsv(
      file(
        row("b", "2020-03-01T16:28:16Z"),
        row("a", "2020-03-01T16:28:16Z"),
        row("b", "2020-03-01T16:28:17Z")
      )
    );
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(experiments(result.rows)).toEqual([
      { name: "b", rowCount: 2 },
      { name: "a", rowCount: 1 },
    ]);
  });
});

describe("anomalyWindows", () => {
  it("returns consecutive anomaly runs as start, end and length offsets", () => {
    const flags = [0, 1, 1, 0, 0, 1, 1, 1];
    const result = parseReadingsCsv(
      file(
        ...flags.map((flag, i) =>
          row("a", `2020-03-01T16:28:${String(10 + i)}Z`, String(flag))
        )
      )
    );
    if (!result.ok) {
      throw new Error(result.error);
    }
    expect(anomalyWindows(result.rows)).toEqual([
      { start: 1, end: 2, length: 2 },
      { start: 5, end: 7, length: 3 },
    ]);
  });
});
