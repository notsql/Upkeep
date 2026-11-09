import { fireEvent } from "@testing-library/react";
import {
  chooseOption,
  renderWithProviders,
  screen,
  waitFor,
} from "@tests/test-utils";
import { expect, it, vi } from "vitest";
import { ServiceIntervalDialog } from "@/components/service-intervals/service-interval-dialog";
import type { ServiceInterval } from "@/lib/service-intervals";

function open({
  interval = null,
  onSave = vi.fn(() => Promise.resolve()),
  onCancel = vi.fn(),
}: {
  interval?: ServiceInterval | null;
  onSave?: (interval: ServiceInterval | null) => Promise<unknown>;
  onCancel?: () => void;
} = {}) {
  renderWithProviders(
    <ServiceIntervalDialog
      description="How often the manufacturer says pumps should be serviced."
      interval={interval}
      onCancel={onCancel}
      onSave={onSave}
      title="Service interval for Pump"
    />
  );
  return { onSave, onCancel };
}

function valueInput() {
  return screen.getByRole("spinbutton", { name: "Every" });
}

function unitSelect() {
  return screen.getByRole("combobox", { name: "Unit" });
}

it("starts from the current interval", () => {
  open({ interval: { value: 2, unit: "YEAR" } });
  screen.getByRole("dialog", { name: "Service interval for Pump" });
  expect((valueInput() as HTMLInputElement).value).toBe("2");
  expect(unitSelect().textContent).toContain("Years");
});

it("starts in months when nothing is set", () => {
  open();
  expect((valueInput() as HTMLInputElement).value).toBe("");
  expect(unitSelect().textContent).toContain("Months");
});

it.each([
  ["", "Months", "Enter a whole number of months from 1 to 120."],
  ["0", "Months", "Enter a whole number of months from 1 to 120."],
  ["121", "Months", "Enter a whole number of months from 1 to 120."],
  ["6.5", "Months", "Enter a whole number of months from 1 to 120."],
  ["-3", "Days", "Enter a whole number of days from 1 to 3650."],
  ["3651", "Days", "Enter a whole number of days from 1 to 3650."],
  ["11", "Years", "Enter a whole number of years from 1 to 10."],
])("refuses %j %s without saving", async (value, unit, message) => {
  const { onSave } = open();
  fireEvent.change(valueInput(), { target: { value } });
  await chooseOption(unitSelect(), unit);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  screen.getByText(message);
  expect(valueInput().getAttribute("aria-invalid")).toBe("true");
  expect(onSave).not.toHaveBeenCalled();
});

it.each([
  ["1", "Days", { value: 1, unit: "DAY" }],
  ["3650", "Days", { value: 3650, unit: "DAY" }],
  ["120", "Months", { value: 120, unit: "MONTH" }],
  ["10", "Years", { value: 10, unit: "YEAR" }],
])("saves %j %s", async (value, unit, saved) => {
  const { onSave } = open();
  fireEvent.change(valueInput(), { target: { value } });
  await chooseOption(unitSelect(), unit);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(saved));
});

it("clears a set interval", async () => {
  const { onSave } = open({ interval: { value: 6, unit: "MONTH" } });
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
});

it("offers Clear only when there is something to clear", () => {
  open();
  expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
});

it("keeps the dialog open with the error when saving fails", async () => {
  open({
    onSave: vi.fn(() => Promise.reject(new Error("This estate is inactive."))),
  });
  fireEvent.change(valueInput(), { target: { value: "6" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "This estate is inactive."
  );
  screen.getByRole("dialog", { name: "Service interval for Pump" });
});

it("says Couldn't save when the failure has no message", async () => {
  open({ onSave: vi.fn(() => Promise.reject("offline")) });
  fireEvent.change(valueInput(), { target: { value: "6" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Couldn't save. Please try again."
  );
});

it("cancels", () => {
  const { onCancel } = open();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCancel).toHaveBeenCalled();
});
