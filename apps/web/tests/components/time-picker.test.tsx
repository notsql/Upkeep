import { chooseOption, renderWithProviders, screen } from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { TimePicker } from "@/components/time-picker";

it("shows the hour and minute of an HH:mm value", () => {
  renderWithProviders(
    <TimePicker aria-label="Start" onChange={vi.fn()} value="07:45" />
  );
  screen.getByRole("group", { name: "Start" });
  expect(
    screen.getByRole("combobox", { name: "Start hour" }).textContent
  ).toContain("07");
  expect(
    screen.getByRole("combobox", { name: "Start minute" }).textContent
  ).toContain("45");
});

it("emits HH:mm when the minute changes", async () => {
  const onChange = vi.fn();
  renderWithProviders(
    <TimePicker aria-label="Start" onChange={onChange} value="07:45" />
  );
  await chooseOption(
    screen.getByRole("combobox", { name: "Start minute" }),
    "10"
  );
  expect(onChange).toHaveBeenCalledWith("07:10");
});

it("defaults the minute to 00 when only an hour is picked", async () => {
  const onChange = vi.fn();
  renderWithProviders(
    <TimePicker aria-label="Start" onChange={onChange} value="" />
  );
  await chooseOption(
    screen.getByRole("combobox", { name: "Start hour" }),
    "13"
  );
  expect(onChange).toHaveBeenCalledWith("13:00");
});

it("keeps an off-step minute selectable", () => {
  renderWithProviders(
    <TimePicker aria-label="Start" onChange={vi.fn()} value="07:32" />
  );
  expect(
    screen.getByRole("combobox", { name: "Start minute" }).textContent
  ).toContain("32");
});
