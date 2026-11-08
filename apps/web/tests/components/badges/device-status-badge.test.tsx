import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeviceStatusBadge } from "@/components/badges/device-status-badge";
import { statusToneClassName } from "@/lib/status-tone";

describe("DeviceStatusBadge", () => {
  it.each([
    ["ONLINE", "Online"],
    ["OFFLINE", "Offline"],
    ["AWAITING_FIRST_READING", "Awaiting first reading"],
    ["DEACTIVATED", "Deactivated"],
  ] as const)("labels %s as %s", (status, label) => {
    render(<DeviceStatusBadge status={status} />);
    screen.getByText(label);
  });

  it("shows Online in the same success tone as an active asset", () => {
    render(<DeviceStatusBadge status="ONLINE" />);
    expect(screen.getByText("Online").className).toContain(
      statusToneClassName.success
    );
  });
});
