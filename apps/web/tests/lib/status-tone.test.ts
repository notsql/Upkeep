import { describe, expect, it } from "vitest";
import { statusToneClassName } from "@/lib/status-tone";

describe("statusToneClassName", () => {
  it("gives success a green treatment from the emerald scale", () => {
    expect(statusToneClassName.success).toContain("emerald");
  });

  it("keeps danger on the destructive token", () => {
    expect(statusToneClassName.danger).toContain("destructive");
  });
});
