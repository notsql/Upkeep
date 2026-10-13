import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { FormActions } from "@/components/form-actions";

it("offers cancellation without submitting and blocks actions during a save", () => {
  const cancel = vi.fn();
  const { rerender } = renderWithProviders(
    <FormActions label="Save changes" onCancel={cancel} pending={false} />
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(cancel).toHaveBeenCalledOnce();
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" }).type
  ).toBe("button");
  rerender(<FormActions label="Saving…" onCancel={cancel} pending />);
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "Saving…" }).disabled
  ).toBe(true);
  expect(
    screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" }).disabled
  ).toBe(true);
});
