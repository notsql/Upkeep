import { describe, expect, it } from "vitest";
import { askSomeone } from "@/lib/who-can-help";

describe("askSomeone", () => {
  it("names one role with an article", () => {
    expect(askSomeone(["Facilities lead"], "replace this sensor")).toBe(
      "Ask a Facilities lead to replace this sensor."
    );
  });

  it("uses 'an' before a vowel sound", () => {
    expect(askSomeone(["Inspector"], "send crew")).toBe(
      "Ask an Inspector to send crew."
    );
  });

  it("calls the owner 'the estate owner'", () => {
    expect(askSomeone(["estate owner"], "replace this sensor")).toBe(
      "Ask the estate owner to replace this sensor."
    );
  });

  it("joins two roles with 'or'", () => {
    expect(askSomeone(["Manager", "estate owner"], "send crew")).toBe(
      "Ask a Manager or the estate owner to send crew."
    );
  });

  it("lists three or more with commas and a final 'or'", () => {
    expect(
      askSomeone(
        ["Manager", "Facilities lead", "estate owner"],
        "send a contractor"
      )
    ).toBe(
      "Ask a Manager, a Facilities lead or the estate owner to send a contractor."
    );
  });

  it("falls back to someone who manages the estate when nobody is named", () => {
    expect(askSomeone([], "send crew")).toBe(
      "Ask someone who manages this estate to send crew."
    );
  });
});
