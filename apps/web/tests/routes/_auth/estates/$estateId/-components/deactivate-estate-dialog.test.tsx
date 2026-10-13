import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { describe, expect, it, vi } from "vitest";
import { DeactivateEstateDialog } from "@/routes/_auth/estates/$estateId/-components/deactivate-estate-dialog";

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
