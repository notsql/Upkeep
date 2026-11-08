import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CsvRow } from "@/lib/csv";
import type { RunState, SendOutcome } from "@/lib/run";
import { runSimulation } from "@/lib/run";

const row = (time: number): CsvRow => ({
  experiment: "a",
  time,
  vibrationAcceleration: 1,
  pressure: 1,
  temperature: 1,
  flowRate: 1,
  power: 1,
  anomaly: false,
});

type Batch = { measuredAt: string }[];

const created = (batch: Batch): SendOutcome => ({
  kind: "ok",
  results: batch.map((_, index) => ({ index, status: "CREATED" })),
});

const START = Date.parse("2026-11-07T00:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

const start = (
  rows: CsvRow[],
  mode: "backfill" | "live",
  send: (batch: Batch) => Promise<SendOutcome>
) => {
  const states: RunState[] = [];
  const run = runSimulation({
    rows,
    mode,
    send,
    onUpdate: (state) => states.push(state),
  });
  return { run, states };
};

describe("runSimulation - backfill", () => {
  it("sends every reading at once in batches of up to 500", async () => {
    const rows = Array.from({ length: 150 }, (_, i) => row(i * 1000));
    const sizes: number[] = [];
    const { run, states } = start(rows, "backfill", (batch) => {
      sizes.push(batch.length);
      return Promise.resolve(created(batch));
    });
    await run.done;
    expect(sizes).toEqual([500, 250]);
    expect(states.at(-1)).toMatchObject({
      status: "finished",
      rowsSent: 150,
      totalRows: 150,
      counts: { CREATED: 750, ALREADY_STORED: 0, INVALID: 0, CONFLICT: 0 },
    });
  });

  it("reports INVALID and CONFLICT without retrying, keeping 10 distinct messages", async () => {
    const rows = Array.from({ length: 4 }, (_, i) => row(i * 1000));
    const send = vi.fn(
      async (batch: Batch): Promise<SendOutcome> => ({
        kind: "ok",
        results: batch.map((_, index) => ({
          index,
          status: index % 2 === 0 ? "INVALID" : "CONFLICT",
          message: `problem ${index % 12}`,
        })),
      })
    );
    const { run, states } = start(rows, "backfill", send);
    await run.done;
    expect(send).toHaveBeenCalledTimes(1);
    const last = states.at(-1);
    expect(last?.counts).toMatchObject({ INVALID: 10, CONFLICT: 10 });
    expect(last?.messages).toEqual(
      Array.from({ length: 10 }, (_, i) => `problem ${i}`)
    );
    expect(last?.status).toBe("finished");
  });

  it("retries a retryable failure up to 3 times, 2 s apart, then succeeds", async () => {
    let calls = 0;
    const { run, states } = start([row(0)], "backfill", (batch) => {
      calls += 1;
      return Promise.resolve(
        calls < 4
          ? { kind: "retryable", message: "Network error" }
          : created(batch)
      );
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(4000);
    await run.done;
    expect(calls).toBe(4);
    expect(states.at(-1)?.status).toBe("finished");
  });

  it("stops with the error after 3 failed retries", async () => {
    const send = vi.fn(
      async (): Promise<SendOutcome> => ({
        kind: "retryable",
        message: "Server error 503",
      })
    );
    const rows = Array.from({ length: 200 }, (_, i) => row(i * 1000));
    const { run, states } = start(rows, "backfill", send);
    await vi.advanceTimersByTimeAsync(6000);
    await run.done;
    expect(send).toHaveBeenCalledTimes(4);
    expect(states.at(-1)).toMatchObject({
      status: "failed",
      error: "Server error 503",
      rowsSent: 0,
    });
  });

  it("stops at once on a fatal response with the server's message", async () => {
    const send = vi.fn(
      async (): Promise<SendOutcome> => ({
        kind: "fatal",
        message: "Unknown device key.",
      })
    );
    const rows = Array.from({ length: 200 }, (_, i) => row(i * 1000));
    const { run, states } = start(rows, "backfill", send);
    await run.done;
    expect(send).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toMatchObject({
      status: "failed",
      error: "Unknown device key.",
    });
  });

  it("Stop ends the run after the current batch", async () => {
    const rows = Array.from({ length: 300 }, (_, i) => row(i * 1000));
    let release: (() => void) | undefined;
    const send = vi.fn(
      (batch: Batch) =>
        new Promise<SendOutcome>((resolve) => {
          release = () => resolve(created(batch));
        })
    );
    const { run, states } = start(rows, "backfill", send);
    await vi.advanceTimersByTimeAsync(0);
    run.stop();
    release?.();
    await run.done;
    expect(send).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toMatchObject({ status: "stopped", rowsSent: 100 });
  });
});

describe("runSimulation - live", () => {
  it("every 5 s sends the readings whose shifted time has passed", async () => {
    // Rows at 0 s, 3 s, 7 s and 12 s after the first.
    const rows = [row(0), row(3000), row(7000), row(12_000)];
    const sent: string[][] = [];
    const { run, states } = start(rows, "live", (batch) => {
      sent.push([...new Set(batch.map((r) => r.measuredAt))]);
      return Promise.resolve(created(batch));
    });
    const iso = (offset: number) => new Date(START + offset).toISOString();

    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toEqual([[iso(0)]]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toEqual([[iso(0)], [iso(3000)]]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent.at(-1)).toEqual([iso(7000)]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent.at(-1)).toEqual([iso(12_000)]);
    await run.done;
    expect(states.at(-1)).toMatchObject({ status: "finished", rowsSent: 4 });
  });

  it("Stop ends a live run before the next tick", async () => {
    const rows = [row(0), row(10_000)];
    const send = vi.fn(async (batch: Batch) => created(batch));
    const { run, states } = start(rows, "live", send);
    await vi.advanceTimersByTimeAsync(0);
    run.stop();
    await vi.advanceTimersByTimeAsync(20_000);
    await run.done;
    expect(send).toHaveBeenCalledTimes(1);
    expect(states.at(-1)?.status).toBe("stopped");
  });

  it("waits between ticks on the injected sleep, catching up by wall-clock time", async () => {
    // A throttled timer: each 5 s wait actually takes 12 s of wall time.
    const waits: number[] = [];
    const sleep = (ms: number) => {
      waits.push(ms);
      vi.setSystemTime(Date.now() + 12_000);
      return Promise.resolve();
    };
    const rows = [row(0), row(3000), row(7000), row(12_000)];
    const sent: number[] = [];
    const run = runSimulation({
      rows,
      mode: "live",
      send: (batch) => {
        sent.push(batch.length / 5);
        return Promise.resolve(created(batch));
      },
      onUpdate: () => undefined,
      sleep,
    });
    await run.done;
    expect(waits).toEqual([5000]);
    expect(sent).toEqual([1, 3]);
  });
});
