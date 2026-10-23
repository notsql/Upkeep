import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { WorkOrderAssetPicker } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-asset-picker";

const PUMP_OPTION = /MP-A0001.*Booster pump/;
const state = vi.hoisted(() => ({ pending: false, error: false }));
vi.mock("@/lib/work-orders", () => ({
  useWorkOrderAssets: (_estate: string, query: string) => ({
    isPending: state.pending,
    isError: state.error,
    data: {
      items: "pump".includes(query.toLowerCase())
        ? [
            {
              id: "pump",
              reference: "MP-A0001",
              name: "Booster pump",
              locationPath: "Block A / L1",
            },
          ]
        : [],
      nextCursor: null,
    },
  }),
}));
beforeEach(() => {
  state.pending = false;
  state.error = false;
});
async function openPicker() {
  fireEvent.click(
    screen.getByRole("button", { name: "Linked asset (optional)" })
  );
  return await screen.findByRole("textbox", { name: "Search assets" });
}
async function choosePump() {
  const option = await screen.findByRole("button", {
    name: PUMP_OPTION,
  });
  await waitFor(() => {
    fireEvent.click(option);
    expect(screen.queryByRole("textbox", { name: "Search assets" })).toBeNull();
  });
}
it("keeps search inside the asset popup and shows the chosen asset in the closed picker", async () => {
  const change = vi.fn();
  renderWithProviders(
    <WorkOrderAssetPicker estateId="maple" onChange={change} />
  );
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("textbox", { name: "Search assets" })).toBeNull();
  fireEvent.change(await openPicker(), { target: { value: "pump" } });
  await choosePump();
  expect(change).toHaveBeenLastCalledWith("pump");
  expect(
    screen.getByRole("button", { name: "Linked asset (optional)" }).textContent
  ).toContain("Booster pump");
});
it("explains an empty search while preserving and allowing removal of the selection", async () => {
  const change = vi.fn();
  renderWithProviders(
    <WorkOrderAssetPicker estateId="maple" onChange={change} />
  );
  await openPicker();
  await choosePump();
  fireEvent.change(await openPicker(), { target: { value: "unknown" } });
  await screen.findByText("No matching assets.");
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Search assets" }), {
    key: "Escape",
  });
  fireEvent.click(screen.getByRole("button", { name: "Remove linked asset" }));
  expect(change).toHaveBeenLastCalledWith(undefined);
});
it("shows when the asset search is still loading", async () => {
  state.pending = true;
  renderWithProviders(
    <WorkOrderAssetPicker estateId="maple" onChange={vi.fn()} />
  );
  await openPicker();
  screen.getByRole("status");
});
