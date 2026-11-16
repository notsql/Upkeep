import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import type { EstateAssetCategory } from "@/lib/asset-categories";
import { CheckSchedulesTable } from "@/routes/_auth/estates/$estateId/inspections/schedules/-components/check-schedules-page/check-schedules-table";

vi.mock("@/lib/use-mobile", () => ({ useMobile: () => false }));

function category(code: string, label: string, failsSilently: boolean) {
  return {
    code,
    label,
    failsSilently,
    isDefault: false,
    activeAssetCount: 1,
    lastChange: {
      failsSilently,
      changedByUserId: "owner",
      changedByName: "Casey Doe",
      changedAt: "2026-10-20T04:00:00Z",
    },
    serviceInterval: null,
    lastIntervalChange: null,
  } satisfies EstateAssetCategory;
}

it("marks checks that are on in green and makes turning checks on stand out", () => {
  renderWithProviders(
    <CheckSchedulesTable
      categories={[
        category("PUMP", "Pump", true),
        category("LIFT", "Lift", false),
      ]}
      disabled={false}
      onEditInterval={vi.fn()}
      onToggleFlag={vi.fn()}
    />
  );
  expect(screen.getByText("On").dataset.variant).toBe("success");
  const turnOn = screen.getByRole("button", {
    name: "Turn on regular checks for Lift",
  });
  const turnOff = screen.getByRole("button", {
    name: "Turn off regular checks for Pump",
  });
  // The two actions no longer look identical.
  expect(turnOn.className).not.toBe(turnOff.className);
});
