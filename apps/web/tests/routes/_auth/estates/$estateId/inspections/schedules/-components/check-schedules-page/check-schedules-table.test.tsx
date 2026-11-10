import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { EstateAssetCategory } from "@/lib/asset-categories";
import { CheckSchedulesTable } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-page/check-schedules-table";

const CHANGED_BY = /^Casey Doe · /u;

vi.mock("@/lib/use-mobile", () => ({ useMobile: () => true }));

const pump = {
  code: "PUMP",
  label: "Pump",
  failsSilently: true,
  isDefault: false,
  activeAssetCount: 3,
  lastChange: {
    failsSilently: true,
    changedByUserId: "owner",
    changedByName: "Casey Doe",
    changedAt: "2026-10-20T04:00:00Z",
  },
  serviceInterval: { value: 6, unit: "MONTH" },
  lastIntervalChange: null,
} satisfies EstateAssetCategory;

describe("CheckSchedulesTable on a phone", () => {
  it("lists each equipment type with its assets, checks and schedule, and a menu of actions", async () => {
    const edit = vi.fn();
    const toggle = vi.fn();
    renderWithProviders(
      <CheckSchedulesTable
        categories={[pump]}
        disabled={false}
        onEditInterval={edit}
        onToggleFlag={toggle}
      />
    );
    expect(screen.queryByRole("table")).toBeNull();
    const list = within(screen.getByRole("list", { name: "Equipment types" }));
    const item = within(list.getAllByRole("listitem")[0]);
    item.getByText("Pump");
    item.getByText("3 assets · Regular checks on");
    item.getByText("Every 6 months");
    item.getByText(CHANGED_BY);
    fireEvent.click(item.getByRole("button", { name: "Actions for Pump" }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Change how often" })
    );
    expect(edit).toHaveBeenCalledWith(pump);
    fireEvent.click(item.getByRole("button", { name: "Actions for Pump" }));
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Turn off checks" })
    );
    expect(toggle).toHaveBeenCalledWith(pump);
  });
});
