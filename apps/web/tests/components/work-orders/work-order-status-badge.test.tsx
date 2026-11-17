import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkOrderStatusBadge } from "@/components/work-orders/work-order-status-badge";

describe("WorkOrderStatusBadge", () => {
  it.each([
    ["OPEN", "Open", "outline"],
    ["ASSIGNED", "Assigned", "info"],
    ["IN_PROGRESS", "In progress", "warning"],
    ["CLOSED", "Closed", "success"],
  ] as const)("labels %s as %s in the %s variant", (status, label, variant) => {
    render(<WorkOrderStatusBadge status={status} />);
    expect(screen.getByText(label).dataset.variant).toBe(variant);
  });

  it("labels a newly submitted fault report Submitted, in the info variant", () => {
    render(<WorkOrderStatusBadge status="SUBMITTED" />);
    expect(screen.getByText("Submitted").dataset.variant).toBe("info");
    expect(screen.queryByText("SUBMITTED")).toBeNull();
  });

  it("still shows an unknown status as-is, outlined", () => {
    render(<WorkOrderStatusBadge status="SOMETHING_NEW" />);
    expect(screen.getByText("SOMETHING_NEW").dataset.variant).toBe("outline");
  });
});
