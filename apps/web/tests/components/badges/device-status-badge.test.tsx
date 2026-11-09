import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeviceStatusBadge } from "@/components/badges/device-status-badge";

describe("DeviceStatusBadge", () => {
  it.each([
    ["ONLINE", "Online", "success"],
    ["OFFLINE", "Offline", "destructive"],
    ["AWAITING_FIRST_READING", "Awaiting first reading", "info"],
    ["DEACTIVATED", "Deactivated", "secondary"],
  ] as const)("labels %s as %s in the %s variant", (status, label, variant) => {
    render(<DeviceStatusBadge status={status} />);
    expect(screen.getByText(label).dataset.variant).toBe(variant);
  });
});
