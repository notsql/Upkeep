import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it } from "vitest";
import { LifecycleStatusBadge } from "@/components/badges/lifecycle-status-badge";

it.each([
  [false, "Inactive", "Active", "success"],
  [true, "Inactive", "Inactive", "secondary"],
  [true, "Out of use", "Out of use", "secondary"],
] as const)(
  "announces lifecycle status for inactive=%s, %s",
  (inactive, inactiveLabel, expected, variant) => {
    renderWithProviders(
      <LifecycleStatusBadge inactive={inactive} inactiveLabel={inactiveLabel} />
    );
    const badge = screen.getByRole("status");
    expect(badge.textContent).toBe(expected);
    expect(badge.dataset.variant).toBe(variant);
  }
);
