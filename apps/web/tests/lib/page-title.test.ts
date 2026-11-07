import { describe, expect, it } from "vitest";

import { APP_NAME, pageHead, pageTitle } from "@/lib/page-title";

describe("pageTitle", () => {
  it("is the app name alone without a page", () => {
    expect(pageTitle()).toBe("UpKeep");
    expect(APP_NAME).toBe("UpKeep");
  });

  it("puts the app name first, separated by a middle dot", () => {
    expect(pageTitle("Work orders")).toBe("UpKeep · Work orders");
  });

  it("returns head meta for a route", () => {
    expect(pageHead("Assets")).toEqual({
      meta: [{ title: "UpKeep · Assets" }],
    });
  });
});
