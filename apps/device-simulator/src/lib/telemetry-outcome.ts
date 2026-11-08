import type { components } from "@proj/api/schema";

export type ItemResult = Pick<
  components["schemas"]["TelemetryItemResult"],
  "index" | "status" | "message"
>;

export type SendOutcome =
  | { kind: "ok"; results: ItemResult[] }
  | { kind: "retryable"; message: string }
  | { kind: "fatal"; message: string };

const messageOf = (body: unknown): string | undefined => {
  if (body && typeof body === "object" && "message" in body) {
    const { message } = body as { message: unknown };
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
};

/** Decides what the run does with a telemetry response. */
export function classifyResponse(status: number, body: unknown): SendOutcome {
  if (status === 200) {
    const { results } = body as { results: ItemResult[] };
    return {
      kind: "ok",
      results: results.map(({ index, status: itemStatus, message }) => ({
        index,
        status: itemStatus,
        ...(message === undefined ? {} : { message }),
      })),
    };
  }
  if (status >= 500) {
    return { kind: "retryable", message: `Server error ${status}.` };
  }
  return {
    kind: "fatal",
    message: messageOf(body) ?? `Request failed with status ${status}.`,
  };
}
