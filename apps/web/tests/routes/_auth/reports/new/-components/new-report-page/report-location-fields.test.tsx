import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import type { ResidentLocation } from "@/lib/reports";
import { ReportLocationFields } from "@/routes/_auth/reports/new/-components/new-report-page/report-location-fields";

const locations: ResidentLocation[] = [
  { id: "b", type: "BLOCK", name: "Block A", parentId: null, sortOrder: 1 },
  { id: "l", type: "LEVEL", name: "L1", parentId: "b", sortOrder: 1 },
  {
    id: "lobby",
    type: "COMMON_AREA",
    name: "Lift lobby",
    parentId: "l",
    sortOrder: null,
  },
  {
    id: "park",
    type: "COMMON_AREA",
    name: "Playground",
    parentId: "b",
    sortOrder: null,
  },
];

it("groups common areas by where they are: on the level or anywhere in the block", async () => {
  renderWithProviders(
    <ReportLocationFields
      blockId="b"
      commonId={null}
      id="report"
      levelId="l"
      locations={locations}
      onBlockChange={vi.fn()}
      onCommonChange={vi.fn()}
      onLevelChange={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("combobox", { name: /Common area/u }));
  const onLevel = await screen.findByRole("group", { name: "On L1" });
  within(onLevel).getByRole("option", { name: "Lift lobby" });
  const inBlock = screen.getByRole("group", { name: "Anywhere in Block A" });
  within(inBlock).getByRole("option", { name: "Playground" });
  expect(
    within(inBlock).queryByRole("option", { name: "Lift lobby" })
  ).toBeNull();
});
