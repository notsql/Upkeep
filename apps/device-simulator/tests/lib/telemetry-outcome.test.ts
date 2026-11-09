import { describe, expect, it } from "vitest";
import { classifyResponse } from "@/lib/telemetry-outcome";

describe("classifyResponse", () => {
  it("returns item results on 200", () => {
    expect(
      classifyResponse(200, { results: [{ index: 0, status: "CREATED" }] })
    ).toEqual({ kind: "ok", results: [{ index: 0, status: "CREATED" }] });
  });

  it("stops on 401 and 409 with the server's message", () => {
    expect(classifyResponse(401, { message: "Unknown key." })).toEqual({
      kind: "fatal",
      message: "Unknown key.",
    });
    expect(
      classifyResponse(409, { message: "This estate is inactive." })
    ).toEqual({
      kind: "fatal",
      message: "This estate is inactive.",
    });
  });

  it("retries a 5xx", () => {
    expect(classifyResponse(503, undefined)).toEqual({
      kind: "retryable",
      message: "Server error 503.",
    });
  });

  it("stops on any other status", () => {
    expect(classifyResponse(400, { message: "Bad batch." })).toEqual({
      kind: "fatal",
      message: "Bad batch.",
    });
  });
});
