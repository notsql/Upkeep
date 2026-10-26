import { fireEvent } from "@testing-library/react";
import {
  renderWithProviders,
  screen,
  waitFor,
  within,
} from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { ReportSourcePicker } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/report-source-picker";

const state = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/estate-reports", () => ({ useEstateReportList: state.list }));
vi.mock("@/lib/locations", () => ({
  useLocations: () => ({ data: [], isError: false }),
}));
beforeEach(() =>
  state.list.mockImplementation(
    (_estate: string, _filters: { blockId?: string }, cursor?: string) => ({
      data: {
        items: [
          {
            id: cursor ? "second" : "first",
            title: cursor ? "Second leak" : "Lobby leak",
          },
        ],
        nextCursor: cursor ? null : "next",
      },
      isPending: false,
      isError: false,
    })
  )
);

it("keeps report filters in a dialog and retains a selected report across pages", async () => {
  const change = vi.fn();
  renderWithProviders(
    <ReportSourcePicker estateId="oak" onChange={change} value="" />
  );
  expect(screen.queryByRole("combobox", { name: "Block" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Resident report" }));
  const dialog = within(
    await screen.findByRole("dialog", { name: "Choose resident report" })
  );
  dialog.getByRole("combobox", { name: "Block" });
  fireEvent.click(dialog.getByRole("button", { name: "Next reports" }));
  const choice = await dialog.findByRole("button", { name: "Second leak" });
  await waitFor(() => {
    fireEvent.click(choice);
    expect(change).toHaveBeenCalledWith("second");
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(
    screen.getByRole("button", { name: "Resident report" }).textContent
  ).toContain("Second leak");
  fireEvent.click(screen.getByRole("button", { name: "Resident report" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "First report page" })
  );
  await screen.findByRole("button", { name: "Lobby leak" });
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(
    screen.getByRole("button", { name: "Resident report" }).textContent
  ).toContain("Second leak");
});
