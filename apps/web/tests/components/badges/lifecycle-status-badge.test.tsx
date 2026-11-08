import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it } from "vitest";
import { LifecycleStatusBadge } from "@/components/badges/lifecycle-status-badge";
import { statusToneClassName } from "@/lib/status-tone";

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

it("shows Active in the success tone and inactive in the danger tone", () => {
  const { unmount } = renderWithProviders(
    <LifecycleStatusBadge inactive={false} inactiveLabel="Retired" />
  );
  expect(screen.getByRole("status").className).toContain(
    statusToneClassName.success
  );
  unmount();
  renderWithProviders(
    <LifecycleStatusBadge inactive inactiveLabel="Retired" />
  );
  expect(screen.getByRole("status").className).toContain(
    statusToneClassName.danger
  );
});
