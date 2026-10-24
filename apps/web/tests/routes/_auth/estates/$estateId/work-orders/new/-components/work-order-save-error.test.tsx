import { renderWithProviders, screen } from "@tests/test-utils";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { WorkOrderRequestError } from "@/lib/work-orders";
import { WorkOrderSaveError } from "@/routes/_auth/estates/$estateId/work-orders/new/-components/work-order-save-error";

const NETWORK_ADVICE = /If the connection was interrupted/;

it("does not describe an inactive asset conflict as a changed report", () => {
  renderWithProviders(
    <WorkOrderSaveError
      error={
        new WorkOrderRequestError("This asset is inactive or retired.", 409)
      }
      estateId="oak"
      reloadSource={vi.fn()}
      reportSource
    />
  );
  screen.getByText("Unable to create work order");
  expect(screen.queryByRole("button", { name: "Reload source" })).toBeNull();
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => (
    <a href="/orders">{children}</a>
  ),
}));
it("explains a source conflict without unrelated network advice", () => {
  renderWithProviders(
    <WorkOrderSaveError
      error={new WorkOrderRequestError("The report location changed.", 409)}
      estateId="oak"
      reloadSource={vi.fn()}
      reportSource
    />
  );
  screen.getByText("Source report changed");
  screen.getByRole("button", { name: "Reload source" });
  expect(screen.queryByText(NETWORK_ADVICE)).toBeNull();
});
it("offers a list check after an ambiguous network failure", () => {
  renderWithProviders(
    <WorkOrderSaveError
      error={new TypeError("Failed to fetch")}
      estateId="oak"
      reloadSource={vi.fn()}
      reportSource={false}
    />
  );
  screen.getByText(NETWORK_ADVICE);
  screen.getByRole("link", { name: "Check work orders" });
});
