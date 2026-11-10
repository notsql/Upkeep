import type { components } from "@proj/api/schema";
import { mockMobileViewport } from "@tests/mock-viewport";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { InspectionHistoryRecordsTable } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/inspection-history-table/inspection-history-records-table";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params: _params,
    search: _search,
    ...props
  }: {
    children: ReactNode;
    params?: unknown;
    search?: unknown;
    to: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

beforeEach(() => {
  mockMobileViewport();
});

const failed: components["schemas"]["InspectionResultResponse"] = {
  id: "i1",
  estateId: "e",
  assetId: "a",
  locationId: "l",
  locationPath: "Block A",
  outcome: "FAIL",
  inspectedOn: "2026-10-26",
  notes: "Cracked seal",
  recordedByUserId: "u",
  recordedByName: "Alex Tan",
  createdAt: "2026-10-26T00:30:00Z",
  photos: [],
  workOrder: { id: "w", reference: "OAK-W0001" },
};

it("lists inspection records on phones with the date linking to the record", () => {
  renderWithProviders(
    <InspectionHistoryRecordsTable
      canCreateWorkOrder
      canViewWorkOrder
      records={[
        failed,
        {
          ...failed,
          id: "i2",
          outcome: "PASS",
          inspectedOn: "2026-10-20",
          recordedByName: "Mei Lim",
          workOrder: null,
        },
      ]}
    />
  );
  expect(screen.queryByRole("table")).toBeNull();
  const list = within(screen.getByRole("list", { name: "Inspection records" }));
  const [first, second] = list.getAllByRole("listitem");
  const item = within(first);
  expect(
    item.getByRole("link", { name: "2026-10-26" }).getAttribute("href")
  ).toBe("/estates/$estateId/assets/$assetId/inspections/$inspectionId");
  item.getByText("Fail");
  item.getByText("Alex Tan");
  item.getByRole("link", { name: "OAK-W0001" });
  within(second).getByText("Pass");
  within(second).getByText("Closed");
});
