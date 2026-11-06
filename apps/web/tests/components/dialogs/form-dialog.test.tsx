import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, within } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { FormDialog } from "@/components/dialogs/form-dialog";

it("submits its form from the footer", async () => {
  const onSubmit = vi.fn();
  renderWithProviders(
    <FormDialog
      onClose={vi.fn()}
      onSubmit={onSubmit}
      open
      submitLabel="Save"
      title="Edit location"
    >
      <input aria-label="Name" />
    </FormDialog>
  );
  const dialog = await screen.findByRole("dialog", { name: "Edit location" });
  within(dialog).getByRole("textbox", { name: "Name" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  expect(onSubmit).toHaveBeenCalledOnce();
});

it("cannot be cancelled while pending", async () => {
  const onClose = vi.fn();
  renderWithProviders(
    <FormDialog
      error="Name taken"
      onClose={onClose}
      onSubmit={vi.fn()}
      open
      pending
      submitLabel="Save"
      title="Edit location"
    />
  );
  const dialog = await screen.findByRole("dialog");
  const cancel = within(dialog).getByRole<HTMLButtonElement>("button", {
    name: "Cancel",
  });
  expect(cancel.disabled).toBe(true);
  expect(
    within(dialog).getByRole<HTMLButtonElement>("button", { name: "Saving…" })
      .disabled
  ).toBe(true);
  within(dialog).getByRole("alert");
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(onClose).not.toHaveBeenCalled();
});

it("names its form, disables submit and renders secondary actions", async () => {
  const onSubmit = vi.fn();
  renderWithProviders(
    <FormDialog
      onClose={vi.fn()}
      onSubmit={onSubmit}
      open
      secondaryActions={<button type="button">Unlink</button>}
      submitDisabled
      submitLabel="Save link"
      title="Link asset"
    />
  );
  const dialog = await screen.findByRole("dialog", { name: "Link asset" });
  within(dialog).getByRole("form", { name: "Link asset" });
  within(dialog).getByRole("button", { name: "Unlink" });
  const submit = within(dialog).getByRole<HTMLButtonElement>("button", {
    name: "Save link",
  });
  expect(submit.disabled).toBe(true);
});

it("hands onSubmit the form so uncontrolled fields can be read", async () => {
  const onSubmit = vi.fn();
  renderWithProviders(
    <FormDialog
      onClose={vi.fn()}
      onSubmit={onSubmit}
      open
      submitLabel="Save"
      title="Complete"
    >
      <input aria-label="Findings" defaultValue="Leak" name="findings" />
    </FormDialog>
  );
  const dialog = await screen.findByRole("dialog", { name: "Complete" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
  const form = onSubmit.mock.calls[0]?.[0] as HTMLFormElement;
  expect(new FormData(form).get("findings")).toBe("Leak");
});
