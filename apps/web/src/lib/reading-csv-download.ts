const CSV_HEADER =
  "reading_id,measured_at,asset_id,asset_reference,asset_name,metric,value,unit,source,device_id,device_identifier,recorded_by_user_id,recorded_by_name,recorded_at,flags";
const COUNT = /^\d+$/;
const FILENAME = /filename="(readings-v1-[a-f\d-]+-\d{8}T\d{6}Z\.csv)"/;
const INCOMPLETE = "CSV download was incomplete. Please try again.";

/** Incremental validation avoids decoding a second copy of a large downloaded file. */
class CsvCompletion {
  private quoted: boolean;
  private columns = 1;
  private lines = 0;
  private header = "";
  private lastNewline: boolean;
  private carriageReturn: boolean;
  constructor() {
    this.quoted = false;
    this.lastNewline = false;
    this.carriageReturn = false;
  }
  push(text: string) {
    for (const char of text) {
      this.character(char);
    }
  }
  private appendHeader(char: string) {
    if (this.lines !== 0 || char === "\r" || char === "\n") {
      return;
    }
    this.header += char;
    if (this.header.length > CSV_HEADER.length) {
      throw new Error(INCOMPLETE);
    }
  }
  private finishRow() {
    if (
      this.columns !== 15 ||
      (this.lines === 0 && this.header !== CSV_HEADER)
    ) {
      throw new Error(INCOMPLETE);
    }
    this.lines += 1;
    this.columns = 1;
  }
  private character(char: string) {
    this.appendHeader(char);
    if (char === '"') {
      this.quoted = !this.quoted;
    }
    if (this.carriageReturn && char !== "\n") {
      throw new Error(INCOMPLETE);
    }
    this.carriageReturn = !this.quoted && char === "\r";
    if (!this.quoted && char === ",") {
      this.columns += 1;
    }
    this.lastNewline = !this.quoted && char === "\n";
    if (this.lastNewline) {
      this.finishRow();
    }
  }
  complete(expected: number) {
    if (this.quoted || !this.lastNewline || this.lines !== expected + 1) {
      throw new Error(INCOMPLETE);
    }
  }
}

export async function completeReadingCsv(
  stream: ReadableStream<Uint8Array>,
  response: Response,
  signal: AbortSignal
): Promise<Blob> {
  const count = response.headers.get("X-Export-Row-Count");
  if (
    count === null ||
    !COUNT.test(count) ||
    !Number.isSafeInteger(Number(count)) ||
    !response.headers.get("Content-Type")?.startsWith("text/csv")
  ) {
    await stream.cancel();
    throw new Error(INCOMPLETE);
  }
  const reader = stream.getReader();
  const parts: BlobPart[] = [];
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const validator = new CsvCompletion();
  const abort = () => {
    reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    for (;;) {
      // biome-ignore lint/performance/noAwaitInLoops: ordered chunks share CSV quote state and cancellation.
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) {
        break;
      }
      validator.push(decoder.decode(value, { stream: true }));
      parts.push(value as Uint8Array<ArrayBuffer>);
    }
    validator.push(decoder.decode());
    validator.complete(Number(count));
    return new Blob(parts, { type: "text/csv;charset=utf-8" });
  } finally {
    signal.removeEventListener("abort", abort);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export function saveReadingCsv(blob: Blob, response: Response) {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(FILENAME)?.[1] ?? "readings-v1.csv";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  try {
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}
