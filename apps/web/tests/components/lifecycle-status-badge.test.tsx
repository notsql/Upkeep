import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it } from "vitest";
import { LifecycleStatusBadge } from "@/components/lifecycle-status-badge";

it.each([
  [false, "Inactive", "Active"],
  [true, "Inactive", "Inactive"],
  [true, "Retired", "Retired"],
] as const)(
  "announces lifecycle status for inactive=%s, %s",
  (inactive, inactiveLabel, expected) => {
    renderWithProviders(
      <LifecycleStatusBadge inactive={inactive} inactiveLabel={inactiveLabel} />
    );
    expect(screen.getByRole("status").textContent).toBe(expected);
  }
);
