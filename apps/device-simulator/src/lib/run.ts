import type { CsvRow } from "@/lib/csv";
import type { Mode, Reading, ShiftedRow } from "@/lib/readings";
import { MAX_BATCH, shiftRows, splitBatches, toReadings } from "@/lib/readings";
import type { ItemResult, SendOutcome } from "@/lib/telemetry-outcome";

export type { SendOutcome } from "@/lib/telemetry-outcome";

export const RETRIES = 3;
export const RETRY_DELAY_MS = 2000;
export const LIVE_TICK_MS = 5000;
export const MAX_MESSAGES = 10;
const READINGS_PER_ROW = 5;

export type ItemStatus = ItemResult["status"];

export interface RunState {
  counts: Record<ItemStatus, number>;
  error?: string;
  /** The first distinct INVALID and CONFLICT messages. */
  messages: string[];
  rowsSent: number;
  status: "running" | "finished" | "stopped" | "failed";
  totalRows: number;
}

export interface RunOptions {
  mode: Mode;
  onUpdate: (state: RunState) => void;
  rows: CsvRow[];
  send: (batch: Reading[]) => Promise<SendOutcome>;
  /** Waits between ticks and retries; defaults to a page timer. */
  sleep?: (ms: number) => Promise<void>;
}

export interface Run {
  done: Promise<void>;
  stop: () => void;
}

const pageSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Sends one batch, retrying network and 5xx failures. */
async function sendWithRetry(
  send: RunOptions["send"],
  batch: Reading[],
  sleep: (ms: number) => Promise<void>
): Promise<SendOutcome> {
  let outcome = await send(batch);
  for (
    let retry = 0;
    retry < RETRIES && outcome.kind === "retryable";
    retry += 1
  ) {
    // biome-ignore lint/performance/noAwaitInLoops: retries are sequential by design.
    await sleep(RETRY_DELAY_MS);
    outcome = await send(batch);
  }
  return outcome;
}

export function runSimulation({
  rows,
  mode,
  send,
  onUpdate,
  sleep = pageSleep,
}: RunOptions): Run {
  let stopRequested = false;
  const state: RunState = {
    status: "running",
    rowsSent: 0,
    totalRows: rows.length,
    counts: { CREATED: 0, ALREADY_STORED: 0, INVALID: 0, CONFLICT: 0 },
    messages: [],
  };
  const emit = () =>
    onUpdate({
      ...state,
      counts: { ...state.counts },
      messages: [...state.messages],
    });

  const record = (results: ItemResult[], readingCount: number) => {
    for (const result of results) {
      state.counts[result.status] += 1;
      const { message } = result;
      if (
        message &&
        state.messages.length < MAX_MESSAGES &&
        !state.messages.includes(message)
      ) {
        state.messages.push(message);
      }
    }
    state.rowsSent += readingCount / READINGS_PER_ROW;
  };

  /** Sends rows in batches; returns false if the run must end. */
  const sendRows = async (due: ShiftedRow[]): Promise<boolean> => {
    const readings = due.flatMap(({ row, at }) => toReadings(row, at));
    for (const batch of splitBatches(readings, MAX_BATCH)) {
      let outcome: SendOutcome;
      try {
        // biome-ignore lint/performance/noAwaitInLoops: batches are sent one at a time so Stop can end after the current one.
        outcome = await sendWithRetry(send, batch, sleep);
      } catch (error) {
        outcome = {
          kind: "fatal",
          message: error instanceof Error ? error.message : "Request failed.",
        };
      }
      if (outcome.kind !== "ok") {
        state.status = "failed";
        state.error = outcome.message;
        return false;
      }
      record(outcome.results, batch.length);
      emit();
      if (stopRequested) {
        state.status = "stopped";
        return false;
      }
    }
    return true;
  };

  const execute = async () => {
    emit();
    const shifted = shiftRows(rows, mode, Date.now());
    let next = 0;
    while (next < shifted.length) {
      const now = Date.now();
      let end = next;
      while (end < shifted.length && shifted[end].at <= now) {
        end += 1;
      }
      // biome-ignore lint/performance/noAwaitInLoops: live ticks run one after another.
      if (!(await sendRows(shifted.slice(next, end)))) {
        emit();
        return;
      }
      next = end;
      if (next >= shifted.length) {
        break;
      }
      await sleep(LIVE_TICK_MS);
      if (stopRequested) {
        state.status = "stopped";
        emit();
        return;
      }
    }
    state.status = "finished";
    emit();
  };

  return {
    stop: () => {
      stopRequested = true;
    },
    done: execute(),
  };
}
