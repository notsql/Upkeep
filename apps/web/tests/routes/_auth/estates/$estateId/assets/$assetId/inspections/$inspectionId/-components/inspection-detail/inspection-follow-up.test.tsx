import { renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import type { InspectionResult } from "@/lib/inspections";
import { InspectionFollowUp } from "@/routes/_auth/estates/$estateId/assets/$assetId/inspections/$inspectionId/-components/inspection-detail/inspection-follow-up";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to
      )}
    >
      {children}
    </a>
  ),
}));

const failed = {
  id: "result",
  outcome: "FAIL",
  workOrder: { id: "wo", reference: "EST-W0003" },
} as unknown as InspectionResult;

function renderFollowUp(canViewWorkOrders: boolean) {
  renderWithProviders(
    <InspectionFollowUp
      active
      canCreate={false}
      canViewWorkOrders={canViewWorkOrders}
      estateId="estate"
      pending={false}
      record={failed}
    />
  );
}

it("links the follow-up work order for a work-order viewer", () => {
  renderFollowUp(true);
  expect(
    screen.getByRole("link", { name: "EST-W0003" }).getAttribute("href")
  ).toBe("/estates/estate/work-orders/wo");
});

// Opening a work order needs VIEW_WORK_ORDERS (estate-role-permissions).
it("names the work order without linking it for anyone else", () => {
  renderFollowUp(false);
  screen.getByText("EST-W0003");
  expect(screen.queryByRole("link", { name: "EST-W0003" })).toBeNull();
});
