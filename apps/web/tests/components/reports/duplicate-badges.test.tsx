import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DuplicateStateBadge } from "@/components/reports/duplicate-badges";

describe("DuplicateStateBadge", () => {
  it.each([
    ["SUSPECTED", "Possible duplicate", "warning"],
    ["CONFIRMED", "Duplicate", "secondary"],
  ] as const)("labels %s as %s in the %s variant", (state, label, variant) => {
    render(<DuplicateStateBadge state={state} />);
    expect(screen.getByText(label).dataset.variant).toBe(variant);
  });
});
