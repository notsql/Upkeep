import { describe, expect, it } from "vitest";
import { estateError } from "@/lib/estates";

describe("estate API errors", () => {
  it("does not claim a session expired for every authentication rejection", () => {
    const { message } = estateError(undefined, 401);
    expect(message).toContain("could not verify");
    expect(message).not.toContain("session has expired");
  });
});
