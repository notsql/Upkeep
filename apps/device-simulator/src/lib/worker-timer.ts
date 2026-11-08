/**
 * A sleep driven by a dedicated Web Worker's timer. Browsers throttle page
 * timers in hidden tabs, which stalled Live runs; worker timers keep their
 * schedule. The run still catches up by wall-clock time either way.
 */
export interface TimerWorker {
  onmessage: ((event: MessageEvent<number>) => void) | null;
  postMessage: (request: { id: number; ms: number }) => void;
  terminate: () => void;
}

export interface WorkerSleep {
  dispose: () => void;
  sleep: (ms: number) => Promise<void>;
}

const WORKER_SOURCE =
  "onmessage = (e) => { setTimeout(() => postMessage(e.data.id), e.data.ms); };";

function browserWorker(): TimerWorker | undefined {
  if (typeof Worker === "undefined") {
    return undefined;
  }
  const url = URL.createObjectURL(
    new Blob([WORKER_SOURCE], { type: "text/javascript" })
  );
  const worker = new Worker(url);
  URL.revokeObjectURL(url);
  return worker as unknown as TimerWorker;
}

export function createWorkerSleep(
  createWorker: () => TimerWorker | undefined = browserWorker
): WorkerSleep {
  const worker = createWorker();
  if (!worker) {
    return {
      sleep: (ms) =>
        new Promise((resolve) => {
          setTimeout(resolve, ms);
        }),
      dispose: () => undefined,
    };
  }
  const pending = new Map<number, () => void>();
  let nextId = 0;
  worker.onmessage = ({ data: id }) => {
    pending.get(id)?.();
    pending.delete(id);
  };
  return {
    sleep: (ms) =>
      new Promise((resolve) => {
        nextId += 1;
        pending.set(nextId, resolve);
        worker.postMessage({ id: nextId, ms });
      }),
    dispose: () => worker.terminate(),
  };
}
