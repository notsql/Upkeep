import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";

it("confirms and cancels a destructive action", async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  renderWithProviders(
    <ConfirmDialog
      confirmLabel="Delete role"
      description="Permanent"
      onCancel={onCancel}
      onConfirm={onConfirm}
      open
      pendingLabel="Deleting role…"
      title="Delete role"
    >
      <p>Supervisor</p>
    </ConfirmDialog>
  );
  const dialog = await screen.findByRole("dialog", { name: "Delete role" });
  within(dialog).getByText("Supervisor");
  fireEvent.click(within(dialog).getByRole("button", { name: "Delete role" }));
  expect(onConfirm).toHaveBeenCalledOnce();
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(onCancel).toHaveBeenCalledOnce();
});

it("locks both buttons and shows the pending label and error", async () => {
  renderWithProviders(
    <ConfirmDialog
      confirmLabel="Delete role"
      error="Server said no"
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      open
      pending
      pendingLabel="Deleting role…"
      title="Delete role"
    />
  );
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByRole<HTMLButtonElement>("button", {
      name: "Deleting role…",
    }).disabled
  ).toBe(true);
  expect(
    within(dialog).getByRole<HTMLButtonElement>("button", { name: "Cancel" })
      .disabled
  ).toBe(true);
  within(dialog).getByRole("alert");
  expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
});

it("keeps confirm disabled while confirmDisabled", async () => {
  const onConfirm = vi.fn();
  renderWithProviders(
    <ConfirmDialog
      confirmDisabled
      confirmLabel="Deactivate"
      onCancel={vi.fn()}
      onConfirm={onConfirm}
      open
      title="Deactivate estate"
    />
  );
  const dialog = await screen.findByRole("dialog");
  const confirm = within(dialog).getByRole<HTMLButtonElement>("button", {
    name: "Deactivate",
  });
  expect(confirm.disabled).toBe(true);
  expect(
    within(dialog).getByRole<HTMLButtonElement>("button", { name: "Cancel" })
      .disabled
  ).toBe(false);
});
