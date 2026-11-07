import { describe, expect, it } from "vitest";
import { estateError, formatMcst } from "@/lib/estates";

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

describe("formatMcst", () => {
  it("prefixes a bare MCST number", () => {
    expect(formatMcst("1234")).toBe("MCST 1234");
  });

  it("does not double-prefix a code that already starts with MCST", () => {
    expect(formatMcst("MCST 1234")).toBe("MCST 1234");
    expect(formatMcst("mcst1234")).toBe("mcst1234");
  });
});
