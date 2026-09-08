import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loader from "@/components/loader";

describe("Loader", () => {
  it("renders a spinner labelled for screen readers", () => {
    render(<Loader />);

    // getByRole throws if nothing matches, so the query is the assertion;
    // expect() here just makes that explicit to a reader.
    expect(screen.getByRole("status", { name: "Loading" })).toBeDefined();
  });
});
