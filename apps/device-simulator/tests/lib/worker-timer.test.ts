import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkerSleep, type TimerWorker } from "@/lib/worker-timer";

/** Stands in for the dedicated worker: answers each request after `ms`. */
class FakeWorker implements TimerWorker {
  onmessage: ((event: MessageEvent<number>) => void) | null = null;
  terminated = false;
  postMessage({ id, ms }: { id: number; ms: number }): void {
    setTimeout(() => {
      this.onmessage?.({ data: id } as MessageEvent<number>);
    }, ms);
  }
  terminate(): void {
    this.terminated = true;
  }
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createWorkerSleep", () => {
  it("resolves each sleep when the worker reports its timer", async () => {
    const worker = new FakeWorker();
    const { sleep } = createWorkerSleep(() => worker);
    const order: string[] = [];
    sleep(5000).then(() => order.push("5s"));
    sleep(2000).then(() => order.push("2s"));
    await vi.advanceTimersByTimeAsync(1999);
    expect(order).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(order).toEqual(["2s"]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(order).toEqual(["2s", "5s"]);
  });

  it("terminates the worker on dispose", () => {
    const worker = new FakeWorker();
    const { dispose } = createWorkerSleep(() => worker);
    dispose();
    expect(worker.terminated).toBe(true);
  });

  it("falls back to a page timer when no worker can be made", async () => {
    const { sleep } = createWorkerSleep(() => undefined);
    let done = false;
    sleep(5000).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(done).toBe(true);
  });
});
