import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeactivateAssetDialog } from "@/routes/_authenticated/estates/$estateId/assets/$assetId/-components/deactivate-asset-dialog";
import {
  renderWithProviders,
  screen,
  waitFor,
} from "../../../../../../../test-utils";

describe("DeactivateAssetDialog", () => {
  it("keeps confirm disabled until the exact reference is typed", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <DeactivateAssetDialog
        name="Lift A"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        reference="SUNRISE-A0001"
      />
    );
    screen.getByRole("dialog", { name: "Deactivate Lift A?" });
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Deactivate asset",
    });
    const input = screen.getByRole("textbox", { name: "Asset reference" });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "sunrise-a0001" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "SUNRISE-A000" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "SUNRISE-A0001" } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith("SUNRISE-A0001")
    );
  });

  it("cancels without sending a deactivation", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <DeactivateAssetDialog
        name="Lift A"
        onCancel={onCancel}
        onConfirm={onConfirm}
        reference="SUNRISE-A0001"
      />
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Asset reference" }), {
      target: { value: "SUNRISE-A0001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("stays open and explains a server error", async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValue(new Error("This estate is inactive."));
    const onCancel = vi.fn();
    renderWithProviders(
      <DeactivateAssetDialog
        name="Lift A"
        onCancel={onCancel}
        onConfirm={onConfirm}
        reference="SUNRISE-A0001"
      />
    );
    const input = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Asset reference",
    });
    fireEvent.change(input, { target: { value: "SUNRISE-A0001" } });
    fireEvent.click(screen.getByRole("button", { name: "Deactivate asset" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "estate is inactive"
    );
    // Still exposed as an open dialog - a closed one leaves the a11y tree.
    screen.getByRole("dialog", { name: "Deactivate Lift A?" });
    expect(onCancel).not.toHaveBeenCalled();
    expect(input.value).toBe("SUNRISE-A0001");
    // The owner can retry once the request has settled.
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>("button", {
          name: "Deactivate asset",
        }).disabled
      ).toBe(false)
    );
  });
});
