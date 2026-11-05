import { fireEvent } from "@testing-library/react";
import { renderWithProviders, screen, waitFor } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { DatePicker } from "@/components/forms/date-picker";

const DUE_DATE = /Due date/u;

it("labels the trigger and shows the chosen date", () => {
  renderWithProviders(
    <>
      <label htmlFor="due">Due date</label>
      <DatePicker id="due" onChange={vi.fn()} value="2026-03-14" />
    </>
  );
  const trigger = screen.getByRole("button", { name: DUE_DATE });
  expect(trigger.textContent).toContain("14 Mar 2026");
});

it("shows the placeholder while empty", () => {
  renderWithProviders(
    <DatePicker
      aria-label="Due date"
      onChange={vi.fn()}
      placeholder="Pick a date"
      value=""
    />
  );
  expect(screen.getByRole("button", { name: DUE_DATE }).textContent).toContain(
    "Pick a date"
  );
});

it("emits a YYYY-MM-DD value when a day is picked", async () => {
  const onChange = vi.fn();
  renderWithProviders(
    <DatePicker aria-label="Due date" onChange={onChange} value="2026-03-14" />
  );
  fireEvent.click(screen.getByRole("button", { name: DUE_DATE }));
  const grid = await screen.findByRole("grid");
  const day = Array.from(grid.querySelectorAll("button")).find(
    (button) => button.textContent === "20"
  );
  if (!day) {
    throw new Error("Day 20 not rendered");
  }
  fireEvent.click(day);
  expect(onChange).toHaveBeenCalledWith("2026-03-20");
});

it("clears the value", async () => {
  const onChange = vi.fn();
  renderWithProviders(
    <DatePicker aria-label="Due date" onChange={onChange} value="2026-03-14" />
  );
  fireEvent.click(screen.getByRole("button", { name: DUE_DATE }));
  fireEvent.click(await screen.findByRole("button", { name: "Clear date" }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(""));
});
