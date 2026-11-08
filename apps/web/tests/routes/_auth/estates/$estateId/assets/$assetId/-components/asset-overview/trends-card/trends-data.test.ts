import { describe, expect, it } from "vitest";
import type { MetricSeries } from "@/lib/readings";
import {
  chartRows,
  coverageNote,
  percentChange,
  timeTicks,
} from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/asset-overview/trends-card/trends-data";

const SG = { locale: "en-SG", timeZone: "Asia/Singapore" };

function point(start: string, avg: number) {
  return { start, avg, min: avg - 1, max: avg + 1, count: 1 };
}

function series(points: ReturnType<typeof point>[]): MetricSeries {
  return { metric: "VIBRATION", points } as MetricSeries;
}

const RANGE = {
  from: "2026-11-07T13:00:00Z",
  to: "2026-11-07T13:01:00Z",
  bucketSeconds: 10,
};

describe("chartRows", () => {
  it("spans the whole range with null gaps", () => {
    const rows = chartRows(
      series([
        point("2026-11-07T13:00:20Z", 5),
        point("2026-11-07T13:00:30Z", 6),
      ]),
      RANGE
    );
    expect(rows.map((row) => row.t)).toEqual(
      [0, 10, 20, 30, 40, 50].map(
        (s) => Date.parse("2026-11-07T13:00:00Z") + s * 1000
      )
    );
    expect(rows.map((row) => row.avg)).toEqual([null, null, 5, 6, null, null]);
    expect(rows[2]?.band).toEqual([4, 6]);
    expect(rows[0]?.band).toBeNull();
  });

  it("starts at the first bucket at or after from, keeping the points' phase", () => {
    const rows = chartRows(series([point("2026-11-07T13:00:25Z", 1)]), {
      ...RANGE,
      from: "2026-11-07T13:00:03Z",
    });
    expect(new Date(rows[0]?.t ?? 0).toISOString()).toBe(
      "2026-11-07T13:00:05.000Z"
    );
    expect(new Date(rows.at(-1)?.t ?? 0).toISOString()).toBe(
      "2026-11-07T13:00:55.000Z"
    );
  });

  it("marks only points with no neighbours as isolated", () => {
    const rows = chartRows(
      series([
        point("2026-11-07T13:00:00Z", 1),
        point("2026-11-07T13:00:10Z", 2),
        point("2026-11-07T13:00:40Z", 3),
      ]),
      RANGE
    );
    expect(rows.map((row) => row.isolated)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  it("returns no rows for a metric with no points", () => {
    expect(chartRows(series([]), RANGE)).toEqual([]);
  });
});

describe("percentChange", () => {
  it.each([
    [[10, 12], 0.2],
    [[10, 8], -0.2],
    [[10, 10], 0],
    [[-10, -5], 0.5],
  ])("changes %j by %d", (avgs, change) => {
    const points = avgs.map((avg, index) =>
      point(`2026-11-07T13:00:0${index}Z`, avg)
    );
    expect(percentChange(points)).toBeCloseTo(change);
  });

  it("has no change from a zero or near-zero first value", () => {
    expect(
      percentChange([
        point("2026-11-07T13:00:00Z", 0),
        point("2026-11-07T13:00:01Z", 1),
      ])
    ).toBeNull();
    expect(
      percentChange([
        point("2026-11-07T13:00:00Z", 1e-10),
        point("2026-11-07T13:00:01Z", 1),
      ])
    ).toBeNull();
  });

  it("has no change from fewer than two points", () => {
    expect(percentChange([point("2026-11-07T13:00:00Z", 4)])).toBeNull();
    expect(percentChange([])).toBeNull();
  });
});

function iso(ticks: number[]): string[] {
  return ticks.map((t) => new Date(t).toISOString());
}

describe("timeTicks", () => {
  it("ticks every 15 s on 1 min", () => {
    expect(
      iso(timeTicks("2026-11-07T13:00:07Z", "2026-11-07T13:01:07Z", "1m", SG))
    ).toEqual([
      "2026-11-07T13:00:15.000Z",
      "2026-11-07T13:00:30.000Z",
      "2026-11-07T13:00:45.000Z",
      "2026-11-07T13:01:00.000Z",
    ]);
  });

  it("ticks every 5 min on 15 min", () => {
    expect(
      iso(timeTicks("2026-11-07T13:02:00Z", "2026-11-07T13:17:00Z", "15m", SG))
    ).toEqual([
      "2026-11-07T13:05:00.000Z",
      "2026-11-07T13:10:00.000Z",
      "2026-11-07T13:15:00.000Z",
    ]);
  });

  it("ticks every 15 min on 1 h", () => {
    expect(
      iso(timeTicks("2026-11-07T13:01:00Z", "2026-11-07T14:01:00Z", "1h", SG))
    ).toEqual([
      "2026-11-07T13:15:00.000Z",
      "2026-11-07T13:30:00.000Z",
      "2026-11-07T13:45:00.000Z",
      "2026-11-07T14:00:00.000Z",
    ]);
  });

  it("ticks at local 00, 06, 12 and 18 on 24 h in Asia/Singapore", () => {
    // Singapore is UTC+8: local midnight is 16:00Z.
    expect(
      iso(timeTicks("2026-11-07T13:30:00Z", "2026-11-08T13:30:00Z", "24h", SG))
    ).toEqual([
      "2026-11-07T16:00:00.000Z",
      "2026-11-07T22:00:00.000Z",
      "2026-11-08T04:00:00.000Z",
      "2026-11-08T10:00:00.000Z",
    ]);
  });

  it("follows local time across a DST change", () => {
    // New York leaves DST at 02:00 local on 1 Nov 2026 (UTC-4 to UTC-5).
    expect(
      iso(
        timeTicks("2026-11-01T03:30:00Z", "2026-11-02T03:30:00Z", "24h", {
          locale: "en-US",
          timeZone: "America/New_York",
        })
      )
    ).toEqual([
      "2026-11-01T04:00:00.000Z",
      "2026-11-01T11:00:00.000Z",
      "2026-11-01T17:00:00.000Z",
      "2026-11-01T23:00:00.000Z",
    ]);
  });
});

describe("coverageNote", () => {
  const DAY = {
    from: "2026-11-07T00:00:00Z",
    to: "2026-11-08T00:00:00Z",
    bucketSeconds: 300,
  };

  function day(count: number) {
    return series(
      Array.from({ length: count }, (_, index) =>
        point(new Date(Date.parse(DAY.from) + index * 300_000).toISOString(), 1)
      )
    );
  }

  it("notes readings covering under 10% of the range's buckets", () => {
    expect(coverageNote(day(1), DAY, "last 24 hours", SG)).toBe(
      "Readings cover 5 mins of the last 24 hours"
    );
    // 28 of 288 buckets (9.7%) is 140 min, shown in hours.
    expect(coverageNote(day(28), DAY, "last 24 hours", SG)).toBe(
      "Readings cover 2.3 hrs of the last 24 hours"
    );
  });

  it("counts seconds when readings cover under a minute", () => {
    expect(
      coverageNote(
        series([point("2026-11-07T13:00:00Z", 1)]),
        { ...RANGE, bucketSeconds: 1 },
        "last 1 minute",
        SG
      )
    ).toBe("Readings cover 1 sec of the last 1 minute");
  });

  it("has no note at 10% coverage or more", () => {
    // 29 of 288 buckets is 10.1%.
    expect(coverageNote(day(29), DAY, "last 24 hours", SG)).toBeNull();
  });
});
