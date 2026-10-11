import { describe, expect, it } from "vitest";
import { estateError } from "@/lib/estates";

describe("estate API errors", () => {
  it("keeps internal server errors out of user-facing feedback", () => {
    const { message } = estateError(
      { message: 'jOOQ; bad SQL grammar [select * from "Estate"]' },
      500
    );
    expect(message).not.toContain("SQL");
    expect(message).not.toContain("jOOQ");
    expect(message).toContain("try again");
  });
  it("does not claim a session expired for every authentication rejection", () => {
    const { message } = estateError(undefined, 401);
    expect(message).toContain("could not verify");
    expect(message).not.toContain("session has expired");
  });
});
