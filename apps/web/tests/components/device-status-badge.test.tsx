import { render, screen } from "@testing-library/react";
import { describe, it } from "vitest";
import { DeviceStatusBadge } from "@/components/device-status-badge";

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
});
