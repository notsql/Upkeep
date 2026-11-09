import { describe, expect, it } from "vitest";
import { dispatchRoute } from "@/lib/equipment-dispatch";

describe("dispatchRoute", () => {
  it("sends a contractor for equipment at the end of its life", () => {
    expect(dispatchRoute(["END_OF_LIFE"])).toBe("CONTRACTOR");
  });

  it("lets end of life win over every other reason", () => {
    expect(dispatchRoute(["FAILURE_RISK", "CONDITION", "END_OF_LIFE"])).toBe(
      "CONTRACTOR"
    );
  });

  it.each([
    [["FAILURE_RISK"]],
    [["CONDITION"]],
    [["FAILURE_RISK", "CONDITION"]],
  ] as const)("sends crew to inspect for %j", (reasons) => {
    expect(dispatchRoute([...reasons])).toBe("CREW");
  });

  it("sends nobody when nothing is flagged", () => {
    expect(dispatchRoute([])).toBeNull();
  });
});
