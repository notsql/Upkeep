import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { describe, expect, it, vi } from "vitest";
import { EstateForm } from "@/routes/_auth/estates/-components/estate-form";

describe("EstateForm", () => {
  it("collects the identifying details and submits them", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<EstateForm onSave={onSave} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Maple Grove" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Estate code" }), {
      target: { value: "MG-001" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Address" }), {
      target: { value: "1 Grove Road" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Postal code" }), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create estate" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: "Maple Grove",
        code: "MG-001",
        address: "1 Grove Road",
        postalCode: "123456",
        description: "",
      })
    );
  });

  it("keeps entered details and explains a failed save", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValue(new Error("An estate with this code already exists."));
    renderWithProviders(
      <EstateForm
        initialValues={{
          name: "Maple Grove",
          code: "MG-001",
          address: "1 Grove Road",
          postalCode: "123456",
          description: "",
        }}
        onSave={onSave}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "already exists"
    );
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value
    ).toBe("Maple Grove");
  });
});
