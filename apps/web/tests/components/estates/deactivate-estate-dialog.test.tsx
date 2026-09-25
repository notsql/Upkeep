import { fireEvent } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { DeactivateEstateDialog } from "@/components/estates/deactivate-estate-dialog";
import { renderWithProviders, screen, waitFor } from "../../test-utils";

// jsdom does not implement native modal dialog methods.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
});

describe("DeactivateEstateDialog", () => {
  it("requires the exact code before submitting", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <DeactivateEstateDialog
        code="MG-001"
        name="Maple Grove"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );
    screen.getByRole("dialog", { name: "Deactivate Maple Grove?" });
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Deactivate estate",
    });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Estate code" }), {
      target: { value: "mg-001" },
    });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox", { name: "Estate code" }), {
      target: { value: "MG-001" },
    });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("MG-001"));
  });

  it("cancels without deactivating", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <DeactivateEstateDialog
        code="MG-001"
        name="Maple Grove"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
