import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  within,
} from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { DateTimePicker } from "@/components/date-time-picker";

const RECORDED_AT = /Recorded at/u;

it("shows the date and time from a datetime-local value", () => {
  renderWithProviders(
    <DateTimePicker
      aria-label="Recorded at"
      onChange={vi.fn()}
      value="2026-03-14T09:30"
    />
  );
  expect(
    screen.getByRole("button", { name: RECORDED_AT }).textContent
  ).toContain("14 Mar 2026");
  const time = screen.getByRole("group", { name: "Recorded at time" });
  within(time).getByRole("combobox", { name: "Recorded at hour" });
  expect(
    within(time).getByRole("combobox", { name: "Recorded at hour" }).textContent
  ).toContain("09");
  expect(
    within(time).getByRole("combobox", { name: "Recorded at minute" })
      .textContent
  ).toContain("30");
});

it("uses shadcn selects, not the browser time input", () => {
  const { container } = renderWithProviders(
    <DateTimePicker aria-label="Recorded at" onChange={vi.fn()} value="" />
  );
  expect(container.querySelector('input[type="time"]')).toBeNull();
});

it("keeps the date when the time changes", async () => {
  const onChange = vi.fn();
  renderWithProviders(
    <DateTimePicker
      aria-label="Recorded at"
      onChange={onChange}
      value="2026-03-14T09:30"
    />
  );
  await chooseOption(
    screen.getByRole("combobox", { name: "Recorded at hour" }),
    "17"
  );
  expect(onChange).toHaveBeenCalledWith("2026-03-14T17:30");
});

it("keeps the time when a day is picked", async () => {
  const onChange = vi.fn();
  renderWithProviders(
    <DateTimePicker
      aria-label="Recorded at"
      onChange={onChange}
      value="2026-03-14T09:30"
    />
  );
  fireEvent.click(screen.getByRole("button", { name: RECORDED_AT }));
  const grid = await screen.findByRole("grid");
  const day = Array.from(grid.querySelectorAll("button")).find(
    (button) => button.textContent === "2"
  );
  if (!day) {
    throw new Error("Day 2 not rendered");
  }
  fireEvent.click(day);
  expect(onChange).toHaveBeenCalledWith("2026-03-02T09:30");
});
