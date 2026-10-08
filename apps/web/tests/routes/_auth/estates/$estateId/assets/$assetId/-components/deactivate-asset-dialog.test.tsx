import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeactivateAssetDialog } from "@/routes/_auth/estates/$estateId/assets/$assetId/-components/deactivate-asset-dialog";
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
        lifecycleVersion={0}
        name="Lift A"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        reference="SUNRISE-A0001"
      />
    );
    screen.getByRole("dialog", { name: "Retire Lift A?" });
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "Retire asset",
    });
    const input = screen.getByRole("textbox", { name: "Asset reference" });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "sunrise-a0001" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "SUNRISE-A000" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: "SUNRISE-A0001" } });
    expect(button.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Retirement date"), {
      target: { value: "2025-01-01" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Retirement reason" }),
      { target: { value: " Worn out " } }
    );
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith({
        reference: "SUNRISE-A0001",
        retiredOn: "2025-01-01",
        retirementReason: "Worn out",
        expectedVersion: 0,
      })
    );
  });

  it("cancels without sending a deactivation", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <DeactivateAssetDialog
        lifecycleVersion={0}
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
        lifecycleVersion={0}
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
    fireEvent.change(
      screen.getByRole("textbox", { name: "Retirement reason" }),
      { target: { value: "Reason" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Retire asset" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "estate is inactive"
    );
    // Still exposed as an open dialog - a closed one leaves the a11y tree.
    screen.getByRole("dialog", { name: "Retire Lift A?" });
    expect(onCancel).not.toHaveBeenCalled();
    expect(input.value).toBe("SUNRISE-A0001");
    // The owner can retry once the request has settled.
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLButtonElement>("button", {
          name: "Retire asset",
        }).disabled
      ).toBe(false)
    );
  });

  it("explains a retirement date before installation and enables retirement once corrected", () => {
    renderWithProviders(
      <DeactivateAssetDialog
        installedOn="2026-01-01"
        lifecycleVersion={0}
        name="Lighting"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        reference="TEST-001-A0001"
      />
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Asset reference" }), {
      target: { value: "TEST-001-A0001" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Retirement reason" }),
      { target: { value: "Broken" } }
    );
    fireEvent.change(screen.getByLabelText("Retirement date"), {
      target: { value: "2025-12-31" },
    });
    expect(screen.getByRole("alert").textContent).toContain("2026-01-01");
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Retire asset" })
        .disabled
    ).toBe(true);
    fireEvent.change(screen.getByLabelText("Retirement date"), {
      target: { value: "2026-01-01" },
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Retire asset" })
        .disabled
    ).toBe(false);
  });

  it("explains why a future retirement date cannot be submitted", () => {
    renderWithProviders(
      <DeactivateAssetDialog
        lifecycleVersion={0}
        name="Lighting"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        reference="TEST-001-A0001"
      />
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Asset reference" }), {
      target: { value: "TEST-001-A0001" },
    });
    fireEvent.change(
      screen.getByRole("textbox", { name: "Retirement reason" }),
      { target: { value: "Broken" } }
    );
    fireEvent.change(screen.getByLabelText("Retirement date"), {
      target: { value: "2999-01-01" },
    });
    expect(screen.getByRole("alert").textContent).toContain("future");
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Retire asset" })
        .disabled
    ).toBe(true);
  });

  it("allows today's retirement when the browser formats calendar dates with slashes", async () => {
    vi.setSystemTime(new Date("2026-10-08T04:00:00Z"));
    const originalFormat = Object.getOwnPropertyDescriptor(
      Intl.DateTimeFormat.prototype,
      "format"
    );
    if (!originalFormat) {
      throw new Error("Intl date formatting is unavailable.");
    }
    Object.defineProperty(Intl.DateTimeFormat.prototype, "format", {
      configurable: true,
      get: () => () => "10/08/2026",
    });
    try {
      const onConfirm = vi.fn().mockResolvedValue(undefined);
      renderWithProviders(
        <DeactivateAssetDialog
          installedOn="2026-01-01"
          lifecycleVersion={0}
          name="Lighting"
          onCancel={vi.fn()}
          onConfirm={onConfirm}
          reference="TEST-001-A0001"
        />
      );
      fireEvent.change(
        screen.getByRole("textbox", { name: "Asset reference" }),
        { target: { value: "TEST-001-A0001" } }
      );
      fireEvent.change(
        screen.getByRole("textbox", { name: "Retirement reason" }),
        { target: { value: "Broken" } }
      );
      expect(
        screen.getByLabelText<HTMLInputElement>("Retirement date").value
      ).toBe("2026-10-08");
      const button = screen.getByRole<HTMLButtonElement>("button", {
        name: "Retire asset",
      });
      expect(button.disabled).toBe(false);
      fireEvent.click(button);
      await waitFor(() =>
        expect(onConfirm).toHaveBeenCalledWith({
          reference: "TEST-001-A0001",
          retiredOn: "2026-10-08",
          retirementReason: "Broken",
          expectedVersion: 0,
        })
      );
    } finally {
      Object.defineProperty(
        Intl.DateTimeFormat.prototype,
        "format",
        originalFormat
      );
      vi.useRealTimers();
    }
  });
});
